import { ValidationError } from './domain-error.js';

/**
 * Fecha de calendario ISO `YYYY-MM-DD` (sin hora ni zona). Las fechas de viaje y de
 * vigencia de tarifas son fechas de calendario de Perú.
 */
export type CalendarDate = string;

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;
const MS_PER_DAY = 86_400_000;

/**
 * Perú no aplica horario de verano: America/Lima = UTC-5 todo el año.
 * Si eso cambiara, sustituir por una librería de zonas horarias.
 */
export const LIMA_UTC_OFFSET_MINUTES = -300;

export function isCalendarDate(value: unknown): value is CalendarDate {
  if (typeof value !== 'string') return false;
  const match = ISO_DATE.exec(value);
  if (!match) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().startsWith(value);
}

export function assertCalendarDate(value: unknown, field = 'date'): CalendarDate {
  if (!isCalendarDate(value)) {
    throw new ValidationError('invalid-date', `Fecha inválida en "${field}" (formato YYYY-MM-DD).`, {
      field,
      value,
    });
  }
  return value;
}

/** Inicio del día de calendario en Lima expresado como instante UTC. */
export function startOfDayInLima(date: CalendarDate): Date {
  return new Date(Date.parse(`${date}T00:00:00.000Z`) - LIMA_UTC_OFFSET_MINUTES * 60_000);
}

/** Fecha de calendario de Lima correspondiente a un instante. */
export function toLimaCalendarDate(instant: Date): CalendarDate {
  return new Date(instant.getTime() + LIMA_UTC_OFFSET_MINUTES * 60_000).toISOString().slice(0, 10);
}

export function addDays(date: CalendarDate, days: number): CalendarDate {
  return new Date(Date.parse(`${date}T00:00:00.000Z`) + days * MS_PER_DAY).toISOString().slice(0, 10);
}

export function compareDates(a: CalendarDate, b: CalendarDate): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

export function minDate(dates: readonly CalendarDate[]): CalendarDate {
  return dates.reduce((min, d) => (d < min ? d : min));
}

export function maxDate(dates: readonly CalendarDate[]): CalendarDate {
  return dates.reduce((max, d) => (d > max ? d : max));
}

/** Prisma mapea `@db.Date` a `Date` en medianoche UTC. */
export function calendarDateFromUtcDate(value: Date): CalendarDate {
  return value.toISOString().slice(0, 10);
}

export function calendarDateToUtcDate(value: CalendarDate): Date {
  return new Date(`${value}T00:00:00.000Z`);
}

export function addMinutes(instant: Date, minutes: number): Date {
  return new Date(instant.getTime() + minutes * 60_000);
}
