import { ValidationError } from '../../../shared/domain/domain-error.js';
import { assertCalendarDate } from '../../../shared/domain/calendar-date.js';
import type { CalendarDate } from '../../../shared/domain/calendar-date.js';
import { countBusinessDaysBetween } from '../../complaints/domain/business-days.js';

/**
 * Política de cancelación configurable (CANCELLATION_REFUND_TIERS). SUPUESTO pendiente del
 * cliente (RN-04/RN-05, brain/wiki/negocio/reglas-reserva-y-pago.md): tramos por días HÁBILES
 * de anticipación respecto del primer servicio; se reembolsa un % de lo pagado.
 * Por defecto: >= 20 días hábiles 100 %, 8-19 días 50 %, < 8 días 0 %.
 */
export interface RefundTier {
  /** Aplica si faltan al menos estos días hábiles (estrictamente entre hoy y el servicio). */
  minBusinessDaysBefore: number;
  refundPercent: number;
}

/** Valida y ordena (de mayor a menor anticipación). Lanza Error con un mensaje claro. */
export function parseRefundTiers(raw: unknown): RefundTier[] {
  if (!Array.isArray(raw) || raw.length === 0) throw new Error('debe ser un arreglo JSON no vacío de tramos.');
  const tiers = raw.map((t, i) => {
    const tier = t as Partial<RefundTier> | null;
    const min = tier?.minBusinessDaysBefore;
    const pct = tier?.refundPercent;
    if (!Number.isInteger(min) || (min as number) < 0) throw new Error(`tramo ${i}: minBusinessDaysBefore debe ser un entero >= 0.`);
    if (!Number.isInteger(pct) || (pct as number) < 0 || (pct as number) > 100) throw new Error(`tramo ${i}: refundPercent debe ser un entero 0-100.`);
    return { minBusinessDaysBefore: min as number, refundPercent: pct as number };
  });
  const sorted = [...tiers].sort((a, b) => b.minBusinessDaysBefore - a.minBusinessDaysBefore);
  if (new Set(sorted.map((t) => t.minBusinessDaysBefore)).size !== sorted.length) throw new Error('hay tramos con el mismo minBusinessDaysBefore.');
  if (sorted.at(-1)!.minBusinessDaysBefore !== 0) throw new Error('debe existir un tramo con minBusinessDaysBefore = 0.');
  return sorted;
}

export function parseRefundTiersJson(json: string): RefundTier[] {
  let raw: unknown;
  try {
    raw = JSON.parse(json);
  } catch {
    throw new Error('no es JSON válido.');
  }
  return parseRefundTiers(raw);
}

export interface RefundQuote {
  businessDaysBefore: number;
  tier: RefundTier;
  /** Monto reembolsable según la política (céntimos), ya descontado lo reembolsado antes. */
  refundAmount: bigint;
  /** Lo que retiene la agencia (pagado - reembolso total según política). */
  retainedAmount: bigint;
}

/**
 * Reembolso por cancelación: floor(pagado × %) − ya reembolsado (nunca negativo).
 * El redondeo hacia abajo favorece la exactitud en céntimos (no se reembolsan fracciones).
 */
export function quoteCancellationRefund(params: {
  paidAmount: bigint;
  refundedAmount: bigint;
  today: CalendarDate;
  firstServiceDate: CalendarDate;
  holidays: ReadonlySet<CalendarDate>;
  tiers: readonly RefundTier[];
}): RefundQuote {
  const businessDaysBefore = countBusinessDaysBetween(params.today, params.firstServiceDate, params.holidays);
  const tier = params.tiers.find((t) => businessDaysBefore >= t.minBusinessDaysBefore) ?? params.tiers.at(-1)!;
  const entitled = (params.paidAmount * BigInt(tier.refundPercent)) / 100n;
  const refundAmount = entitled > params.refundedAmount ? entitled - params.refundedAmount : 0n;
  return { businessDaysBefore, tier, refundAmount, retainedAmount: params.paidAmount - entitled };
}

/** Only bookings that accepted this policy family use calendar-day caps. */
export function usesCalendarCancellationPolicy(version: string): boolean {
  return version === '2.0-2026-11-25' || version.startsWith('2.0-2026-11-25-r');
}
export const CALENDAR_CANCELLATION_TIERS = [
  { minDaysBefore: 31, maxRetentionPercent: 10 },
  { minDaysBefore: 16, maxRetentionPercent: 25 },
  { minDaysBefore: 8, maxRetentionPercent: 50 },
  { minDaysBefore: 3, maxRetentionPercent: 75 },
  { minDaysBefore: 0, maxRetentionPercent: 100 },
] as const;
/** Ceiling only, never an automatic charge. Floor cannot exceed the published cap. */
export function quoteCalendarCancellation(params: {
  totalAmount: bigint; paidAmount: bigint; refundedAmount: bigint;
  receivedDate: CalendarDate; firstServiceDate: CalendarDate;
}) {
  assertCalendarDate(params.receivedDate, 'cancellationReceivedDate');
  assertCalendarDate(params.firstServiceDate, 'firstServiceDate');
  if (params.totalAmount < 0n || params.paidAmount < 0n || params.refundedAmount < 0n || params.refundedAmount > params.paidAmount) {
    throw new ValidationError('invalid-cancellation-amounts', 'Los importes de la reserva no son válidos.');
  }
  const calendarDaysBefore = Math.max(0, Math.round((Date.parse(params.firstServiceDate) - Date.parse(params.receivedDate)) / 86_400_000));
  const tier = CALENDAR_CANCELLATION_TIERS.find((t) => calendarDaysBefore >= t.minDaysBefore)!;
  const percentageCap = params.totalAmount * BigInt(tier.maxRetentionPercent) / 100n;
  const remainingPaid = params.paidAmount - params.refundedAmount;
  const maxRetainedAmount = percentageCap < remainingPaid ? percentageCap : remainingPaid;
  return { calendarDaysBefore, tier, maxRetainedAmount, minimumRefundAmount: remainingPaid - maxRetainedAmount, maximumRefundAmount: remainingPaid };
}
/** Operator must enter the justified refund, including zero explicitly. */
export function validateCalendarCancellationDecision(params: Parameters<typeof quoteCalendarCancellation>[0] & {
  refundAmount?: bigint; justification?: string;
}) {
  const quote = quoteCalendarCancellation(params);
  if (params.refundAmount === undefined || !params.justification || params.justification.trim().length < 5) {
    throw new ValidationError('cancellation-decision-required', 'Indica el reembolso y justifica los costos reales de la retención (o la devolución íntegra).');
  }
  if (params.refundAmount < quote.minimumRefundAmount || params.refundAmount > quote.maximumRefundAmount) {
    throw new ValidationError('cancellation-refund-out-of-bounds', 'El reembolso debe respetar el límite máximo de retención y no superar el saldo abonado sin devolver.', {
      minimumRefundAmount: quote.minimumRefundAmount.toString(), maximumRefundAmount: quote.maximumRefundAmount.toString(),
    });
  }
  return { ...quote, refundAmount: params.refundAmount, retainedAmount: quote.maximumRefundAmount - params.refundAmount };
}
