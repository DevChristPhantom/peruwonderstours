import type { Currency } from "@/lib/catalog/types";

/** Zona horaria de presentación (CLAUDE.md: fechas en UTC, se muestran en America/Lima). */
export const DISPLAY_TIME_ZONE = "America/Lima";

const moneyFormatters = new Map<Currency, Intl.NumberFormat>();

function moneyFormatter(currency: Currency): Intl.NumberFormat {
  let f = moneyFormatters.get(currency);
  if (!f) {
    f = new Intl.NumberFormat("es-PE", {
      style: "currency",
      currency,
      // PEN → "S/ 1,250.00"; USD → "USD 1,250.00" (MASTER §3).
      currencyDisplay: currency === "PEN" ? "symbol" : "code",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
    moneyFormatters.set(currency, f);
  }
  return f;
}

/** Formatea céntimos enteros. La división solo ocurre al presentar. */
export function formatMoney(amountCents: number, currency: Currency): string {
  return moneyFormatter(currency).format(amountCents / 100).replace(/ /g, " ");
}

/** Fecha calendario `YYYY-MM-DD` (sin hora) → mediodía en Lima para evitar saltos de día. */
export function parseIsoDate(isoDate: string): Date {
  return new Date(`${isoDate}T12:00:00-05:00`);
}

const longDate = new Intl.DateTimeFormat("es-PE", {
  weekday: "short",
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: DISPLAY_TIME_ZONE,
});

/** "sáb, 14 nov. 2026" */
export function formatDate(isoDate: string): string {
  return longDate.format(parseIsoDate(isoDate));
}

const dateTime = new Intl.DateTimeFormat("es-PE", {
  weekday: "short",
  day: "numeric",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: DISPLAY_TIME_ZONE,
});

/** Instante ISO 8601 (UTC, de la API) o fecha `YYYY-MM-DD` → fecha en Lima. */
export function formatInstantDate(value: string): string {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) ? formatDate(value) : longDate.format(new Date(value));
}

/** Instante ISO 8601 (UTC) → "sáb, 14 nov. 2026, 10:30 a. m." en hora de Lima. */
export function formatDateTime(value: string): string {
  return dateTime.format(new Date(value));
}

/** Fecha de hoy en Lima como `YYYY-MM-DD`. */
export function todayInLima(now: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: DISPLAY_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}`;
}

/** Suma días a una fecha calendario `YYYY-MM-DD` (aritmética en UTC, sin horario de verano en Perú). */
export function addDays(isoDate: string, days: number): string {
  const [y, m, d] = isoDate.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d + days));
  return date.toISOString().slice(0, 10);
}

/** Diferencia en días calendario b − a. */
export function daysBetween(a: string, b: string): number {
  const toUtc = (iso: string) => {
    const [y, m, d] = iso.split("-").map(Number);
    return Date.UTC(y, m - 1, d);
  };
  return Math.round((toUtc(b) - toUtc(a)) / 86_400_000);
}

export function pluralize(count: number, singular: string, plural: string): string {
  return `${count} ${count === 1 ? singular : plural}`;
}
