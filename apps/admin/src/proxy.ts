import { NextResponse, type NextRequest } from "next/server";

import {
  cookieOptions,
  forwardHeaders,
  PATH_HEADER,
  REFRESH_MARGIN_MS,
  REQUEST_ID_HEADER,
  SESSION_COOKIE,
  sealSession,
  sessionMaxAge,
  unsealSession,
} from "@/lib/session/model";
import { refreshSession } from "@/lib/session/refresh";
import { securityHeaders } from "@/lib/security-headers";

/**
 * Proxy (Next 16, runtime Node.js) delante de todo el panel:
 * 1. CSP estricta con nonce por petición + cabeceras de seguridad, `noindex` y `no-store`.
 * 2. `X-Request-Id` por petición (se reenvía a la API para correlacionar logs y auditoría).
 * 3. Sesión: sin cookie válida → login. Si al access token le quedan < 2 min, lo refresca aquí
 *    (cola serializada por sesión) y reescribe la cookie en la respuesta Y en la petición, para que
 *    el render ya use los tokens nuevos (en render no se pueden escribir cookies).
 *    Refresh terminal (`refresh-token-reused`, `session-revoked`…) → borra la cookie y va al login.
 */

// El optimizador de Next lee el logo público sin la cookie de la página.
// Permitir solo este archivo; el resto del panel conserva su autenticación.
const PUBLIC_PATHS = [/^\/login(\/|$)/, /^\/auth\//, /^\/brand\/peruwonderstours-dorado\.png$/];

/** Origen de los medios subidos (en desarrollo es http://localhost:3001, que `https:` no cubre). */
function mediaOrigin(): string {
  try {
    return new URL(process.env.MEDIA_PUBLIC_BASE_URL || process.env.API_BASE_URL || "http://localhost:3001").origin;
  } catch {
    return "";
  }
}

function buildCsp(nonce: string, dev: boolean): string {
  const media = mediaOrigin();
  return [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${dev ? " 'unsafe-eval'" : ""}`,
    // En desarrollo el overlay de errores de Next inyecta estilos sin nonce.
    dev ? "style-src 'self' 'unsafe-inline'" : `style-src 'self' 'nonce-${nonce}'`,
    // Sin atributos style en producción (el panel no los usa; `<meter>` en lugar de barras con width).
    ...(dev ? [] : ["style-src-attr 'none'"]),
    // Portadas de tours: URLs absolutas del CDN (solo https) + origen de los medios subidos.
    `img-src 'self' data: blob: https:${media && !media.startsWith("https:") ? ` ${media}` : ""}`,
    "font-src 'self'",
    `connect-src 'self'${dev ? " ws: wss:" : ""}`,
    "object-src 'none'",
    "base-uri 'none'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    "manifest-src 'self'",
    "worker-src 'none'",
    ...(dev ? [] : ["upgrade-insecure-requests"]),
  ].join("; ");
}

function withHeaders(response: NextResponse, csp: string, requestId: string): NextResponse {
  response.headers.set("Content-Security-Policy", csp);
  response.headers.set(REQUEST_ID_HEADER, requestId);
  for (const [k, v] of Object.entries(securityHeaders())) response.headers.set(k, v);
  return response;
}

export async function proxy(request: NextRequest) {
  const dev = process.env.NODE_ENV !== "production";
  const nonce = Buffer.from(crypto.randomUUID()).toString("base64");
  const csp = buildCsp(nonce, dev);
  const incomingId = request.headers.get(REQUEST_ID_HEADER);
  const requestId = incomingId && /^[A-Za-z0-9._-]{8,64}$/.test(incomingId) ? incomingId : crypto.randomUUID();
  const { pathname, search } = request.nextUrl;
  const isPublic = PUBLIC_PATHS.some((re) => re.test(pathname));
  const isNavigation = request.method === "GET" || request.method === "HEAD";

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("Content-Security-Policy", csp);
  requestHeaders.set(REQUEST_ID_HEADER, requestId);
  requestHeaders.set(PATH_HEADER, `${pathname}${search}`.slice(0, 1000));

  const toLogin = (reason?: string, clear = false) => {
    const url = new URL("/login", request.url);
    if (reason) url.searchParams.set("motivo", reason);
    else if (pathname !== "/") url.searchParams.set("volver", `${pathname}${search}`.slice(0, 500));
    const res = withHeaders(NextResponse.redirect(url, 303), csp, requestId);
    if (clear) res.cookies.set(SESSION_COOKIE, "", { ...cookieOptions, maxAge: 0 });
    return res;
  };

  const rawCookie = request.cookies.get(SESSION_COOKIE)?.value;
  let session = unsealSession(rawCookie);
  let rotated: string | null = null;

  if (session && session.atExp - Date.now() < REFRESH_MARGIN_MS) {
    const result = await refreshSession(session, forwardHeaders(requestHeaders));
    if (result.ok) {
      session = result.session;
      rotated = sealSession(session);
      request.cookies.set(SESSION_COOKIE, rotated);
      requestHeaders.set("cookie", request.cookies.toString());
    } else if (result.terminal) {
      session = null;
      if (!isPublic && isNavigation) return toLogin(result.code === "refresh-token-reused" ? "reuso" : "sesion", true);
      request.cookies.delete(SESSION_COOKIE);
      requestHeaders.set("cookie", request.cookies.toString());
      rotated = "";
    }
    // Transitorio (API caída / 429): se sigue con la sesión actual; la página mostrará el error.
  }

  if (!session && !isPublic && isNavigation) return toLogin(undefined, Boolean(rawCookie));

  const response = withHeaders(NextResponse.next({ request: { headers: requestHeaders } }), csp, requestId);
  if (rotated !== null && session) response.cookies.set(SESSION_COOKIE, rotated, { ...cookieOptions, maxAge: sessionMaxAge(session) });
  else if (rotated === "") response.cookies.set(SESSION_COOKIE, "", { ...cookieOptions, maxAge: 0 });
  return response;
}

export const config = {
  matcher: [
    {
      source: "/((?!_next/static|_next/image|favicon.ico|icon.svg|robots.txt).*)",
    },
  ],
};
