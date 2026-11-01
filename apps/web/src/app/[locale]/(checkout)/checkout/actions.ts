"use server";

import { revalidateTag } from "next/cache";

import { checkout } from "@/lib/api/bookings";
import { toUserError } from "@/lib/api/problems";
import { requestLocale } from "@/lib/i18n/request-locale";
import type { Locale } from "@/i18n/routing";
import {
  COUNTRY_ISO,
  placeInputSchema,
  prepareInputSchema,
  providerConfirmSchema,
  type ActionResult,
  type CheckoutQuote,
  type PlaceResult,
} from "@/lib/checkout/api-checkout";
import { CheckoutFailure, confirmProviderPayment, failureFrom, payBooking, prepareQuote } from "@/lib/checkout/checkout-service";
import type { ProviderPaymentOutcome } from "@/lib/payments/types";
import {
  clearAttempt,
  clearCartSession,
  newIdempotencyKey,
  readAttempt,
  readBookingToken,
  readCartSession,
  writeAttempt,
  writeBookingToken,
  type CheckoutAttempt,
} from "@/lib/checkout/session";

/**
 * Server Actions del checkout (BFF). El navegador solo envía lo que el viajero eligió; los tokens
 * de carrito/reserva y las claves de idempotencia viven en cookies httpOnly (lib/checkout/session.ts).
 */

function fail<T>(error: unknown, locale: Locale): ActionResult<T> {
  const f = failureFrom(error, locale);
  return { ok: false, error: f.error, ...f.extra };
}

/** Paso 3: crea/revalida el carrito en la API y devuelve precios, cupos y opciones de pago vigentes. */
export async function prepareCheckoutAction(raw: unknown): Promise<ActionResult<CheckoutQuote>> {
  const locale = await requestLocale();
  const parsed = prepareInputSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: toUserError("validation-failed", undefined, locale) };
  try {
    return { ok: true, data: await prepareQuote(parsed.data, locale) };
  } catch (error) {
    return fail(error, locale);
  }
}

/**
 * Confirmar y pagar: POST /bookings (hold de cupos, Idempotency-Key estable por intento) →
 * cookie httpOnly con el token de la reserva → cobro sandbox confirmado desde el servidor.
 * Reintentos y doble clic reutilizan la misma clave (cookie `pwt_checkout_attempt`).
 */
export async function placeBookingAction(raw: unknown): Promise<ActionResult<PlaceResult>> {
  const locale = await requestLocale();
  const parsed = placeInputSchema.safeParse(raw);
  if (!parsed.success) {
    const terms = parsed.error.issues.some((i) => i.path[0] === "acceptTerms" || i.path[0] === "acceptPrivacy");
    return { ok: false, error: toUserError(terms ? "consent-required" : "validation-failed", undefined, locale) };
  }
  const input = parsed.data;

  try {
    const [cart, previous] = await Promise.all([readCartSession(), readAttempt()]);
    let attempt: CheckoutAttempt | null = previous;

    // Reserva ya retenida para este pedido (reintento de pago): no se crea otra.
    const resumable = attempt?.booking && (!cart || cart.id === attempt.cartId) ? attempt : null;

    if (!resumable) {
      if (!cart) throw new CheckoutFailure(toUserError("cart-expired", undefined, locale), { requote: true });
      const sameOrder =
        attempt && attempt.cartId === cart.id && attempt.option === input.option && attempt.total === input.expectedTotalCents;
      attempt = sameOrder
        ? attempt
        : { cartId: cart.id, fp: cart.fp, key: newIdempotencyKey(), option: input.option, total: input.expectedTotalCents };
      // Se guarda ANTES de llamar a la API: si la respuesta se pierde, el reintento reusa la clave.
      await writeAttempt(attempt!);

      const result = await checkout({
        cartId: cart.id,
        cartToken: cart.token,
        idempotencyKey: attempt!.key,
        paymentOption: input.option,
        customer: {
          email: input.contact.email,
          phone: input.contact.phone,
          firstName: input.contact.firstName,
          lastName: input.contact.lastName,
          country: COUNTRY_ISO[input.contact.country],
        },
        customerNotes: input.notes?.slice(0, 2000),
        expectedTotalAmount: input.expectedTotalCents,
        // Los correos de confirmación salen en el idioma en que se hizo la reserva.
        locale,
        marketingEmailOptIn: input.contact.marketingEmail,
        marketingWhatsappOptIn: input.contact.marketingWhatsapp,
      });
      if (!result.accessToken) {
        // Contrato pendiente del backend: sin token no podemos mostrar la reserva de forma segura.
        console.error(`[checkout] La API no devolvió accessToken para ${result.booking.code}.`);
        throw new CheckoutFailure(
          {
            code: "booking-token-missing",
            kind: "other",
            message:
              locale === "pt"
                ? `Salvamos sua reserva ${result.booking.code}, mas não foi possível abri-la aqui. Entraremos em contato por e-mail e WhatsApp para concluir o pagamento.`
                : locale === "en"
                ? `We saved your booking ${result.booking.code}, but could not open it here. We will contact you by email and WhatsApp to complete the payment.`
                : `Guardamos tu reserva ${result.booking.code}, pero no pudimos abrirla aquí. Te escribiremos por correo y WhatsApp para completar el pago.`,
          },
          { bookingCode: result.booking.code },
        );
      }
      // La reserva retuvo cupos: el calendario (caché de 60 s compartida) no debe seguir ofreciéndolos.
      if (!result.replayed) revalidateTag("departures", { expire: 0 });
      attempt = { ...attempt!, booking: { id: result.booking.id, code: result.booking.code, token: result.accessToken } };
      await writeAttempt(attempt);
      await writeBookingToken(result.booking.code, result.accessToken);
      await clearCartSession(); // el carrito de la API ya quedó convertido en reserva
    }

    const booking = attempt!.booking!;
    const payKey = attempt!.payKey ?? newIdempotencyKey();
    await writeAttempt({ ...attempt!, payKey });

    let outcome: Awaited<ReturnType<typeof payBooking>>;
    try {
      outcome = await payBooking({ bookingCode: booking.code, token: booking.token, payKey, method: input.method, simulate: input.simulate });
    } catch (error) {
      const f = failureFrom(error, locale);
      throw new CheckoutFailure(f.error, { bookingCode: booking.code });
    }

    if (outcome === "failed") {
      // Nueva clave para el siguiente intento: la anterior ya quedó asociada a un cobro rechazado.
      await writeAttempt({ ...attempt!, payKey: undefined });
      throw new CheckoutFailure(toUserError("payment-rejected", undefined, locale), { bookingCode: booking.code });
    }
    // Izipay: el cobro queda abierto con la misma clave hasta que el formulario responda.
    if (typeof outcome === "object") return { ok: true, data: { code: booking.code, payment: "action", action: outcome } };

    await clearAttempt();
    return { ok: true, data: { code: booking.code, payment: outcome } };
  } catch (error) {
    return fail(error, locale);
  }
}

/**
 * Respuesta del formulario de Izipay → la API verifica la firma y aplica el pago.
 * `open`: el viajero cerró el formulario sin pagar; la reserva sigue retenida y puede reintentar.
 */
export async function confirmCheckoutPaymentAction(raw: unknown): Promise<ActionResult<{ payment: Exclude<ProviderPaymentOutcome, "failed"> }>> {
  const locale = await requestLocale();
  const parsed = providerConfirmSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: toUserError("validation-failed", undefined, locale) };
  const { code, paymentId, payloadHttp, signature } = parsed.data;
  try {
    const attempt = await readAttempt();
    const token = (await readBookingToken(code)) ?? (attempt?.booking?.code === code ? attempt.booking.token : null);
    if (!token) return { ok: false, error: toUserError("booking-not-found", undefined, locale) };
    const outcome = await confirmProviderPayment({ bookingCode: code, token, paymentId, payloadHttp, signature });
    if (outcome === "failed") {
      if (attempt?.booking?.code === code) await writeAttempt({ ...attempt, payKey: undefined });
      return { ok: false, error: toUserError("payment-rejected", undefined, locale), bookingCode: code };
    }
    if (outcome !== "open" && attempt?.booking?.code === code) await clearAttempt();
    return { ok: true, data: { payment: outcome } };
  } catch (error) {
    const f = failureFrom(error, locale);
    return { ok: false, error: f.error, bookingCode: code };
  }
}
