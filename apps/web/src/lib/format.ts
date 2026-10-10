import type { Currency } from "@/lib/catalog/types";
import { INTL_LOCALE, TIME_ZONE, type Locale } from "@/i18n/routing";

/**
 * Formateo de dinero y fechas según el idioma (I2): `es-PE` / `en-US`, siempre en hora de Lima
 * (CLAUDE.md: fechas en UTC, se muestran en America/Lima). Las funciones reciben el `locale`; en los
 * componentes cliente se usan a través de `useFormat()` (hooks/useFormat.ts) y en el servidor con
 * `formatFor(locale)`.
 */

/** Zona horaria de presentación. */
export const DISPLAY_TIME_ZONE = TIME_ZONE;

const cache = new Map<string, Intl.NumberFormat | Intl.DateTimeFormat>();

function memo<T extends Intl.NumberFormat | Intl.DateTimeFormat>(key: string, make: () => T): T {
  let f = cache.get(key) as T | undefined;
  if (!f) {
    f = make();
    cache.set(key, f);
  }
  return f;
}

/**
 * Formatea céntimos enteros. La división solo ocurre al presentar.
 * PEN → "S/ 1,250.00" en ambos idiomas (así se escribe en el Perú, MASTER §3); USD → "USD 1,250.00".
 */
export function formatMoney(amountCents: number, currency: Currency, locale: Locale = "es"): string {
  const number = memo(`n:${locale}`, () =>
    new Intl.NumberFormat(INTL_LOCALE[locale], { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
  ) as Intl.NumberFormat;
  const value = number.format(amountCents / 100);
  return `${currency === "PEN" ? "S/" : "USD"} ${value}`;
}

/** Fecha calendario `YYYY-MM-DD` (sin hora) → mediodía en Lima para evitar saltos de día. */
export function parseIsoDate(isoDate: string): Date {
  return new Date(`${isoDate}T12:00:00-05:00`);
}

function longDate(locale: Locale): Intl.DateTimeFormat {
  return memo(`d:${locale}`, () =>
    new Intl.DateTimeFormat(INTL_LOCALE[locale], {
      weekday: "short",
      day: "numeric",
      month: "short",
      year: "numeric",
      timeZone: DISPLAY_TIME_ZONE,
    }),
  ) as Intl.DateTimeFormat;
}

/** "sáb, 14 nov. 2026" / "Sat, Nov 14, 2026" */
export function formatDate(isoDate: string, locale: Locale = "es"): string {
  return longDate(locale).format(parseIsoDate(isoDate));
}

/** Instante ISO 8601 (UTC, de la API) o fecha `YYYY-MM-DD` → fecha en Lima. */
export function formatInstantDate(value: string, locale: Locale = "es"): string {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) ? formatDate(value, locale) : longDate(locale).format(new Date(value));
}

/** Instante ISO 8601 (UTC) → "sáb, 14 nov. 2026, 10:30 a. m." en hora de Lima. */
export function formatDateTime(value: string, locale: Locale = "es"): string {
  const f = memo(`dt:${locale}`, () =>
    new Intl.DateTimeFormat(INTL_LOCALE[locale], {
      weekday: "short",
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      timeZone: DISPLAY_TIME_ZONE,
    }),
  ) as Intl.DateTimeFormat;
  return f.format(new Date(value));
}

/** `YYYY-MM` → "julio de 2027" / "July 2027". */
export function formatMonth(value: string, locale: Locale = "es"): string | null {
  const m = /^(\d{4})-(\d{2})$/.exec(value);
  if (!m || Number(m[2]) < 1 || Number(m[2]) > 12) return null;
  const f = memo(`m:${locale}`, () =>
    new Intl.DateTimeFormat(INTL_LOCALE[locale], { month: "long", year: "numeric", timeZone: DISPLAY_TIME_ZONE }),
  ) as Intl.DateTimeFormat;
  return f.format(parseIsoDate(`${m[1]}-${m[2]}-15`));
}

/** Número con separador de miles del idioma ("3 812" / "3,812"). */
export function formatNumber(value: number, locale: Locale = "es"): string {
  const f = memo(`i:${locale}`, () => new Intl.NumberFormat(INTL_LOCALE[locale])) as Intl.NumberFormat;
  return f.format(value);
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

/** Formateadores ligados a un idioma (servidor o cliente). */
export function formatFor(locale: Locale) {
  return {
    locale,
    money: (cents: number, currency: Currency) => formatMoney(cents, currency, locale),
    date: (iso: string) => formatDate(iso, locale),
    instant: (value: string) => formatInstantDate(value, locale),
    dateTime: (value: string) => formatDateTime(value, locale),
    month: (value: string) => formatMonth(value, locale),
    number: (value: number) => formatNumber(value, locale),
  };
}

export type Formatter = ReturnType<typeof formatFor>;
