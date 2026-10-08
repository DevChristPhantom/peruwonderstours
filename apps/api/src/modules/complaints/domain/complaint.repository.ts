import type { CalendarDate } from '../../../shared/domain/calendar-date.js';
import type { ComplaintSnapshot } from './complaint.js';

export interface ComplaintRepository {
  insert(complaint: ComplaintSnapshot): Promise<void>;
  findByCode(code: string): Promise<ComplaintSnapshot | null>;
  findById(id: string): Promise<ComplaintSnapshot | null>;
  /** Reemplaza el token de consulta (replay idempotente). */
  updateAccessTokenHash(id: string, accessTokenHash: string): Promise<void>;
}

/** Correlativo anual sin huecos (PostgreSQL: next_document_number('complaint', año)). */
export interface ComplaintSequence {
  next(year: number): Promise<number>;
}

/** Calendario de días no hábiles (`business_holidays`, ámbito nacional). */
export interface HolidayCalendar {
  holidaysBetween(from: CalendarDate, to: CalendarDate): Promise<Set<CalendarDate>>;
}
