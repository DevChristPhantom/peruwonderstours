import { CurrencyMismatchError, Money } from '../../../shared/domain/money.js';
import {
  calculatePaymentPlan,
  DEFAULT_PAYMENT_PLAN_POLICY,
  DepositNotAvailableError,
  evaluatePaymentOptions,
  type PaymentPlanItem,
} from './payment-plan.js';

const NOW = new Date('2026-10-07T15:00:00.000Z'); // 10:00 Lima
const policy = DEFAULT_PAYMENT_PLAN_POLICY;

function item(amount: bigint, travelDate = '2026-11-10', extra: Partial<PaymentPlanItem> = {}): PaymentPlanItem {
  return { subtotal: Money.of(amount, 'USD'), travelDate, depositPercentOverride: null, includesThirdPartyTickets: false, ...extra };
}

describe('Plan de pago (adelanto/saldo)', () => {
  it('adelanto 50 % por defecto y saldo = total - adelanto', () => {
    const plan = calculatePaymentPlan({ items: [item(100_000n)], requestedOption: 'deposit', now: NOW, policy });
    expect(plan.option).toBe('deposit');
    expect(plan.depositPercent).toBe(50);
    expect(plan.deposit.amount).toBe(50_000n);
    expect(plan.balance.amount).toBe(50_000n);
    expect(plan.deposit.add(plan.balance).equals(plan.total)).toBe(true);
  });

  it('balanceDueAt = inicio del primer servicio en Lima - 7 días', () => {
    const plan = calculatePaymentPlan({ items: [item(100_000n, '2026-11-10'), item(100n, '2026-11-20')], requestedOption: 'deposit', now: NOW, policy });
    expect(plan.firstServiceDate).toBe('2026-11-10');
    expect(plan.balanceDueAt?.toISOString()).toBe('2026-11-03T05:00:00.000Z');
  });

  it('céntimo impar: el adelanto redondea hacia arriba y el saldo absorbe la diferencia', () => {
    const plan = calculatePaymentPlan({ items: [item(10_001n)], requestedOption: 'deposit', now: NOW, policy });
    expect(plan.deposit.amount).toBe(5_001n);
    expect(plan.balance.amount).toBe(5_000n);
  });

  it('total de 1 céntimo: el adelanto cubre todo => 100 %', () => {
    const options = evaluatePaymentOptions({ items: [item(1n)], now: NOW, policy });
    expect(options.deposit).toBeNull();
    expect(options.depositUnavailableReason).toBe('deposit_covers_total');
  });

  it('override 100 % del tour => solo pago total', () => {
    const items = [item(25_001n, '2026-11-12', { depositPercentOverride: 100 })];
    expect(() => calculatePaymentPlan({ items, requestedOption: 'deposit', now: NOW, policy })).toThrow(DepositNotAvailableError);
    const full = calculatePaymentPlan({ items, requestedOption: 'full', now: NOW, policy });
    expect(full).toMatchObject({ option: 'full', depositPercent: 100, balanceDueAt: null, fullPaymentReason: 'tour_override' });
    expect(full.balance.amount).toBe(0n);
  });

  it('override parcial: se aplica el mayor % de los ítems (supuesto conservador)', () => {
    const plan = calculatePaymentPlan({
      items: [item(10_000n), item(10_000n, '2026-11-11', { depositPercentOverride: 70 })],
      requestedOption: 'deposit',
      now: NOW,
      policy,
    });
    expect(plan.depositPercent).toBe(70);
    expect(plan.deposit.amount).toBe(14_000n);
  });

  it('salida dentro de 7 días => solo 100 % (RN-13)', () => {
    const options = evaluatePaymentOptions({ items: [item(10_000n, '2026-10-10')], now: NOW, policy });
    expect(options.deposit).toBeNull();
    expect(options.depositUnavailableReason).toBe('departure_too_close');
    expect(options.full.fullPaymentReason).toBe('departure_too_close');
  });

  it('borde: exactamente 7 días antes del inicio => 100 %; un minuto antes de eso => adelanto', () => {
    const start = new Date('2026-10-14T05:00:00.000Z'); // 2026-10-14 00:00 Lima
    const exactly7 = new Date(start.getTime() - 7 * 86_400_000);
    expect(evaluatePaymentOptions({ items: [item(10_000n, '2026-10-14')], now: exactly7, policy }).deposit).toBeNull();
    const before = new Date(exactly7.getTime() - 60_000);
    expect(evaluatePaymentOptions({ items: [item(10_000n, '2026-10-14')], now: before, policy }).deposit).not.toBeNull();
  });

  it('tours con boletos de terceros => 100 % (RN-14), configurable', () => {
    const items = [item(10_000n, '2026-11-10', { includesThirdPartyTickets: true })];
    expect(evaluatePaymentOptions({ items, now: NOW, policy }).depositUnavailableReason).toBe('third_party_tickets');
    const relaxed = { ...policy, thirdPartyTicketsRequireFull: false };
    expect(evaluatePaymentOptions({ items, now: NOW, policy: relaxed }).deposit?.deposit.amount).toBe(5_000n);
  });

  it('moneda mixta rechazada', () => {
    const mixed = [item(10_000n), { ...item(10_000n), subtotal: Money.of(10_000n, 'PEN') }];
    expect(() => calculatePaymentPlan({ items: mixed, requestedOption: 'deposit', now: NOW, policy })).toThrow(CurrencyMismatchError);
  });

  it('rechaza total cero y lista vacía', () => {
    expect(() => evaluatePaymentOptions({ items: [item(0n)], now: NOW, policy })).toThrow(/mayor que cero/);
    expect(() => evaluatePaymentOptions({ items: [], now: NOW, policy })).toThrow(/No hay servicios/);
  });

  it('política configurable: 30 % y saldo a 10 días', () => {
    const custom = { ...policy, defaultDepositPercent: 30, balanceDueDaysBeforeService: 10 };
    const plan = calculatePaymentPlan({ items: [item(10_000n)], requestedOption: 'deposit', now: NOW, policy: custom });
    expect(plan.deposit.amount).toBe(3_000n);
    expect(plan.balanceDueAt?.toISOString()).toBe('2026-10-31T05:00:00.000Z');
  });

  it('valida la política y los overrides', () => {
    expect(() => evaluatePaymentOptions({ items: [item(1_000n)], now: NOW, policy: { ...policy, defaultDepositPercent: 0 } })).toThrow(/defaultDepositPercent/);
    expect(() => evaluatePaymentOptions({ items: [item(1_000n)], now: NOW, policy: { ...policy, fullPaymentWithinDays: -1 } })).toThrow(/fullPaymentWithinDays/);
    expect(() => evaluatePaymentOptions({ items: [item(1_000n, '2026-11-10', { depositPercentOverride: 120 })], now: NOW, policy })).toThrow(/depositPercentOverride/);
  });

  it('pago total pedido por el cliente', () => {
    const plan = calculatePaymentPlan({ items: [item(10_000n)], requestedOption: 'full', now: NOW, policy });
    expect(plan).toMatchObject({ option: 'full', depositPercent: 100, fullPaymentReason: 'customer_choice', balanceDueAt: null });
    expect(plan.deposit.amount).toBe(10_000n);
  });
});
