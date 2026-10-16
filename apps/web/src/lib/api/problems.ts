import type { Locale } from "@/i18n/routing";

/**
 * Traducción de códigos problem+json de la API (RFC 9457, `code` en kebab-case inglés) a mensajes
 * claros para el viajero, en su idioma (es/en/pt). Módulo puro: lo usa el servidor para armar la
 * respuesta de las Server Actions; el navegador solo recibe `{ code, message }`.
 */

export type UserErrorKind = "sold-out" | "price-changed" | "payment-rejected" | "not-found" | "expired" | "validation" | "busy" | "unavailable" | "other";

export interface UserError {
  code: string;
  kind: UserErrorKind;
  message: string;
  /** Campo del formulario relacionado (para enlazarlo desde el resumen de errores). */
  field?: string;
}

/** Mensaje por código: [tipo, español, inglés]. */
const MESSAGES: Record<string, [UserErrorKind, string, string]> = {
  // Cupo / fechas
  "sold-out": ["sold-out", "Ya no quedan cupos para la fecha elegida. Elige otra fecha en tu carrito.", "There are no seats left for the chosen date. Pick another date in your cart."],
  "sales-closed": ["sold-out", "Las ventas para esa fecha ya cerraron. Elige una fecha posterior.", "Sales for that date are closed. Pick a later date."],
  "no-departure": ["sold-out", "No hay salida programada para esa fecha. Elige otra fecha.", "There is no departure scheduled for that date. Pick another date."],
  "departure-required": ["sold-out", "Hay varias salidas ese día y no pudimos elegir una con cupo. Escríbenos por WhatsApp.", "There are several departures that day and we could not pick one with seats. Message us on WhatsApp."],
  "departure-mismatch": ["sold-out", "La salida elegida ya no corresponde a esa fecha. Elige la fecha otra vez.", "The chosen departure no longer matches that date. Pick the date again."],
  "above-max-pax": ["validation", "Superas el máximo de viajeros permitido para este tour.", "You are above the maximum number of travelers for this tour."],
  "below-min-pax": ["validation", "Este tour necesita más viajeros como mínimo.", "This tour needs more travelers."],
  "minor-without-adult": ["validation", "Los niños deben viajar acompañados de al menos un adulto.", "Children must travel with at least one adult."],
  "invalid-pax-quantity": ["validation", "Revisa la cantidad de viajeros.", "Check the number of travelers."],
  // Precio
  "total-changed": ["price-changed", "El precio de tu reserva cambió. Revisa el nuevo total antes de pagar.", "The price of your booking changed. Check the new total before paying."],
  "cart-has-issues": ["price-changed", "Algunos tours de tu carrito cambiaron de precio o ya no tienen cupo. Revísalos antes de pagar.", "Some tours in your cart changed price or are sold out. Review them before paying."],
  "rate-not-available": ["validation", "Este tour aún no tiene precio para reservar en línea. Consúltalo por WhatsApp.", "This tour does not have an online price yet. Ask us on WhatsApp."],
  "deposit-not-available": ["validation", "Para esta reserva solo está disponible el pago del 100 %.", "Only full payment is available for this booking."],
  // Carrito / reserva
  "cart-not-found": ["expired", "Tu sesión de pago expiró. Vuelve a revisar tu carrito para continuar.", "Your checkout session expired. Review your cart again to continue."],
  "cart-expired": ["expired", "Tu sesión de pago expiró. Vuelve a revisar tu carrito para continuar.", "Your checkout session expired. Review your cart again to continue."],
  "cart-not-active": ["expired", "Este pedido ya se procesó. Revisa tu correo o tu reserva.", "This order was already processed. Check your email or your booking."],
  "cart-already-checked-out": ["expired", "Este pedido ya se convirtió en una reserva. Revisa tu correo.", "This order is already a booking. Check your email."],
  "cart-empty": ["validation", "Tu carrito está vacío.", "Your cart is empty."],
  "cart-full": ["validation", "Tu carrito tiene demasiados tours. Divide la reserva en dos.", "Your cart has too many tours. Split the booking in two."],
  "cart-item-duplicate": ["validation", "Tienes el mismo tour y fecha repetidos en el carrito.", "You have the same tour and date twice in your cart."],
  "tour-not-found": ["not-found", "Este tour ya no está disponible para reservar en línea.", "This tour is no longer available to book online."],
  "booking-not-found": ["not-found", "No encontramos la reserva.", "We could not find the booking."],
  "hold-expired": ["expired", "Se venció el tiempo para pagar y liberamos tus cupos. Vuelve al carrito para intentarlo de nuevo.", "The time to pay ran out and we released your seats. Go back to the cart to try again."],
  "booking-not-payable": ["expired", "Esta reserva ya no admite pagos. Escríbenos por WhatsApp si necesitas ayuda.", "This booking no longer accepts payments. Message us on WhatsApp if you need help."],
  "booking-already-paid": ["other", "Tu reserva ya está pagada.", "Your booking is already paid."],
  // Pago
  "payment-rejected": ["payment-rejected", "Tu banco rechazó el pago. No se te cobró nada; prueba con otra tarjeta o con Yape.", "Your bank declined the payment. You were not charged; try another card or Yape."],
  "payment-gateway-error": ["unavailable", "La pasarela de pagos no respondió. No se te cobró nada; intenta de nuevo en unos minutos.", "The payment gateway did not respond. You were not charged; try again in a few minutes."],
  "payment-not-found": ["not-found", "No encontramos el pago. Intenta de nuevo.", "We could not find the payment. Try again."],
  // Consentimiento / datos
  "consent-required": ["validation", "Acepta los Términos y la Política de privacidad para continuar.", "Accept the Terms and the Privacy Policy to continue."],
  "invalid-email": ["validation", "Revisa el correo electrónico.", "Check the email address."],
  "invalid-country": ["validation", "Revisa el país de residencia.", "Check the country of residence."],
  "validation-failed": ["validation", "Revisa los datos ingresados.", "Check the information you entered."],
  // Concurrencia / disponibilidad
  "idempotency-in-progress": ["busy", "Ya estamos procesando tu pago. Espera unos segundos sin cerrar esta página.", "We are already processing your payment. Wait a few seconds without closing this page."],
  "concurrency-conflict": ["busy", "Hubo mucha demanda al mismo tiempo. Intenta de nuevo.", "There was a lot of demand at the same time. Try again."],
  "idempotency-key-reused": ["other", "Tu pedido cambió mientras se procesaba. Revisa el resumen e intenta de nuevo.", "Your order changed while it was being processed. Check the summary and try again."],
  "too-many-requests": ["busy", "Hiciste varios intentos seguidos. Espera un minuto e inténtalo de nuevo; no se te cobró nada.", "You made several attempts in a row. Wait a minute and try again; you were not charged."],
  "http-429": ["busy", "Hiciste varios intentos seguidos. Espera un minuto e inténtalo de nuevo; no se te cobró nada.", "You made several attempts in a row. Wait a minute and try again; you were not charged."],
  "payload-too-large": ["validation", "El texto enviado es demasiado largo. Acórtalo e intenta de nuevo.", "The text you sent is too long. Shorten it and try again."],
  "booking-token-required": ["not-found", "No encontramos la reserva.", "We could not find the booking."],
  // Código genérico de 404 (antes `no-encontrado`).
  "not-found": ["not-found", "No encontramos lo que buscabas. Revisa los datos e intenta de nuevo.", "We could not find what you were looking for. Check the details and try again."],
  // Enlace de acceso de un solo uso ya usado o vencido (410).
  "access-link-expired": ["expired", "Este enlace ya se usó o venció. Pide uno nuevo con tu código y correo.", "This link was already used or expired. Request a new one with your code and email."],
  "api-unavailable": ["unavailable", "No pudimos conectar con el sistema de reservas. No se te cobró nada; intenta de nuevo en unos minutos.", "We could not reach the booking system. You were not charged; try again in a few minutes."],
};

const GENERIC: Record<Locale, string> = {
  es: "No pudimos completar la operación. Intenta de nuevo o escríbenos por WhatsApp.",
  en: "We could not complete the operation. Try again or message us on WhatsApp.",
  pt: "Não foi possível concluir a operação. Tente novamente ou fale conosco pelo WhatsApp.",
};

const PORTUGUESE_MESSAGES: Record<string, string> = {
  "sold-out": "Não há mais vagas para a data escolhida. Escolha outra data no carrinho.",
  "sales-closed": "As vendas para essa data já foram encerradas. Escolha uma data posterior.",
  "no-departure": "Não há saída programada para essa data. Escolha outra data.",
  "departure-required": "Há várias saídas nesse dia e não foi possível escolher uma com vagas. Fale conosco pelo WhatsApp.",
  "departure-mismatch": "A saída escolhida não corresponde mais a essa data. Escolha a data novamente.",
  "above-max-pax": "Você excedeu o número máximo de viajantes permitido para este passeio.",
  "below-min-pax": "Este passeio exige um número mínimo maior de viajantes.",
  "minor-without-adult": "As crianças devem viajar acompanhadas de pelo menos um adulto.",
  "invalid-pax-quantity": "Confira o número de viajantes.",
  "total-changed": "O preço da sua reserva mudou. Confira o novo total antes de pagar.",
  "cart-has-issues": "Alguns passeios do seu carrinho mudaram de preço ou não têm mais vagas. Confira antes de pagar.",
  "rate-not-available": "Este passeio ainda não tem preço para reserva on-line. Consulte pelo WhatsApp.",
  "deposit-not-available": "Esta reserva permite apenas o pagamento integral.",
  "cart-not-found": "Sua sessão de pagamento expirou. Confira seu carrinho novamente para continuar.",
  "cart-expired": "Sua sessão de pagamento expirou. Confira seu carrinho novamente para continuar.",
  "cart-not-active": "Este pedido já foi processado. Confira seu e-mail ou sua reserva.",
  "cart-already-checked-out": "Este pedido já foi convertido em uma reserva. Confira seu e-mail.",
  "cart-empty": "Seu carrinho está vazio.",
  "cart-full": "Seu carrinho tem passeios demais. Divida a reserva em duas.",
  "cart-item-duplicate": "O mesmo passeio e a mesma data estão repetidos no seu carrinho.",
  "tour-not-found": "Este passeio não está mais disponível para reserva on-line.",
  "booking-not-found": "Não encontramos a reserva.",
  "hold-expired": "O prazo para pagar expirou e suas vagas foram liberadas. Volte ao carrinho para tentar novamente.",
  "booking-not-payable": "Esta reserva não aceita mais pagamentos. Fale conosco pelo WhatsApp se precisar de ajuda.",
  "booking-already-paid": "Sua reserva já está paga.",
  "payment-rejected": "Seu banco recusou o pagamento. Nenhum valor foi cobrado; tente outro cartão ou o Yape.",
  "payment-gateway-error": "O provedor de pagamentos não respondeu. Nenhum valor foi cobrado; tente novamente em alguns minutos.",
  "payment-not-found": "Não encontramos o pagamento. Tente novamente.",
  "consent-required": "Aceite os Termos e a Política de privacidade para continuar.",
  "invalid-email": "Confira o e-mail.",
  "invalid-country": "Confira o país de residência.",
  "validation-failed": "Confira os dados informados.",
  "idempotency-in-progress": "Já estamos processando seu pagamento. Aguarde alguns segundos sem fechar esta página.",
  "concurrency-conflict": "Houve muita procura ao mesmo tempo. Tente novamente.",
  "idempotency-key-reused": "Seu pedido mudou durante o processamento. Confira o resumo e tente novamente.",
  "too-many-requests": "Você fez várias tentativas seguidas. Aguarde um minuto e tente novamente; nenhum valor foi cobrado.",
  "http-429": "Você fez várias tentativas seguidas. Aguarde um minuto e tente novamente; nenhum valor foi cobrado.",
  "payload-too-large": "O texto enviado é longo demais. Reduza o texto e tente novamente.",
  "booking-token-required": "Não encontramos a reserva.",
  "not-found": "Não encontramos o que você procurava. Confira os dados e tente novamente.",
  "access-link-expired": "Este link já foi usado ou expirou. Solicite um novo com seu código e e-mail.",
  "api-unavailable": "Não foi possível conectar ao sistema de reservas. Nenhum valor foi cobrado; tente novamente em alguns minutos.",
};

const FIELD_BY_CODE: Record<string, string> = {
  "consent-required": "terms",
  "invalid-email": "email",
  "invalid-country": "country",
};

export function toUserError(code: string, fallbackDetail?: string, locale: Locale = "es"): UserError {
  const messageCode = MESSAGES[code] ? code : code.includes("429") || code.includes("too-many") ? "http-429" : code;
  const known = MESSAGES[messageCode];
  if (known) {
    const [kind, es, en] = known;
    return { code, kind, message: locale === "pt" ? PORTUGUESE_MESSAGES[messageCode] ?? GENERIC.pt : locale === "en" ? en : es, field: FIELD_BY_CODE[code] };
  }
  // El `detail` de la API viene en español (es-PE): solo sirve de respaldo en la página en español.
  const detail = locale === "es" ? fallbackDetail?.trim() : undefined;
  return { code, kind: "other", message: detail || GENERIC[locale] };
}

const CART_ISSUES: Record<string, Record<Locale, string>> = {
  sold_out: { es: "ya no quedan cupos para esa fecha.", en: "no seats left for that date.", pt: "não há mais vagas para essa data." },
  date_unavailable: { es: "la fecha ya no está disponible.", en: "the date is no longer available.", pt: "a data não está mais disponível." },
  price_changed: { es: "el precio cambió.", en: "the price changed.", pt: "o preço mudou." },
};

/** Mensaje por tipo de incidencia del carrito (`issues[].type` de la API). */
export function cartIssueMessage(type: string, code: string, tourTitle: string, locale: Locale = "es"): string {
  const text = CART_ISSUES[type]?.[locale] ?? toUserError(code, undefined, locale).message;
  return `${tourTitle}: ${text}`;
}
