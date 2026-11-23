import type { Travelers } from "@/lib/cart/types";

/**
 * Textos con plural que se repiten en servidor y cliente (viajeros, duración). Reciben el traductor
 * del namespace `units` (`useTranslations("units")` o `getTranslations("units")`).
 */
type Values = Record<string, string | number>;
export type UnitsTranslator = (
  key: "adults" | "children" | "infants" | "noTravelers" | "duration" | "durationOneDay" | "durationHalfDay" | "durationUnknown" | "travelers",
  values?: Values,
) => string;

export function describeTravelers(t: UnitsTranslator, travelers: Travelers): string {
  const parts: string[] = [];
  if (travelers.adults) parts.push(t("adults", { count: travelers.adults }));
  if (travelers.children) parts.push(t("children", { count: travelers.children }));
  if (travelers.infants) parts.push(t("infants", { count: travelers.infants }));
  return parts.join(", ") || t("noTravelers");
}

/** Hasta este número de horas, un tour de un día se presenta como "Medio día". */
export const HALF_DAY_MAX_HOURS = 6;

/** "4 días / 3 noches", "1 día", "Medio día" o "Duración por confirmar". */
export function durationText(t: UnitsTranslator, days: number | null, nights: number | null, hours: number | null = null): string {
  if (!days) return t("durationUnknown");
  if (days === 1 && hours != null && hours > 0 && hours <= HALF_DAY_MAX_HOURS) return t("durationHalfDay");
  if (days === 1) return t("durationOneDay");
  return t("duration", { days, nights: nights ?? days - 1 });
}
