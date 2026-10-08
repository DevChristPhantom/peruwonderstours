import type { CalendarDate } from '../../../shared/domain/calendar-date.js';

/**
 * Feriados nacionales 2026-2027 para el modo en memoria (seed/memory). Con PostgreSQL la
 * fuente es la tabla `business_holidays` (misma lista, cargada por la migración
 * 20261008000400_complaints_libro_reclamaciones). [A VALIDAR CON ASESOR LEGAL]
 */
export const PERU_NATIONAL_HOLIDAYS: readonly CalendarDate[] = [
  '2026-01-01', '2026-04-02', '2026-04-03', '2026-05-01', '2026-06-07', '2026-06-29', '2026-07-23', '2026-07-28',
  '2026-07-29', '2026-08-06', '2026-08-30', '2026-10-08', '2026-11-01', '2026-12-08', '2026-12-09', '2026-12-25',
  '2027-01-01', '2027-03-25', '2027-03-26', '2027-05-01', '2027-06-07', '2027-06-29', '2027-07-23', '2027-07-28',
  '2027-07-29', '2027-08-06', '2027-08-30', '2027-10-08', '2027-11-01', '2027-12-08', '2027-12-09', '2027-12-25',
];
