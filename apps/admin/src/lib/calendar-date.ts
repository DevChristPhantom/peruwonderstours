/** Día gregoriano YYYY-MM-DD. Evita normalizar fechas imposibles como 30 de febrero. */
export function isCalendarDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || value.startsWith("0000-")) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

/** Límites inclusivos de un día en Lima (UTC-5), o undefined para un filtro inválido. */
export function limaDayBoundary(value: string, end = false): string | undefined {
  if (!isCalendarDate(value)) return undefined;
  return new Date(`${value}T${end ? "23:59:59.999" : "00:00:00"}-05:00`).toISOString();
}

/** Los reportes diarios no admiten fechas futuras; entradas inválidas usan el día actual. */
export function reportDate(value: string, today: string): string {
  return isCalendarDate(value) && value <= today ? value : today;
}
