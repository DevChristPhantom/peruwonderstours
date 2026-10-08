import { addDays, startOfDayInLima, toLimaCalendarDate, type CalendarDate } from '../../../shared/domain/calendar-date.js';

/**
 * Días hábiles para plazos del Libro de Reclamaciones (art. 6, D.S. 101-2022-PCM):
 * lunes a viernes, excluidos los feriados y días no laborables del calendario
 * (`business_holidays`). El cómputo empieza el día siguiente al registro.
 * [A VALIDAR CON ASESOR LEGAL: feriados regionales y días no laborables del sector público.]
 */
export const COMPLAINT_RESPONSE_BUSINESS_DAYS = 15;

/** Días de calendario a consultar para cubrir N días hábiles con holgura (fines de semana + feriados). */
export function businessDaysLookahead(days: number): number {
  return days * 2 + 21;
}

export function isWeekend(date: CalendarDate): boolean {
  const day = new Date(`${date}T12:00:00Z`).getUTCDay();
  return day === 0 || day === 6;
}

export function isBusinessDay(date: CalendarDate, holidays: ReadonlySet<CalendarDate>): boolean {
  return !isWeekend(date) && !holidays.has(date);
}

/** N-ésimo día hábil posterior a `start` (sin contar `start`). */
export function addBusinessDays(start: CalendarDate, days: number, holidays: ReadonlySet<CalendarDate>): CalendarDate {
  if (!Number.isInteger(days) || days < 1) throw new RangeError('days debe ser un entero >= 1');
  let current = start;
  let counted = 0;
  while (counted < days) {
    current = addDays(current, 1);
    if (isBusinessDay(current, holidays)) counted += 1;
  }
  return current;
}

/**
 * Vencimiento de la respuesta: fin (23:59:59.999, America/Lima) del 15.º día hábil
 * posterior a la fecha de registro en Lima.
 */
export function complaintResponseDue(
  submittedAt: Date,
  holidays: ReadonlySet<CalendarDate>,
  days = COMPLAINT_RESPONSE_BUSINESS_DAYS,
): { dueDate: CalendarDate; dueAt: Date } {
  const dueDate = addBusinessDays(toLimaCalendarDate(submittedAt), days, holidays);
  const dueAt = new Date(startOfDayInLima(addDays(dueDate, 1)).getTime() - 1);
  return { dueDate, dueAt };
}
