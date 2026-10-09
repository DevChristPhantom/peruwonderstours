import type { Currency, Money } from "@/lib/api/types";

/** Fechas en UTC desde la API; se muestran en America/Lima (CLAUDE.md). */
export const TIME_ZONE = "America/Lima";

const money = new Map<Currency, Intl.NumberFormat>();

export function formatMoney(value: Money | null | undefined): string {
  if (!value) return "—";
  let f = money.get(value.currency);
  if (!f) {
    f = new Intl.NumberFormat("es-PE", {
      style: "currency",
      currency: value.currency,
      currencyDisplay: value.currency === "PEN" ? "symbol" : "code",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
    money.set(value.currency, f);
  }
  return f.format(value.amount / 100).replace(/ /g, " ");
}

/** "450.00" (céntimos → texto para un input). */
export function centsToInput(cents: number): string {
  return (cents / 100).toFixed(2);
}

/** "1250.5" / "1250,50" → céntimos enteros; null si no es un monto válido. */
export function parseAmountToCents(input: string): number | null {
  const clean = input.trim().replace(/\s/g, "").replace(/^S\/|^USD/i, "");
  if (!/^\d{1,9}([.,]\d{1,2})?$/.test(clean)) return null;
  const [int, dec = ""] = clean.split(/[.,]/);
  return Number(int) * 100 + Number(dec.padEnd(2, "0"));
}

const dateFmt = new Intl.DateTimeFormat("es-PE", { day: "2-digit", month: "short", year: "numeric", timeZone: TIME_ZONE });
const dateTimeFmt = new Intl.DateTimeFormat("es-PE", {
  day: "2-digit",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
  timeZone: TIME_ZONE,
});
const weekdayFmt = new Intl.DateTimeFormat("es-PE", { weekday: "short", timeZone: TIME_ZONE });

/** `YYYY-MM-DD` (calendario) → "14 nov. 2026" sin desfase de zona. */
export function formatDate(value: string | null | undefined): string {
  if (!value) return "—";
  const d = /^\d{4}-\d{2}-\d{2}$/.test(value) ? new Date(`${value}T12:00:00-05:00`) : new Date(value);
  return Number.isNaN(d.getTime()) ? value : dateFmt.format(d);
}

export function formatWeekday(value: string): string {
  return weekdayFmt.format(new Date(`${value}T12:00:00-05:00`));
}

/** Instante ISO → "14 nov. 2026, 09:30" en Lima. */
export function formatDateTime(value: string | null | undefined): string {
  if (!value) return "—";
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? value : dateTimeFmt.format(d);
}

/** Fecha de hoy en Lima `YYYY-MM-DD`. */
export function todayInLima(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: TIME_ZONE }).format(new Date());
}

export function addDaysIso(date: string, days: number): string {
  const d = new Date(`${date}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** `datetime-local` (hora de Lima, sin zona) → ISO UTC. Lima no tiene horario de verano (UTC-5). */
export function limaLocalToIso(local: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(local)) return null;
  const d = new Date(`${local}:00-05:00`);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

/** Ahora en Lima para un `datetime-local`. */
export function nowLimaLocal(): string {
  return new Date(Date.now() - 5 * 3600_000).toISOString().slice(0, 16);
}
