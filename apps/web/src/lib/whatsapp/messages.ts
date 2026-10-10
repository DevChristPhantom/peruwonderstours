import { travelerCount, type Travelers } from "@/lib/cart/types";
import type { Formatter } from "@/lib/format";
import { describeTravelers, type UnitsTranslator } from "@/lib/i18n/units";
import { whatsappHref } from "@/lib/site";

/**
 * Mensajes prellenados de WhatsApp con contexto (HU-B.A10), en el idioma de la página.
 *
 * Regla: SOLO datos del pedido (tour, fecha, cantidad de viajeros, código de reserva). Nunca nombre,
 * correo, teléfono ni documento: el texto viaja en la URL de wa.me y queda en el historial del
 * navegador y del teléfono.
 */

export interface WhatsappTourContext {
  title: string;
  date?: string | null;
  travelers?: Travelers | null;
}

type Values = Record<string, string | number>;
/** Traductor del namespace `whatsapp`. */
export type WhatsappTranslator = (
  key: "tourHelp" | "cartHelp" | "cartHelpStep" | "bookingHelp" | "bookingHelpStep" | "bookingQuestion" | "more",
  values?: Values,
) => string;

export interface WhatsappTools {
  t: WhatsappTranslator;
  units: UnitsTranslator;
  format: Formatter;
}

const MAX_LINES = 6;

function describeTour({ units, format }: WhatsappTools, { title, date, travelers }: WhatsappTourContext): string {
  const parts = [title];
  if (date && /^\d{4}-\d{2}-\d{2}$/.test(date)) parts.push(format.date(date));
  if (travelers && travelerCount(travelers) > 0) parts.push(describeTravelers(units, travelers));
  return parts.join(" · ");
}

export function tourHelpMessage(tools: WhatsappTools, tour: WhatsappTourContext): string {
  return tools.t("tourHelp", { tour: describeTour(tools, tour) });
}

export function cartHelpMessage(
  tools: WhatsappTools,
  tours: readonly WhatsappTourContext[],
  options: { step?: string; bookingCode?: string | null } = {},
): string {
  const { t } = tools;
  const header = options.bookingCode
    ? options.step
      ? t("bookingHelpStep", { code: options.bookingCode, step: options.step })
      : t("bookingHelp", { code: options.bookingCode })
    : options.step
      ? t("cartHelpStep", { step: options.step })
      : t("cartHelp");
  const list = tours.slice(0, MAX_LINES).map((tour) => `- ${describeTour(tools, tour)}`);
  if (tours.length > MAX_LINES) list.push(`- ${t("more", { count: tours.length - MAX_LINES })}`);
  return [header, ...list].join("\n");
}

export function bookingHelpMessage(tools: WhatsappTools, code: string, tours: readonly WhatsappTourContext[] = []): string {
  const list = tours.slice(0, MAX_LINES).map((tour) => `- ${describeTour(tools, tour)}`);
  return [tools.t("bookingQuestion", { code }), ...list].join("\n");
}

export { whatsappHref };
