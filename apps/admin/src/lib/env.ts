import { z } from "zod";

/**
 * Variables de entorno del SERVIDOR del panel (BFF). Ninguna lleva `NEXT_PUBLIC_`: nada de esto
 * llega al navegador. Se valida de forma perezosa (primer uso) para que `next build` no exija
 * secretos, pero cualquier petición real falla de inmediato con un mensaje claro si faltan.
 *
 * - `API_BASE_URL`: base de la API NestJS **incluyendo** `/api/v1`.
 * - `ADMIN_SESSION_SECRET`: clave de la cookie de sesión cifrada (AES-256-GCM, HKDF-SHA256).
 *   Mínimo 32 caracteres aleatorios (p. ej. `openssl rand -base64 48`). Rotarla cierra todas las sesiones.
 * - `ADMIN_TRUSTED_ORIGINS`: orígenes extra aceptados en Server Actions (coma), p. ej. detrás de un proxy.
 * - `ADMIN_API_TIMEOUT_MS`: tope por petición a la API.
 * - `TRUSTED_PROXY_HOPS`: cuántos proxies de confianza hay delante de Next (H-07). 0 = expuesto
 *   directo: no se reenvía `X-Forwarded-For` (el cliente podría falsificarla). N >= 1: se toma la
 *   entrada N-ésima desde la derecha, la que agregó el proxy de entrada. El proxy de entrada DEBE
 *   sobrescribir (o anexar) la cabecera con la IP del socket.
 */
const schema = z.object({
  API_BASE_URL: z
    .url({ protocol: /^https?$/, error: "API_BASE_URL debe ser una URL http(s) que incluya /api/v1." })
    .default("http://localhost:3001/api/v1")
    .transform((value) => value.replace(/\/+$/, "")),
  ADMIN_SESSION_SECRET: z
    .string({ error: "Falta ADMIN_SESSION_SECRET (mínimo 32 caracteres aleatorios)." })
    .min(32, "ADMIN_SESSION_SECRET debe tener al menos 32 caracteres.")
    .refine((v) => new Set(v).size >= 10, "ADMIN_SESSION_SECRET parece poco aleatoria."),
  ADMIN_TRUSTED_ORIGINS: z
    .string()
    .optional()
    .transform((v) =>
      (v ?? "")
        .split(",")
        .map((s) => s.trim().replace(/\/+$/, ""))
        .filter(Boolean),
    ),
  ADMIN_API_TIMEOUT_MS: z.coerce.number().int().min(500).max(60_000).default(10_000),
  TRUSTED_PROXY_HOPS: z.coerce.number().int().min(0).max(5).default(0),
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
});

export type AdminEnv = z.infer<typeof schema>;

let cached: AdminEnv | null = null;

export function env(): AdminEnv {
  if (cached) return cached;
  const raw = Object.fromEntries(Object.entries(process.env).filter(([, value]) => value !== undefined && value !== ""));
  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    const detail = parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ");
    throw new Error(`Configuración inválida de apps/admin: ${detail}`);
  }
  cached = parsed.data;
  return cached;
}

export const isProduction = process.env.NODE_ENV === "production";
