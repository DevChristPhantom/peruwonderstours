import path from "node:path";
import type { NextConfig } from "next";

/**
 * Panel de administración (BFF). Todas las páginas son dinámicas (sesión por cookie) y llevan
 * `noindex` + `no-store`; la CSP con nonce la pone `src/proxy.ts`. Aquí van las cabeceras que
 * también deben acompañar a los estáticos.
 */
const common = [
  { key: "X-Robots-Tag", value: "noindex, nofollow, noarchive" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()" },
  ...(process.env.NODE_ENV === "production" ? [{ key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" }] : []),
];

const nextConfig: NextConfig = {
  transpilePackages: ["@pwt/ui"],
  outputFileTracingRoot: path.join(__dirname, "../.."),
  poweredByHeader: false,
  async headers() {
    return [{ source: "/:path*", headers: common }];
  },
};

export default nextConfig;
