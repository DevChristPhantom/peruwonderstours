import "server-only";

import { createHash } from "node:crypto";

import { confirmPayment, createPayment, getBookingByCode, type Booking, type PaymentMethod } from "@/lib/api/bookings";
import {
  addCartItem,
  createCart,
  getBookableTour,
  getPaymentOptions,
  listDepartures,
  recalculateCart,
  type AddItemInput,
  type ApiCart,
  type ApiCurrency,
  type ApiPlan,
  type Residency,
} from "@/lib/api/carts";
import { ApiError } from "@/lib/api/client";
import type { Locale } from "@/i18n/routing";
import { cartIssueMessage, toUserError, type UserError } from "@/lib/api/problems";
import { env } from "@/lib/env";

import type { CheckoutQuote, PlanView, PrepareInput, QuoteIssue, QuoteLine } from "./api-checkout";
import { readAttempt, readCartSession, writeCartSession, clearCartSession, clearAttempt } from "./session";

/** Error de negocio ya traducido, para cortar el flujo de una Server Action. */
export class CheckoutFailure extends Error {
  constructor(
    readonly error: UserError,
    readonly extra: { requote?: boolean; bookingCode?: string } = {},
  ) {
    super(error.message);
  }
}

export function failureFrom(error: unknown, locale: Locale = "es"): CheckoutFailure {
  if (error instanceof CheckoutFailure) return error;
  if (error instanceof ApiError) {
    const requote = ["total-changed", "cart-has-issues", "sold-out"].includes(error.code);
    return new CheckoutFailure(toUserError(error.code, error.status < 500 ? error.problem?.detail : undefined, locale), { requote });
  }
  console.error("[checkout] error inesperado", error);
  return new CheckoutFailure(toUserError("api-unavailable", undefined, locale));
}

export function residencyFor(country: string): Residency {
  return country.trim().toLowerCase() === "perú" || country.trim().toLowerCase() === "peru" ? "national" : "foreign";
}

export function orderFingerprint(input: PrepareInput, currency: ApiCurrency): string {
  const lines = input.lines
    .map((l) => [l.tourSlug, l.date, l.travelers.adults, l.travelers.children, l.travelers.infants].join(":"))
    .sort();
  return createHash("sha256")
    .update(JSON.stringify({ lines, currency, residency: residencyFor(input.country) }))
    .digest("base64url");
}

const lineKey = (slug: string | null, date: string) => `${slug ?? ""}__${date}`;

function planView(plan: ApiPlan | null): PlanView | null {
  if (!plan) return null;
  return {
    depositPercent: plan.option === "full" ? 100 : plan.depositPercent,
    payNowCents: plan.payNow.amount,
    balanceCents: plan.balance.amount,
    balanceDueAt: plan.balanceDueAt,
  };
}

/** Agrega un tour del carrito local al carrito de la API (resuelve id del tour y la salida). */
async function addLine(
  cartId: string,
  token: string,
  line: PrepareInput["lines"][number],
  currency: ApiCurrency,
  residency: Residency,
  locale: Locale,
): Promise<{ cart: ApiCart | null; issue: QuoteIssue | null }> {
  const err = (code: string, detail?: string) => toUserError(code, detail, locale).message;
  const issue = (message: string): { cart: null; issue: QuoteIssue } => ({ cart: null, issue: { lineId: line.id, message: `${line.title}: ${message}`, blocking: true } });

  const tour = await getBookableTour(line.tourSlug, currency);
  if (!tour) return issue(err("tour-not-found"));
  if (!tour.bookable) return issue(err("rate-not-available"));

  const pax: AddItemInput["pax"] = [
    { paxType: "adult" as const, residency, quantity: line.travelers.adults },
    { paxType: "child" as const, residency, quantity: line.travelers.children },
  ].filter((p) => p.quantity > 0);
  // La API no tiene tipo "bebé": los menores de 2 años viajan sin costo y se informan en las notas.
  if (pax.length === 0) return issue(err("minor-without-adult"));

  const input: AddItemInput = { tourId: tour.id, travelDate: line.date, pax };
  try {
    return { cart: await addCartItem(cartId, token, input), issue: null };
  } catch (error) {
    if (!(error instanceof ApiError)) throw error;
    if (error.code === "departure-required") {
      // Varias salidas ese día: se elige la primera abierta con cupo suficiente.
      const needed = pax.reduce((n, p) => n + p.quantity, 0);
      const departures = await listDepartures(line.tourSlug, line.date);
      const pick = departures.find((d) => !d.isClosed && (d.available === null || d.available >= needed));
      if (!pick) return issue(err("sold-out"));
      try {
        return { cart: await addCartItem(cartId, token, { ...input, departureId: pick.id }), issue: null };
      } catch (retry) {
        if (retry instanceof ApiError && !retry.unavailable) return issue(err(retry.code, retry.problem?.detail));
        throw retry;
      }
    }
    if (error.unavailable) throw error;
    return issue(err(error.code, error.problem?.detail));
  }
}

function quoteFromCart(cart: ApiCart, input: PrepareInput, extraIssues: QuoteIssue[], locale: Locale): Omit<CheckoutQuote, "plans" | "booking"> {
  const byKey = new Map(input.lines.map((l) => [lineKey(l.tourSlug, l.date), l]));
  const byItem = new Map<string, string>();
  const lines: QuoteLine[] = cart.items.map((item) => {
    const local = byKey.get(lineKey(item.tourSlug, item.travelDate));
    const lineId = local?.id ?? item.id;
    byItem.set(item.id, lineId);
    const apiIssue = cart.issues.find((i) => i.itemId === item.id && i.type === "price_changed");
    const expected = local && local.currency === cart.currency ? local.expectedCents : null;
    const previousCents = apiIssue?.previousSubtotal?.amount ?? expected;
    const priceChanged = previousCents !== null && previousCents !== item.subtotal.amount;
    return {
      lineId,
      title: item.tourTitle ?? local?.title ?? "Tour",
      date: item.travelDate,
      subtotalCents: item.subtotal.amount,
      expectedCents: expected,
      previousCents: priceChanged ? previousCents : null,
      priceChanged,
    };
  });
  const issues: QuoteIssue[] = [
    ...extraIssues,
    ...cart.issues
      .filter((i) => i.type !== "price_changed" || i.blocking)
      .map((i) => {
        const line = lines.find((l) => l.lineId === byItem.get(i.itemId));
        return { lineId: line?.lineId ?? null, message: cartIssueMessage(i.type, i.code, line?.title ?? "Tour", locale), blocking: i.blocking };
      }),
  ];
  const priceChanged = lines.some((l) => l.priceChanged);
  return {
    currency: cart.currency,
    totalCents: cart.total.amount,
    lines,
    issues,
    priceChanged,
    canCheckout: cart.canCheckout && !issues.some((i) => i.blocking),
  };
}

function quoteFromBooking(booking: Booking): CheckoutQuote {
  const payNow = booking.nextPayment?.amount.amount ?? 0;
  const plan: PlanView = {
    depositPercent: booking.paymentOption === "full" ? 100 : booking.depositPercent,
    payNowCents: payNow,
    balanceCents: Math.max(0, booking.outstanding.amount - payNow),
    balanceDueAt: booking.balanceDueAt,
  };
  return {
    currency: booking.currency,
    totalCents: booking.total.amount,
    lines: booking.items.map((i) => ({
      lineId: i.id,
      title: i.tourTitle,
      date: i.travelDate,
      subtotalCents: i.subtotal.amount,
      expectedCents: null,
      previousCents: null,
      priceChanged: false,
    })),
    issues: [],
    priceChanged: false,
    canCheckout: booking.nextPayment !== null,
    plans: {
      deposit: booking.paymentOption === "deposit" ? plan : null,
      full: booking.paymentOption === "full" ? plan : null,
      depositUnavailableReason: null,
    },
    booking: { code: booking.code, option: booking.paymentOption, holdExpiresAt: booking.holdExpiresAt },
  };
}

/**
 * Sincroniza el carrito local (Zustand) con un carrito de la API y lo revalida (precio y cupo).
 * Reutiliza el carrito de la cookie si el pedido no cambió; si cambió, crea uno nuevo.
 */
export async function prepareQuote(input: PrepareInput, locale: Locale = "es"): Promise<CheckoutQuote> {
  const currency: ApiCurrency = input.lines.find((l) => l.currency)?.currency ?? env.CATALOG_CURRENCY;
  const fp = orderFingerprint(input, currency);
  const residency = residencyFor(input.country);

  // ¿Ya hay una reserva retenida para este mismo pedido (p. ej. tras un pago rechazado)?
  const attempt = await readAttempt();
  if (attempt?.booking && attempt.fp === fp) {
    const booking = await getBookingByCode(attempt.booking.code, attempt.booking.token);
    if (booking && booking.nextPayment && (booking.status === "held" || booking.status === "pending")) {
      return quoteFromBooking(booking);
    }
  }
  if (attempt && attempt.fp !== fp) await clearAttempt();

  const session = await readCartSession();
  let cart: ApiCart | null = null;
  let token = session?.token ?? "";
  if (session && session.fp === fp) {
    try {
      cart = await recalculateCart(session.id, session.token);
      if (cart.status !== "active") cart = null;
    } catch (error) {
      if (error instanceof ApiError && error.unavailable) throw error;
      cart = null; // expirado, ya convertido en reserva o token inválido → carrito nuevo
    }
  }

  const issues: QuoteIssue[] = [];
  if (!cart) {
    await clearAttempt();
    const created = await createCart(currency);
    token = created.token;
    cart = created.cart;
    for (const line of input.lines) {
      const added = await addLine(cart.id, token, line, currency, residency, locale);
      if (added.cart) cart = added.cart;
      if (added.issue) issues.push(added.issue);
    }
    if (issues.length === 0) await writeCartSession({ id: cart.id, token, fp });
    else await clearCartSession();
  }

  const base = quoteFromCart(cart, input, issues, locale);
  let plans: CheckoutQuote["plans"] = null;
  if (cart.items.length > 0) {
    const options = await getPaymentOptions(cart.id, token);
    plans = {
      deposit: options.depositAvailable ? planView(options.deposit) : null,
      full: planView(options.full),
      depositUnavailableReason: options.depositUnavailableReason,
    };
  }
  return { ...base, plans, booking: null };
}

/** Crea el cobro de la reserva y lo confirma con la pasarela (sandbox) desde el servidor. */
export async function payBooking(params: {
  bookingCode: string;
  token: string;
  payKey: string;
  method: PaymentMethod;
  simulate: "approved" | "rejected" | "pending";
}): Promise<"succeeded" | "pending" | "failed"> {
  const { payment } = await createPayment(params.bookingCode, params.token, params.payKey, params.method);
  if (payment.status === "succeeded") return "succeeded";
  if (payment.status === "failed" || payment.status === "cancelled" || payment.status === "expired") return "failed";
  // PagoEfectivo (CIP): el intento queda pendiente hasta que el proveedor avise por webhook.
  if (params.simulate === "pending") return "pending";
  const confirmed = await confirmPayment(params.bookingCode, payment.id, params.token, {
    simulate: params.simulate === "rejected" ? "fail" : "succeed",
  });
  if (confirmed.status === "succeeded") return "succeeded";
  if (confirmed.status === "failed" || confirmed.status === "cancelled" || confirmed.status === "expired") return "failed";
  return "pending";
}
