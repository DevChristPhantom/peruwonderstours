// @ts-check
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

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

/** @type {import('next').NextConfig} */
const nextConfig = {
  distDir: process.env.PWT_DEMO_BUILD === "1" ? ".next-demo" : ".next",
  transpilePackages: ["@pwt/ui"],
  outputFileTracingRoot: path.join(__dirname, "../.."),
  poweredByHeader: false,
  experimental: {
    // proxy.ts buffers request bodies; the default 10 MB cut silently truncated banner videos
    // Allow the complete multipart body: 50 MiB video + 16 MiB poster + fields.
    // The authenticated BFF retains its stricter 66 MiB + 64 KiB limit.
    proxyClientMaxBodySize: "68mb",
  },
  async headers() {
    return [{ source: "/:path*", headers: common }];
  },
};

export default nextConfig;
