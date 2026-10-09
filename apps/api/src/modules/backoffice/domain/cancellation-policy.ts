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
