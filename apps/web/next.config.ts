import { readFileSync } from "node:fs";
import path from "node:path";
import type { NextConfig } from "next";

// Se lee relativo a este archivo (no al cwd) para que `next dev apps/web` funcione desde cualquier carpeta.
const legacyRedirects = JSON.parse(
  readFileSync(path.join(__dirname, "../../data/seed/redirects.json"), "utf8"),
) as { rules: { from: string; to: string }[] };

/**
 * Redirecciones 301 del sitio viejo que cambian de ruta en el dominio nuevo.
 * Las reglas cuyo path de origen coincide con el destino no necesitan regla (mismo slug).
 * Fuente: data/seed/redirects.json (HU-0.2).
 */
function buildLegacyRedirects() {
  const rules: { source: string; destination: string; statusCode: 301 }[] = [];
  for (const rule of legacyRedirects.rules) {
    const source = new URL(rule.from).pathname;
    if (source === rule.to) continue;
    rules.push({ source, destination: rule.to, statusCode: 301 });
  }
  return rules;
}

const nextConfig: NextConfig = {
  transpilePackages: ["@pwt/ui"],
  // Monorepo pnpm: la raíz incluye data/seed y packages/ui.
  outputFileTracingRoot: path.join(__dirname, "../.."),
  // Borradores legales leídos con fs (lib/legal/documents.ts) al regenerar las páginas de políticas.
  outputFileTracingIncludes: {
    "/es/politicas/**": ["../../docs/legal/**/*.md"],
  },
  images: {
    formats: ["image/avif", "image/webp"],
    // TEMPORAL (HU-0.3): fotos del cliente servidas desde su sitio actual hasta re-alojarlas.
    remotePatterns: [
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

export default nextConfig;
