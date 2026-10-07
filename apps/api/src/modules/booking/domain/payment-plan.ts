import { minDate, startOfDayInLima, type CalendarDate } from '../../../shared/domain/calendar-date.js';
import { BusinessRuleError, ValidationError } from '../../../shared/domain/domain-error.js';
import { Money } from '../../../shared/domain/money.js';

export type PaymentOption = 'deposit' | 'full';

/**
 * Política del plan de pago. TODOS los valores son SUPUESTOS PENDIENTES DEL CLIENTE
 * (RN-01, RN-02, RN-13, RN-14, RN-15 en brain/wiki/negocio/reglas-reserva-y-pago.md) y se
 * configuran por variables de entorno (ver config/environment.ts).
 */
export interface PaymentPlanPolicy {
  /** % de adelanto por defecto (RN-01: 50). */
  defaultDepositPercent: number;
  /** El saldo vence N días antes del primer servicio (RN-02: 7). */
  balanceDueDaysBeforeService: number;
  /**
   * Si el primer servicio empieza en N días o menos, solo se ofrece el 100 % (RN-13: 7).
   * Se usa "<= N" para que nunca exista un saldo con vencimiento ya cumplido.
   */
  fullPaymentWithinDays: number;
  /** Tours con boletos de terceros (Machu Picchu, tren) exigen el 100 % (RN-14). */
  thirdPartyTicketsRequireFull: boolean;
}

export const DEFAULT_PAYMENT_PLAN_POLICY: PaymentPlanPolicy = Object.freeze({
  defaultDepositPercent: 50,
  balanceDueDaysBeforeService: 7,
  fullPaymentWithinDays: 7,
  thirdPartyTicketsRequireFull: true,
});

export function assertValidPolicy(policy: PaymentPlanPolicy): PaymentPlanPolicy {
  const pct = policy.defaultDepositPercent;
  if (!Number.isInteger(pct) || pct < 1 || pct > 100) {
    throw new ValidationError('invalid-payment-policy', 'defaultDepositPercent debe ser un entero entre 1 y 100.');
  }
  for (const key of ['balanceDueDaysBeforeService', 'fullPaymentWithinDays'] as const) {
    if (!Number.isInteger(policy[key]) || policy[key] < 0) {
      throw new ValidationError('invalid-payment-policy', `${key} debe ser un entero >= 0.`);
    }
  }
  return policy;
}

export interface PaymentPlanItem {
  subtotal: Money;
  travelDate: CalendarDate;
  depositPercentOverride: number | null;
  includesThirdPartyTickets: boolean;
}

export type FullPaymentReason = 'customer_choice' | 'departure_too_close' | 'third_party_tickets' | 'tour_override' | 'deposit_covers_total';

export interface PaymentPlan {
  option: PaymentOption;
  depositPercent: number;
  total: Money;
  deposit: Money;
  balance: Money;
  balanceDueAt: Date | null;
  firstServiceDate: CalendarDate;
  fullPaymentReason: FullPaymentReason | null;
}

export interface PaymentOptions {
  total: Money;
  firstServiceDate: CalendarDate;
  deposit: PaymentPlan | null;
  /** Motivo por el que no se ofrece adelanto (null si sí se ofrece). */
  depositUnavailableReason: Exclude<FullPaymentReason, 'customer_choice'> | null;
  full: PaymentPlan;
}

export class DepositNotAvailableError extends BusinessRuleError {
  constructor(reason: string) {
    super('deposit-not-available', 'Para esta reserva solo está disponible el pago del 100 %.', { reason });
  }
}

const MS_PER_DAY = 86_400_000;

/** Evalúa ambas opciones de pago para mostrarlas antes de pagar (HU-4.2). */
export function evaluatePaymentOptions(params: {
  items: readonly PaymentPlanItem[];
  now: Date;
  policy: PaymentPlanPolicy;
}): PaymentOptions {
  const { items, now } = params;
  const policy = assertValidPolicy(params.policy);
  if (items.length === 0) {
    throw new BusinessRuleError('empty-booking', 'No hay servicios para calcular el plan de pago.');
  }
  // Money.sum rechaza monedas mixtas (CurrencyMismatchError).
  const total = Money.sum(items.map((i) => i.subtotal));
  if (!total.isPositive()) {
    throw new BusinessRuleError('non-positive-total', 'El total de la reserva debe ser mayor que cero.');
  }
  for (const item of items) {
    const o = item.depositPercentOverride;
    if (o !== null && (!Number.isInteger(o) || o < 1 || o > 100)) {
      throw new ValidationError('invalid-deposit-override', 'depositPercentOverride debe estar entre 1 y 100.');
    }
  }

  const firstServiceDate = minDate(items.map((i) => i.travelDate));
  const firstServiceStart = startOfDayInLima(firstServiceDate);
  const full: PaymentPlan = {
    option: 'full',
    depositPercent: 100,
    total,
    deposit: total,
    balance: Money.zero(total.currency),
    balanceDueAt: null,
    firstServiceDate,
    fullPaymentReason: 'customer_choice',
  };

  const forcedFull = (reason: Exclude<FullPaymentReason, 'customer_choice'>): PaymentOptions => ({
    total,
    firstServiceDate,
    deposit: null,
    depositUnavailableReason: reason,
    full: { ...full, fullPaymentReason: reason },
  });

  const fullOnlyFrom = firstServiceStart.getTime() - policy.fullPaymentWithinDays * MS_PER_DAY;
  if (now.getTime() >= fullOnlyFrom) return forcedFull('departure_too_close');

  if (policy.thirdPartyTicketsRequireFull && items.some((i) => i.includesThirdPartyTickets)) {
    return forcedFull('third_party_tickets');
  }

  // Varios ítems: se aplica el mayor % exigido (conservador). El prorrateo por componente
  // (HU-4.2, "50 % del resto + 100 % del boleto") queda pendiente del cliente.
  const percent = Math.max(...items.map((i) => i.depositPercentOverride ?? policy.defaultDepositPercent));
  if (percent >= 100) return forcedFull('tour_override');

  const deposit = total.percentCeil(percent);
  const balance = total.subtract(deposit);
  if (balance.isZero()) return forcedFull('deposit_covers_total');

  return {
    total,
    firstServiceDate,
    depositUnavailableReason: null,
    full,
    deposit: {
      option: 'deposit',
      depositPercent: percent,
      total,
      deposit,
      balance,
      balanceDueAt: new Date(firstServiceStart.getTime() - policy.balanceDueDaysBeforeService * MS_PER_DAY),
      firstServiceDate,
      fullPaymentReason: null,
    },
  };
}

/** Plan para la opción pedida; rechaza "deposit" cuando la política exige el 100 %. */
export function calculatePaymentPlan(params: {
  items: readonly PaymentPlanItem[];
  requestedOption: PaymentOption;
  now: Date;
  policy: PaymentPlanPolicy;
}): PaymentPlan {
  const options = evaluatePaymentOptions(params);
  if (params.requestedOption === 'full') return options.full;
  if (!options.deposit) throw new DepositNotAvailableError(options.depositUnavailableReason ?? 'unknown');
  return options.deposit;
}
