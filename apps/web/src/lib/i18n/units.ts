import type { Travelers } from "@/lib/cart/types";

/**
 * Textos con plural que se repiten en servidor y cliente (viajeros, duración). Reciben el traductor
 * del namespace `units` (`useTranslations("units")` o `getTranslations("units")`).
 */
type Values = Record<string, string | number>;
export type UnitsTranslator = (
  key: "adults" | "children" | "infants" | "noTravelers" | "duration" | "durationOneDay" | "durationUnknown" | "travelers",
  values?: Values,
) => string;

export function describeTravelers(t: UnitsTranslator, travelers: Travelers): string {
  const parts: string[] = [];
  if (travelers.adults) parts.push(t("adults", { count: travelers.adults }));
  if (travelers.children) parts.push(t("children", { count: travelers.children }));
  if (travelers.infants) parts.push(t("infants", { count: travelers.infants }));
  return parts.join(", ") || t("noTravelers");
}

/** "4 días / 3 noches", "1 día" o "Duración por confirmar". */
export function durationText(t: UnitsTranslator, days: number | null, nights: number | null): string {
  if (!days) return t("durationUnknown");
  if (days === 1) return t("durationOneDay");
  return t("duration", { days, nights: nights ?? days - 1 });
}
