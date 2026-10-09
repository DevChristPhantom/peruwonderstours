import "server-only";

import { randomUUID } from "node:crypto";
import { cookies } from "next/headers";
import { z } from "zod";

import { isProduction } from "@/lib/env";

/**
 * Estado del checkout guardado SOLO en cookies httpOnly del dominio de la web (BFF).
 * El navegador no puede leer los tokens de la API (carrito / reserva) ni las claves de idempotencia.
 * Las cookies solo se escriben desde Server Actions.
 */

const CHECKOUT_PATH = "/es/checkout";
const BOOKING_PATH = "/es/reserva";
/**
 * La cookie del token de la reserva vive en `/es` (H-17): la leen la página de la reserva y el Libro de
 * Reclamaciones (para vincular el reclamo de forma verificada). Sigue siendo httpOnly + SameSite.
 */
const BOOKING_TOKEN_PATH = "/es";

const base = { httpOnly: true, sameSite: "lax" as const, secure: isProduction };

const CART_COOKIE = "pwt_cart";
const ATTEMPT_COOKIE = "pwt_checkout_attempt";
const bookingCookie = (code: string) => `pwt_bk_${code}`;
const payKeyCookie = (code: string) => `pwt_pay_${code}`;

/** Código de reserva válido para usar en nombres de cookie y rutas (PWT-2026-000123). */
export const BOOKING_CODE_RE = /^[A-Z0-9][A-Z0-9-]{3,39}$/;

function encode(value: unknown): string {
  return Buffer.from(JSON.stringify(value), "utf8").toString("base64url");
}

function decode<T>(raw: string | undefined, schema: z.ZodType<T>): T | null {
  if (!raw) return null;
  try {
    const parsed = schema.safeParse(JSON.parse(Buffer.from(raw, "base64url").toString("utf8")));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

/* ---------- Carrito de la API ---------- */

const cartSchema = z.object({ id: z.uuid(), token: z.string().min(8).max(200), fp: z.string().max(128) });
export type CartSession = z.infer<typeof cartSchema>;

export async function readCartSession(): Promise<CartSession | null> {
  return decode((await cookies()).get(CART_COOKIE)?.value, cartSchema);
}

export async function writeCartSession(session: CartSession): Promise<void> {
  (await cookies()).set(CART_COOKIE, encode(session), { ...base, path: CHECKOUT_PATH, maxAge: 7 * 24 * 3600 });
}

export async function clearCartSession(): Promise<void> {
  (await cookies()).set(CART_COOKIE, "", { ...base, path: CHECKOUT_PATH, maxAge: 0 });
}

/* ---------- Intento de checkout (idempotencia ante reintentos y doble clic) ---------- */

const attemptSchema = z.object({
  cartId: z.uuid(),
  /** Huella del pedido (tours, fechas, viajeros, moneda, residencia). */
  fp: z.string().max(128),
  /** Idempotency-Key de POST /bookings, estable mientras no cambie el pedido. */
  key: z.string().min(8).max(100),
  option: z.enum(["deposit", "full"]),
  total: z.number().int().nonnegative(),
  booking: z.object({ id: z.uuid(), code: z.string().regex(BOOKING_CODE_RE), token: z.string().min(8).max(500) }).optional(),
  /** Idempotency-Key del intento de pago en curso (se rota tras un rechazo). */
  payKey: z.string().min(8).max(100).optional(),
});
export type CheckoutAttempt = z.infer<typeof attemptSchema>;

/** Vida corta: lo que dura el hold de cupos (15 min) con margen. */
const ATTEMPT_MAX_AGE = 30 * 60;

export async function readAttempt(): Promise<CheckoutAttempt | null> {
  return decode((await cookies()).get(ATTEMPT_COOKIE)?.value, attemptSchema);
}

export async function writeAttempt(attempt: CheckoutAttempt): Promise<void> {
  (await cookies()).set(ATTEMPT_COOKIE, encode(attempt), { ...base, path: CHECKOUT_PATH, maxAge: ATTEMPT_MAX_AGE });
}

export async function clearAttempt(): Promise<void> {
  (await cookies()).set(ATTEMPT_COOKIE, "", { ...base, path: CHECKOUT_PATH, maxAge: 0 });
}

export function newIdempotencyKey(): string {
  return randomUUID();
}

/* ---------- Token de acceso a la reserva ---------- */

export async function writeBookingToken(code: string, token: string): Promise<void> {
  if (!BOOKING_CODE_RE.test(code)) return;
  (await cookies()).set(bookingCookie(code), token, { ...base, path: BOOKING_TOKEN_PATH, maxAge: 30 * 24 * 3600 });
}

export async function readBookingToken(code: string): Promise<string | null> {
  if (!BOOKING_CODE_RE.test(code)) return null;
  const value = (await cookies()).get(bookingCookie(code))?.value;
  return value && value.length >= 8 && value.length <= 500 ? value : null;
}

/** Clave de idempotencia del pago desde la página de la reserva (doble clic / reintento). */
export async function readOrCreatePayKey(code: string): Promise<string> {
  const store = await cookies();
  const existing = store.get(payKeyCookie(code))?.value;
  if (existing && /^[0-9a-f-]{36}$/.test(existing)) return existing;
  const key = newIdempotencyKey();
  store.set(payKeyCookie(code), key, { ...base, path: BOOKING_PATH, maxAge: 10 * 60 });
  return key;
}

export async function clearPayKey(code: string): Promise<void> {
  (await cookies()).set(payKeyCookie(code), "", { ...base, path: BOOKING_PATH, maxAge: 0 });
}
