import { readFileSync } from "node:fs";
import path from "node:path";
import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

// Se lee relativo a este archivo (no al cwd) para que `next dev apps/web` funcione desde cualquier carpeta.
const legacyRedirects = JSON.parse(
  readFileSync(path.join(__dirname, "../../data/seed/redirects.json"), "utf8"),
) as { rules: { from: string; to: string }[] };

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
  const rules: { source: string; destination: string; statusCode: 301 }[] = [];
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
function legalDocumentsEnv(): Record<string, string> {
  const dir = path.join(__dirname, "../../docs/legal");
  const read = (file: string) => readFileSync(path.join(dir, file), "utf8");
  return {
    PWT_LEGAL_TERMINOS: read("terminos-y-condiciones.md"),
    PWT_LEGAL_PRIVACIDAD: read("politica-de-privacidad.md"),
    PWT_LEGAL_CANCELACION: read("politica-de-cancelacion-y-reembolso.md"),
    PWT_LEGAL_COOKIES: read("politica-de-cookies.md"),
  };
}

/**
 * Origen de la API (fotos re-alojadas que sirve en `/media/...`; el catálogo ya apunta a ellas).
 * Se deriva de `API_BASE_URL` (misma variable que usa `src/lib/env.ts`; por defecto la API local).
 */
const apiOrigin = new URL(process.env.API_BASE_URL || "http://localhost:3001/api/v1");
const apiIsLocal = ["localhost", "127.0.0.1", "[::1]"].includes(apiOrigin.hostname);

const nextConfig: NextConfig = {
  transpilePackages: ["@pwt/ui"],
  // Monorepo pnpm: la raíz incluye data/seed y packages/ui.
  outputFileTracingRoot: path.join(__dirname, "../.."),
  // 404 de URLs sin idioma (app/global-not-found.tsx): el layout raíz vive en app/[locale].
  experimental: { globalNotFound: true },
  // L1: los borradores legales se incrustan en el build (ver src/lib/legal/documents.ts).
  env: legalDocumentsEnv(),
  images: {
    formats: ["image/avif", "image/webp"],
    // TEMPORAL (HU-0.3): fotos del cliente servidas desde su sitio actual hasta re-alojarlas.
    // Solo en desarrollo con la API local: Next bloquea por defecto optimizar imágenes de IPs locales.
    dangerouslyAllowLocalIP: apiIsLocal && process.env.NODE_ENV !== "production",
    remotePatterns: [
      {
        protocol: apiOrigin.protocol === "https:" ? "https" : "http",
        hostname: apiOrigin.hostname,
        ...(apiOrigin.port ? { port: apiOrigin.port } : {}),
        pathname: "/media/**",
      },
      {
        protocol: "https",
        hostname: "www.andeanperutours.com",
        pathname: "/images/**",
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
          ...(process.env.NODE_ENV === "production" ? [{ key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" }] : []),
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
