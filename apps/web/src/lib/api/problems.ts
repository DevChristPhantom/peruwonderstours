/**
 * Traducción de códigos problem+json de la API (RFC 9457, `code` en kebab-case inglés) a mensajes
 * claros en español para el viajero. Módulo puro: lo usa el servidor para armar la respuesta de las
 * Server Actions; el navegador solo recibe `{ code, message }`.
 */

export type UserErrorKind = "sold-out" | "price-changed" | "payment-rejected" | "not-found" | "expired" | "validation" | "busy" | "unavailable" | "other";

export interface UserError {
  code: string;
  kind: UserErrorKind;
  message: string;
  /** Campo del formulario relacionado (para enlazarlo desde el resumen de errores). */
  field?: string;
}

const MESSAGES: Record<string, { kind: UserErrorKind; message: string }> = {
  // Cupo / fechas
  "sold-out": { kind: "sold-out", message: "Ya no quedan cupos para la fecha elegida. Elige otra fecha en tu carrito." },
  "sales-closed": { kind: "sold-out", message: "Las ventas para esa fecha ya cerraron. Elige una fecha posterior." },
  "no-departure": { kind: "sold-out", message: "No hay salida programada para esa fecha. Elige otra fecha." },
  "departure-required": { kind: "sold-out", message: "Hay varias salidas ese día y no pudimos elegir una con cupo. Escríbenos por WhatsApp." },
  "departure-mismatch": { kind: "sold-out", message: "La salida elegida ya no corresponde a esa fecha. Elige la fecha otra vez." },
  "above-max-pax": { kind: "validation", message: "Superas el máximo de viajeros permitido para este tour." },
  "below-min-pax": { kind: "validation", message: "Este tour necesita más viajeros como mínimo." },
  "minor-without-adult": { kind: "validation", message: "Los niños deben viajar acompañados de al menos un adulto." },
  "invalid-pax-quantity": { kind: "validation", message: "Revisa la cantidad de viajeros." },
  // Precio
  "total-changed": { kind: "price-changed", message: "El precio de tu reserva cambió. Revisa el nuevo total antes de pagar." },
  "cart-has-issues": { kind: "price-changed", message: "Algunos tours de tu carrito cambiaron de precio o ya no tienen cupo. Revísalos antes de pagar." },
  "rate-not-available": { kind: "validation", message: "Este tour aún no tiene precio para reservar en línea. Consúltalo por WhatsApp." },
  "deposit-not-available": { kind: "validation", message: "Para esta reserva solo está disponible el pago del 100 %." },
  // Carrito / reserva
  "cart-not-found": { kind: "expired", message: "Tu sesión de pago expiró. Vuelve a revisar tu carrito para continuar." },
  "cart-expired": { kind: "expired", message: "Tu sesión de pago expiró. Vuelve a revisar tu carrito para continuar." },
  "cart-not-active": { kind: "expired", message: "Este pedido ya se procesó. Revisa tu correo o tu reserva." },
  "cart-already-checked-out": { kind: "expired", message: "Este pedido ya se convirtió en una reserva. Revisa tu correo." },
  "cart-empty": { kind: "validation", message: "Tu carrito está vacío." },
  "cart-full": { kind: "validation", message: "Tu carrito tiene demasiados tours. Divide la reserva en dos." },
  "cart-item-duplicate": { kind: "validation", message: "Tienes el mismo tour y fecha repetidos en el carrito." },
  "tour-not-found": { kind: "not-found", message: "Este tour ya no está disponible para reservar en línea." },
  "booking-not-found": { kind: "not-found", message: "No encontramos la reserva." },
  "hold-expired": { kind: "expired", message: "Se venció el tiempo para pagar y liberamos tus cupos. Vuelve al carrito para intentarlo de nuevo." },
  "booking-not-payable": { kind: "expired", message: "Esta reserva ya no admite pagos. Escríbenos por WhatsApp si necesitas ayuda." },
  "booking-already-paid": { kind: "other", message: "Tu reserva ya está pagada." },
  // Pago
  "payment-rejected": { kind: "payment-rejected", message: "Tu banco rechazó el pago. No se te cobró nada; prueba con otra tarjeta o con Yape." },
  "payment-gateway-error": { kind: "unavailable", message: "La pasarela de pagos no respondió. No se te cobró nada; intenta de nuevo en unos minutos." },
  "payment-not-found": { kind: "not-found", message: "No encontramos el pago. Intenta de nuevo." },
  // Consentimiento / datos
  "consent-required": { kind: "validation", message: "Acepta los Términos y la Política de privacidad para continuar.", },
  "invalid-email": { kind: "validation", message: "Revisa el correo electrónico." },
  "invalid-country": { kind: "validation", message: "Revisa el país de residencia." },
  "validation-failed": { kind: "validation", message: "Revisa los datos ingresados." },
  // Concurrencia / disponibilidad
  "idempotency-in-progress": { kind: "busy", message: "Ya estamos procesando tu pago. Espera unos segundos sin cerrar esta página." },
  "concurrency-conflict": { kind: "busy", message: "Hubo mucha demanda al mismo tiempo. Intenta de nuevo." },
  "idempotency-key-reused": { kind: "other", message: "Tu pedido cambió mientras se procesaba. Revisa el resumen e intenta de nuevo." },
  "too-many-requests": { kind: "busy", message: "Hiciste varios intentos seguidos. Espera un minuto e inténtalo de nuevo; no se te cobró nada." },
  "http-429": { kind: "busy", message: "Hiciste varios intentos seguidos. Espera un minuto e inténtalo de nuevo; no se te cobró nada." },
  "payload-too-large": { kind: "validation", message: "El texto enviado es demasiado largo. Acórtalo e intenta de nuevo." },
  "booking-token-required": { kind: "not-found", message: "No encontramos la reserva." },
  // Código genérico de 404 (antes `no-encontrado`).
  "not-found": { kind: "not-found", message: "No encontramos lo que buscabas. Revisa los datos e intenta de nuevo." },
  // Enlace de acceso de un solo uso ya usado o vencido (410).
  "access-link-expired": { kind: "expired", message: "Este enlace ya se usó o venció. Pide uno nuevo con tu código y correo." },
  "api-unavailable": { kind: "unavailable", message: "No pudimos conectar con el sistema de reservas. No se te cobró nada; intenta de nuevo en unos minutos." },
};

const FIELD_BY_CODE: Record<string, string> = {
  "consent-required": "terms",
  "invalid-email": "email",
  "invalid-country": "country",
};

export function toUserError(code: string, fallbackDetail?: string): UserError {
  const known = MESSAGES[code] ?? (code.includes("429") || code.includes("too-many") ? MESSAGES["http-429"] : undefined);
  if (known) return { code, ...known, field: FIELD_BY_CODE[code] };
  return {
    code,
    kind: "other",
    // El `detail` de la API ya viene en español (es-PE) para errores de dominio; se usa como respaldo.
    message: fallbackDetail?.trim() || "No pudimos completar la operación. Intenta de nuevo o escríbenos por WhatsApp.",
  };
}

/** Mensaje por tipo de incidencia del carrito (`issues[].type` de la API). */
export function cartIssueMessage(type: string, code: string, tourTitle: string): string {
  switch (type) {
    case "sold_out":
      return `${tourTitle}: ya no quedan cupos para esa fecha.`;
    case "date_unavailable":
      return `${tourTitle}: la fecha ya no está disponible.`;
    case "price_changed":
      return `${tourTitle}: el precio cambió.`;
    default:
      return `${tourTitle}: ${toUserError(code).message}`;
  }
}
