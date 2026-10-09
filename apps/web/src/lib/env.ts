import "server-only";

import { z } from "zod";

/**
 * Variables de entorno del SERVIDOR (BFF). Nunca se exponen al navegador: no llevan prefijo
 * `NEXT_PUBLIC_` y este módulo importa `server-only`.
 *
 * - `API_BASE_URL`: base de la API NestJS **incluyendo** `/api/v1`.
 * - `CATALOG_SOURCE`: `api` (por defecto) lee el catálogo de la API con caché por tag `catalog`;
 *   `seed` usa `data/seed/*.json` (demo sin backend). Con `api`, si la API no responde se cae
 *   al seed por petición (ver `lib/catalog/api-repository.ts`).
 * - `CATALOG_CURRENCY`: moneda en que se piden los precios "desde" del catálogo.
 * - `PWT_API_TIMEOUT_MS`: tope por petición a la API.
 * - `TRUSTED_PROXY_HOPS` (H-07): proxies de confianza delante de Next. 0 = no se reenvía la IP del
 *   visitante (X-Forwarded-For del cliente es falsificable); N >= 1 = se toma la entrada N-ésima desde
 *   la derecha de X-Forwarded-For, la que agrega el proxy de entrada. El proxy de entrada DEBE
 *   sobrescribir/anexar la cabecera con la IP del socket (nginx: `proxy_set_header X-Forwarded-For $remote_addr`).
 * - `CSP_REPORT_ONLY`: `true` envía la CSP como Report-Only (para probar antes de exigirla).
 * - `CARD_FEE_PERCENT`: comisión por tarjeta (RN-03, p. ej. 3.5). Sin definir = no se muestra.
 *   Activarla SOLO cuando la API también la cobre (hoy no lo hace).
 */
const schema = z.object({
  API_BASE_URL: z
    .url({ protocol: /^https?$/, error: "API_BASE_URL debe ser una URL http(s) que incluya /api/v1." })
    .default("http://localhost:3001/api/v1")
    .transform((value) => value.replace(/\/+$/, "")),
  CATALOG_SOURCE: z.enum(["api", "seed"]).default("api"),
  CATALOG_CURRENCY: z.enum(["PEN", "USD"]).default("PEN"),
  PWT_API_TIMEOUT_MS: z.coerce.number().int().min(500).max(60_000).default(8_000),
  CARD_FEE_PERCENT: z.coerce.number().min(0).max(10).optional(),
  TRUSTED_PROXY_HOPS: z.coerce.number().int().min(0).max(5).default(0),
  /** Solo para probar `next start` en local contra la API http. Prohibido en un entorno público. */
  API_ALLOW_HTTP: z
    .enum(["true", "false"])
    .default("false")
    .transform((v) => v === "true"),
  CSP_REPORT_ONLY: z
    .enum(["true", "false"])
    .default("false")
    .transform((v) => v === "true"),
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
})
  // H-19: en producción el BFF solo habla con la API por HTTPS (los tokens viajan en cabeceras).
  .refine((v) => v.NODE_ENV !== "production" || v.API_BASE_URL.startsWith("https://") || v.API_ALLOW_HTTP || process.env.NEXT_PHASE === "phase-production-build", {
    path: ["API_BASE_URL"],
    message: "En producción API_BASE_URL debe usar https://.",
  });

export type ServerEnv = z.infer<typeof schema>;

function load(): ServerEnv {
  // Valores vacíos ("API_BASE_URL=") cuentan como no definidos para aplicar el valor por defecto.
  const raw = Object.fromEntries(
    Object.entries(process.env).filter(([, value]) => value !== undefined && value !== ""),
  );
  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    const detail = parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ");
    throw new Error(`Configuración inválida de apps/web: ${detail}`);
  }
  return parsed.data;
}

export const env: ServerEnv = load();

export const isProduction = env.NODE_ENV === "production";
