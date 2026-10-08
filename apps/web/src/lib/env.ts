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
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
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
