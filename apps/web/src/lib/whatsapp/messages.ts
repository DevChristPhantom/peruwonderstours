import { describeTravelers, travelerCount, type Travelers } from "@/lib/cart/types";
import { formatDate } from "@/lib/format";
import { whatsappHref } from "@/lib/site";

/**
 * Mensajes prellenados de WhatsApp con contexto (HU-B.A10).
 *
 * Regla: SOLO datos del pedido (tour, fecha, cantidad de viajeros, código de reserva). Nunca nombre,
 * correo, teléfono ni documento: el texto viaja en la URL de wa.me y queda en el historial del
 * navegador y del teléfono.
 *
 * El "código de carrito" de la API vive en una cookie httpOnly (BFF) y no se expone al navegador;
 * mientras tanto el mensaje lleva el detalle del carrito, que basta para ubicar el pedido.
 */

export interface WhatsappTourContext {
  title: string;
  date?: string | null;
  travelers?: Travelers | null;
}

const MAX_LINES = 6;

function describeTour({ title, date, travelers }: WhatsappTourContext): string {
  const parts = [title];
  if (date && /^\d{4}-\d{2}-\d{2}$/.test(date)) parts.push(formatDate(date));
  if (travelers && travelerCount(travelers) > 0) parts.push(describeTravelers(travelers));
  return parts.join(" · ");
}

export function tourHelpMessage(tour: WhatsappTourContext): string {
  return `Hola, tengo dudas sobre el tour ${describeTour(tour)}.`;
}

export function cartHelpMessage(
  tours: readonly WhatsappTourContext[],
  options: { step?: string; bookingCode?: string | null } = {},
): string {
  const header = options.bookingCode
    ? `Hola, necesito ayuda con mi reserva ${options.bookingCode}`
    : "Hola, necesito ayuda con mi carrito";
  const where = options.step ? ` (paso: ${options.step})` : "";
  const list = tours.slice(0, MAX_LINES).map((t) => `- ${describeTour(t)}`);
  if (tours.length > MAX_LINES) list.push(`- y ${tours.length - MAX_LINES} tours más`);
  return [`${header}${where}.`, ...list].join("\n");
}

export function bookingHelpMessage(code: string, tours: readonly WhatsappTourContext[] = []): string {
  const list = tours.slice(0, MAX_LINES).map((t) => `- ${describeTour(t)}`);
  return [`Hola, tengo una consulta sobre mi reserva ${code}.`, ...list].join("\n");
}

export { whatsappHref };
