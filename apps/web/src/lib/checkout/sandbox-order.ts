import type { CartLine } from "@/lib/cart/types";
import type { Currency } from "@/lib/catalog/types";
import { safeSessionStorage } from "@/stores/safe-storage";
import type { PaymentOption, PaymentPlan } from "./payment-plan";

/**
 * Orden SANDBOX (solo cliente). Sustituye a `POST /api/v1/bookings` + hold de cupos hasta que exista
 * el backend. La confirmación se guarda en sessionStorage (sin datos de pago, sin documentos).
 */

export type OrderStatus = "confirmed" | "paid" | "pending_payment" | "quote_requested";

export interface OrderConfirmation {
  code: string;
  createdAt: string;
  firstName: string;
  emailMasked: string;
  status: OrderStatus;
  option: PaymentOption;
  payment: { reference: string; methodLabel: string; amountCents: number; currency: Currency } | null;
  pending: { reference: string; instructions: string; expiresAt: string } | null;
  plan: PaymentPlan;
  lines: CartLine[];
  sandbox: true;
}

const KEY = "pwt-last-order";
const ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";

export function createOrderCode(): string {
  const bytes = new Uint8Array(5);
  crypto.getRandomValues(bytes);
  return `PWT-${Array.from(bytes, (b) => ALPHABET[b % ALPHABET.length]).join("")}`;
}

export function maskEmail(email: string): string {
  const [user, domain] = email.split("@");
  if (!domain) return "•••";
  return `${user.slice(0, Math.min(3, user.length))}•••@${domain}`;
}

export function saveConfirmation(order: OrderConfirmation): void {
  safeSessionStorage.setItem(KEY, JSON.stringify(order));
}

export function loadConfirmation(): OrderConfirmation | null {
  const raw = safeSessionStorage.getItem(KEY);
  if (!raw || typeof raw !== "string") return null;
  try {
    const parsed = JSON.parse(raw) as OrderConfirmation;
    return parsed && typeof parsed.code === "string" ? parsed : null;
  } catch {
    return null;
  }
}
