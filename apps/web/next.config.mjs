import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import createNextIntlPlugin from "next-intl/plugin";
import { isLocalHttpDemo } from "./src/lib/security/transport-policy.mjs";

const configDirectory = path.dirname(fileURLToPath(import.meta.url));
const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

// Se lee relativo a este archivo (no al cwd) para que `next dev apps/web` funcione desde cualquier carpeta.
const legacyRedirects = JSON.parse(
  readFileSync(path.join(configDirectory, "../../data/seed/redirects.json"), "utf8"),
);

/**
 * Redirecciones 301 del sitio viejo que cambian de ruta en el dominio nuevo (HU-0.2).
 * Fuente: data/seed/redirects.json (73 reglas).
 *
 * L4 (auditoría sprint 3): las reglas cuyo origen coincide con el destino NO necesitan redirección
 * porque la ruta existe con el mismo path (tours, destinos, categorías, blog, contáctenos,
 * testimonios, dejar-testimonio, tipos-de-tours y el Libro de Reclamaciones). Antes se omitían y
 * varias terminaban en 404 porque esas páginas no existían; ahora todas existen en app/[locale].
 * Las rutas viejas sin equivalente directo (categorías del blog) se redirigen a su índice.
 */
function buildLegacyRedirects() {
  /** @type {{ source: string; destination: string; statusCode: 301 }[]} */
  const rules = [];
  for (const rule of legacyRedirects.rules) {
    const source = new URL(rule.from).pathname;
    if (source === rule.to) continue;
    rules.push({ source, destination: rule.to, statusCode: 301 });
  }
  // Categorías del blog viejo (/es/blog/categorias/<slug>) → índice del blog.
  rules.push({ source: "/es/blog/categorias/:slug", destination: "/es/blog", statusCode: 301 });
  return rules;
}

/**
 * L1 (auditoría sprint 3): `docs/legal/*.md` se leen AQUÍ, con una ruta relativa a este archivo, y se
 * incrustan en el build vía `env` (reemplazo estático de `process.env.PWT_LEGAL_*`). Las páginas de
 * políticas ya no dependen del cwd del proceso ni del disco en tiempo de ejecución.
 */
function legalDocumentsEnv() {
  const dir = path.join(configDirectory, "../../docs/legal");
  /** @param {string} file */
  const read = (file) => readFileSync(path.join(dir, file), "utf8");
  return {
    PWT_LEGAL_TERMINOS: read("terminos-y-condiciones.md"),
    PWT_LEGAL_PRIVACIDAD: read("politica-de-privacidad.md"),
    PWT_LEGAL_CANCELACION: read("politica-de-cancelacion-y-reembolso.md"),
    PWT_LEGAL_COOKIES: read("politica-de-cookies.md"),
    PWT_LEGAL_PT_TERMINOS: read("pt/terminos-y-condiciones.md"),
    PWT_LEGAL_PT_PRIVACIDAD: read("pt/politica-de-privacidad.md"),
    PWT_LEGAL_PT_CANCELACION: read("pt/politica-de-cancelacion-y-reembolso.md"),
    PWT_LEGAL_PT_COOKIES: read("pt/politica-de-cookies.md"),
  };
}

/**
 * Origen de la API (fotos re-alojadas que sirve en `/media/...`; el catálogo ya apunta a ellas).
 * Se deriva de `API_BASE_URL` (misma variable que usa `src/lib/env.ts`; por defecto la API local).
 */
const apiOrigin = new URL(process.env.API_BASE_URL || "http://localhost:3001/api/v1");
const apiIsLocal = ["localhost", "127.0.0.1", "[::1]"].includes(apiOrigin.hostname);

// Local presentations serve the already compressed archive directly. This avoids
// cold image conversions on Windows; public production keeps responsive optimization.
const localImagePreview = isLocalHttpDemo(process.env.PWT_DEMO_BUILD, process.env.PUBLIC_WEB_BASE_URL);

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Compilación de demostración aislada del servidor de desarrollo que ya usa el cliente.
  distDir: process.env.PWT_DEMO_BUILD === "1" ? ".next-demo" : ".next",
  transpilePackages: ["@pwt/ui"],
  // Monorepo pnpm: la raíz incluye data/seed y packages/ui.
  outputFileTracingRoot: path.join(configDirectory, "../.."),
  // 404 de URLs sin idioma (app/global-not-found.tsx): el layout raíz vive en app/[locale].
  experimental: { globalNotFound: true },
  // L1: los borradores legales se incrustan en el build (ver src/lib/legal/documents.ts).
  env: legalDocumentsEnv(),
  images: {
    unoptimized: localImagePreview,
    formats: ["image/avif", "image/webp"],
    // El catálogo archivado usa rutas locales; solo medios nuevos de la API tienen origen remoto.
    // Solo en desarrollo con la API local: Next bloquea por defecto optimizar imágenes de IPs locales.
    dangerouslyAllowLocalIP: apiIsLocal && (process.env.NODE_ENV !== "production" || process.env.PWT_DEMO_BUILD === "1"),
    remotePatterns: [
      {
        protocol: apiOrigin.protocol === "https:" ? "https" : "http",
        hostname: apiOrigin.hostname,
        ...(apiOrigin.port ? { port: apiOrigin.port } : {}),
        pathname: "/media/**",
      },
    ],
  },
  async redirects() {
    return buildLegacyRedirects();
  },
  poweredByHeader: false,
  async headers() {
    return [
      {
        // H-02: también en estáticos (la CSP con nonce la pone src/proxy.ts en las páginas).
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          ...(process.env.NODE_ENV === "production" && !isLocalHttpDemo(process.env.PWT_DEMO_BUILD, process.env.PUBLIC_WEB_BASE_URL) ? [{ key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" }] : []),
        ],
      },
      {
        // Service worker del voucher offline (HU-B.A2): siempre la versión más reciente.
        source: "/sw-voucher.js",
        headers: [
          { key: "Content-Type", value: "application/javascript; charset=utf-8" },
          { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
        ],
      },
    ];
  },
};

export default withNextIntl(nextConfig);
