import { addDays, isCalendarDate, toLimaCalendarDate, type CalendarDate } from '../../../shared/domain/calendar-date.js';
import { BusinessRuleError, ValidationError } from '../../../shared/domain/domain-error.js';
import {
  addBusinessDays,
  countBusinessDaysBetween,
  endOfBusinessDayAfter,
  isBusinessDay,
} from '../../complaints/domain/business-days.js';

// =============================================================================
// Salidas: generación en lote y capacidad (HU-7.4)
// =============================================================================
export const MAX_BULK_RANGE_DAYS = 366;

/** ISO 8601: 1 = lunes ... 7 = domingo. */
export function isoWeekday(date: CalendarDate): number {
  const d = new Date(`${date}T12:00:00Z`).getUTCDay();
  return d === 0 ? 7 : d;
}

/** Fechas entre `from` y `to` (inclusive) que caen en los días de semana pedidos. */
export function generateDepartureDates(params: { from: CalendarDate; to: CalendarDate; weekdays: readonly number[] }): CalendarDate[] {
  const { from, to } = params;
  if (!isCalendarDate(from) || !isCalendarDate(to)) throw new ValidationError('invalid-date-range', 'Fechas inválidas (YYYY-MM-DD).');
  if (to < from) throw new ValidationError('invalid-date-range', 'La fecha final debe ser igual o posterior a la inicial.');
  const weekdays = new Set(params.weekdays);
  if (weekdays.size === 0 || [...weekdays].some((w) => !Number.isInteger(w) || w < 1 || w > 7)) {
    throw new ValidationError('invalid-weekdays', 'Indica al menos un día de la semana (1 = lunes ... 7 = domingo).');
  }
  const dates: CalendarDate[] = [];
  let current = from;
  let span = 0;
  while (current <= to) {
    span += 1;
    if (span > MAX_BULK_RANGE_DAYS) throw new ValidationError('date-range-too-long', `El rango no puede superar ${MAX_BULK_RANGE_DAYS} días.`);
    if (weekdays.has(isoWeekday(current))) dates.push(current);
    current = addDays(current, 1);
  }
  return dates;
}

/** No se puede bajar la capacidad por debajo de lo vendido + retenido (HU-7.4). */
export function assertCapacityChange(newCapacity: number, booked: number, held: number): void {
  if (!Number.isInteger(newCapacity) || newCapacity < 0) throw new ValidationError('invalid-capacity', 'La capacidad debe ser un entero mayor o igual a 0.');
  if (newCapacity < booked + held) {
    const parts = [`Hay ${booked} cupos vendidos`];
    if (held > 0) parts.push(`${held} retenidos en checkouts en curso`);
    throw new BusinessRuleError('capacity-below-sold', `${parts.join(' y ')}: la capacidad no puede ser menor que ${booked + held}.`, { booked, held });
  }
}

// =============================================================================
// Publicación de tours (HU-7.1)
// =============================================================================
export interface PublicationCandidate {
  translations: Array<{ locale: string; title: string; summary: string; itinerary: unknown }>;
  media: Array<{ isCover: boolean; kind: string }>;
  activeRateCount: number;
}

export interface PublicationCheck {
  errors: Array<{ field: string; messages: string[] }>;
  warnings: string[];
}

/** Bloquea la publicación sin datos mínimos (traducción es, itinerario, imagen principal). */
export function checkPublication(tour: PublicationCandidate): PublicationCheck {
  const errors: Array<{ field: string; messages: string[] }> = [];
  const es = tour.translations.find((t) => t.locale === 'es');
  if (!es) errors.push({ field: 'translations.es', messages: ['Falta la traducción en español (idioma canónico).'] });
  else {
    if (!es.title.trim()) errors.push({ field: 'translations.es.title', messages: ['Falta el título.'] });
    if (!es.summary.trim()) errors.push({ field: 'translations.es.summary', messages: ['Falta el resumen.'] });
    if (!Array.isArray(es.itinerary) || es.itinerary.length === 0) errors.push({ field: 'translations.es.itinerary', messages: ['Falta el itinerario.'] });
  }
  if (!tour.media.some((m) => m.isCover && m.kind === 'image')) errors.push({ field: 'media', messages: ['Falta la imagen principal (portada).'] });
  const warnings: string[] = [];
  if (tour.activeRateCount === 0) warnings.push('El tour no tiene tarifas vigentes: se mostrará sin precio y no se podrá reservar.');
  if (!tour.translations.some((t) => t.locale === 'en')) warnings.push('Falta la traducción en inglés.');
  return { errors, warnings };
}

export function tourPublicPath(locale: string, slug: string): string {
  return `/${locale}/tours/${slug}`;
}

// =============================================================================
// Tarifas (HU-7.2): mensaje claro antes del EXCLUDE de la base
// =============================================================================
export interface RateRange {
  id?: string;
  tourId: string;
  seasonId: string | null;
  paxType: string;
  residency: string;
  currency: string;
  validFrom: CalendarDate;
  validTo: CalendarDate;
  minGroupSize: number;
  maxGroupSize: number | null;
  isActive: boolean;
}

export function ratesOverlap(a: RateRange, b: RateRange): boolean {
  if (!a.isActive || !b.isActive) return false;
  if (a.tourId !== b.tourId || a.paxType !== b.paxType || a.residency !== b.residency || a.currency !== b.currency) return false;
  if ((a.seasonId ?? null) !== (b.seasonId ?? null)) return false;
  const datesOverlap = a.validFrom <= b.validTo && b.validFrom <= a.validTo;
  const aMax = a.maxGroupSize ?? 32767;
  const bMax = b.maxGroupSize ?? 32767;
  const groupsOverlap = a.minGroupSize <= bMax && b.minGroupSize <= aMax;
  return datesOverlap && groupsOverlap;
}

const PAX_LABEL: Record<string, string> = { adult: 'adulto', child: 'niño', student: 'estudiante', senior: 'adulto mayor' };
const RESIDENCY_LABEL: Record<string, string> = { national: 'nacional', foreign: 'extranjero' };

export function describeRate(r: RateRange): string {
  const group = r.maxGroupSize ? `${r.minGroupSize}-${r.maxGroupSize} pax` : `${r.minGroupSize}+ pax`;
  return `${PAX_LABEL[r.paxType] ?? r.paxType} / ${RESIDENCY_LABEL[r.residency] ?? r.residency} / ${r.currency}, ${r.validFrom} a ${r.validTo}, ${group}`;
}

export function assertRateShape(r: RateRange & { amount: bigint }): void {
  const errors: Array<{ field: string; messages: string[] }> = [];
  if (r.validTo < r.validFrom) errors.push({ field: 'validTo', messages: ['La vigencia final debe ser igual o posterior a la inicial.'] });
  if (r.amount < 0n) errors.push({ field: 'amount', messages: ['El monto no puede ser negativo.'] });
  if (r.minGroupSize < 1) errors.push({ field: 'minGroupSize', messages: ['Debe ser al menos 1.'] });
  if (r.maxGroupSize !== null && r.maxGroupSize < r.minGroupSize) errors.push({ field: 'maxGroupSize', messages: ['Debe ser mayor o igual al mínimo.'] });
  if (errors.length > 0) throw new ValidationError('validation-failed', 'Revisa los campos indicados.', { errors });
}

// =============================================================================
// Libro de Reclamaciones: semáforo y solución directa (art. 6 y 6-A)
// =============================================================================
export type TrafficLight = 'green' | 'yellow' | 'red' | 'overdue' | 'suspended' | 'done';

export const COMPLAINT_YELLOW_AT_BUSINESS_DAY = 10;
export const COMPLAINT_RED_AT_BUSINESS_DAY = 13;
export const COMPLAINT_TOTAL_BUSINESS_DAYS = 15;
export const SETTLEMENT_SUSPENSION_BUSINESS_DAYS = 5;

/** Días hábiles que faltan hasta el vencimiento (incluye el día del vencimiento; 0 si venció). */
export function businessDaysRemaining(now: Date, dueAt: Date, holidays: ReadonlySet<CalendarDate>): number {
  if (now.getTime() > dueAt.getTime()) return 0;
  const today = toLimaCalendarDate(now);
  const dueDate = toLimaCalendarDate(dueAt);
  return countBusinessDaysBetween(today, addDays(dueDate, 1), holidays);
}

/**
 * Semáforo de la bandeja: verde < 10 días hábiles transcurridos, amarillo desde el 10.º,
 * rojo desde el 13.º, vencido pasado el plazo (15, más la suspensión por solución directa).
 */
export function complaintTrafficLight(params: {
  status: string;
  responseSentAt: Date | null;
  responseDueAt: Date;
  settlementOfferedAt: Date | null;
  settlementExpiresAt: Date | null;
  settlementResolved: boolean;
  now: Date;
  holidays: ReadonlySet<CalendarDate>;
}): { light: TrafficLight; businessDaysElapsed: number; businessDaysRemaining: number } {
  const remaining = businessDaysRemaining(params.now, params.responseDueAt, params.holidays);
  const elapsed = Math.max(0, COMPLAINT_TOTAL_BUSINESS_DAYS - remaining);
  if (['answered', 'closed', 'settled'].includes(params.status)) return { light: 'done', businessDaysElapsed: elapsed, businessDaysRemaining: remaining };
  if (
    params.settlementOfferedAt &&
    !params.settlementResolved &&
    params.settlementExpiresAt &&
    params.now.getTime() <= params.settlementExpiresAt.getTime()
  ) {
    return { light: 'suspended', businessDaysElapsed: elapsed, businessDaysRemaining: remaining };
  }
  if (params.now.getTime() > params.responseDueAt.getTime()) return { light: 'overdue', businessDaysElapsed: COMPLAINT_TOTAL_BUSINESS_DAYS, businessDaysRemaining: 0 };
  if (elapsed >= COMPLAINT_RED_AT_BUSINESS_DAY) return { light: 'red', businessDaysElapsed: elapsed, businessDaysRemaining: remaining };
  if (elapsed >= COMPLAINT_YELLOW_AT_BUSINESS_DAY) return { light: 'yellow', businessDaysElapsed: elapsed, businessDaysRemaining: remaining };
  return { light: 'green', businessDaysElapsed: elapsed, businessDaysRemaining: remaining };
}

/** Fin de la suspensión por oferta de solución directa: 5.º día hábil posterior a la oferta. */
export function settlementExpiry(offeredAt: Date, holidays: ReadonlySet<CalendarDate>): Date {
  return endOfBusinessDayAfter(offeredAt, SETTLEMENT_SUSPENSION_BUSINESS_DAYS, holidays);
}

/**
 * Nuevo vencimiento al reanudarse el plazo (rechazo o silencio): el vencimiento original se
 * corre tantos días hábiles como duró la suspensión (máximo 5).
 */
export function resumedResponseDue(params: {
  originalDueAt: Date;
  offeredAt: Date;
  resolvedAt: Date;
  holidays: ReadonlySet<CalendarDate>;
}): Date {
  const offerDate = toLimaCalendarDate(params.offeredAt);
  const resolvedDate = toLimaCalendarDate(params.resolvedAt);
  const suspended = Math.min(SETTLEMENT_SUSPENSION_BUSINESS_DAYS, countBusinessDaysBetween(offerDate, addDays(resolvedDate, 1), params.holidays));
  if (suspended === 0) return params.originalDueAt;
  return endOfBusinessDayAfter(params.originalDueAt, suspended, params.holidays);
}

/** Art. 4-A: la hoja del libro de respaldo se transcribe en 1 día calendario. */
export function isLateTranscription(physicalSubmittedAt: Date, transcribedAt: Date): boolean {
  return transcribedAt.getTime() - physicalSubmittedAt.getTime() > 24 * 60 * 60 * 1000;
}

// =============================================================================
// Solicitudes ARCO (Reglamento Ley 29733, arts. 69, 71, 26.5)
// =============================================================================
export const DSR_TYPES = ['information', 'access', 'portability', 'rectification', 'cancellation', 'opposition', 'revoke_consent'] as const;
export type DsrType = (typeof DSR_TYPES)[number];

export const DSR_DUE_BUSINESS_DAYS: Readonly<Record<DsrType, number>> = {
  information: 8,
  access: 20,
  portability: 20,
  rectification: 10,
  cancellation: 10,
  opposition: 10,
  revoke_consent: 10,
};

export function dsrDueAt(type: DsrType, receivedAt: Date, holidays: ReadonlySet<CalendarDate>): Date {
  return endOfBusinessDayAfter(receivedAt, DSR_DUE_BUSINESS_DAYS[type], holidays);
}

/** Ampliación única por igual plazo (no aplica al derecho de información ni a la revocación). */
export function dsrExtendedDueAt(type: DsrType, currentDueAt: Date, holidays: ReadonlySet<CalendarDate>): Date {
  if (type === 'information' || type === 'revoke_consent') {
    throw new BusinessRuleError('dsr-not-extendable', 'Este tipo de solicitud no admite ampliación de plazo.');
  }
  return endOfBusinessDayAfter(currentDueAt, DSR_DUE_BUSINESS_DAYS[type], holidays);
}

export { addBusinessDays, isBusinessDay };
