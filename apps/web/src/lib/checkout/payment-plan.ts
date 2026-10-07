import type { CartLine, Travelers } from "@/lib/cart/types";
import type { Currency, TourPricing } from "@/lib/catalog/types";
import { addDays, daysBetween } from "@/lib/format";

/**
 * Cálculo del plan de pago (RN-01, RN-02, RN-13, RN-14, RN-15). Todo en céntimos enteros.
 *
 * Redondeo (RN-15): adelanto = ceil(total × pct / 100) en céntimos; saldo = total − adelanto.
 * Se calcula por ítem (cada tour tiene su propio saldo y vencimiento) y luego se suma.
 */

export type PaymentOption = "deposit" | "full";

export interface PaymentPlanConfig {
  /** Días antes de la salida en que vence el saldo (RN-02). */
  balanceDaysBeforeDeparture: number;
}

export const DEFAULT_PLAN_CONFIG: PaymentPlanConfig = { balanceDaysBeforeDeparture: 7 };

export type FullPaymentReason = "option" | "policy" | "close-departure";

export interface LinePlan {
  lineId: string;
  title: string;
  date: string;
  currency: Currency | null;
  /** null = tour sin tarifa ("por cotizar"); no se cobra hoy. */
  totalCents: number | null;
  /** Porcentaje efectivo cobrado hoy (50 o 100). */
  percentNow: number;
  payNowCents: number | null;
  balanceCents: number | null;
  balanceDueDate: string | null;
  fullPaymentReason: FullPaymentReason | null;
  policyReason: string | null;
}

export interface CurrencyTotals {
  currency: Currency;
  totalCents: number;
  payNowCents: number;
  balanceCents: number;
}

export interface PaymentPlan {
  option: PaymentOption;
  lines: LinePlan[];
  totals: CurrencyTotals[];
  unpricedCount: number;
  /** Algún ítem admite adelanto (si es false, solo se ofrece el 100 %). */
  depositAvailable: boolean;
}

/** ceil(amount × percent / 100) con aritmética entera exacta. */
export function percentOfCentsCeil(amountCents: number, percent: number): number {
  if (!Number.isInteger(amountCents) || amountCents < 0) throw new RangeError("amountCents debe ser entero ≥ 0");
  if (!Number.isInteger(percent) || percent < 0 || percent > 100) throw new RangeError("percent debe ser entero 0–100");
  return Math.floor((amountCents * percent + 99) / 100);
}

export function lineTotalCents(pricing: TourPricing | null, travelers: Travelers): number | null {
  if (!pricing) return null;
  const child = pricing.childCents ?? pricing.adultCents;
  const infant = pricing.infantCents ?? 0; // Bebés 0–2: gratis salvo tarifa explícita.
  return travelers.adults * pricing.adultCents + travelers.children * child + travelers.infants * infant;
}

function planLine(
  line: CartLine,
  option: PaymentOption,
  today: string,
  config: PaymentPlanConfig,
): LinePlan {
  const totalCents = lineTotalCents(line.unitPricing, line.travelers);
  const daysToDeparture = daysBetween(today, line.date);

  let percentNow = line.paymentPolicy.depositPercent;
  let fullPaymentReason: FullPaymentReason | null = null;
  if (option === "full") {
    percentNow = 100;
    fullPaymentReason = "option";
  } else if (line.paymentPolicy.depositPercent >= 100) {
    percentNow = 100;
    fullPaymentReason = "policy";
  } else if (daysToDeparture <= config.balanceDaysBeforeDeparture) {
    // RN-13: si la salida cae dentro del plazo del saldo, solo se ofrece 100 %.
    percentNow = 100;
    fullPaymentReason = "close-departure";
  }

  if (totalCents === null) {
    return {
      lineId: line.id,
      title: line.title,
      date: line.date,
      currency: null,
      totalCents: null,
      percentNow,
      payNowCents: null,
      balanceCents: null,
      balanceDueDate: null,
      fullPaymentReason,
      policyReason: line.paymentPolicy.fullPaymentReason,
    };
  }

  const payNowCents = percentOfCentsCeil(totalCents, percentNow);
  const balanceCents = totalCents - payNowCents;
  return {
    lineId: line.id,
    title: line.title,
    date: line.date,
    currency: line.unitPricing?.currency ?? null,
    totalCents,
    percentNow,
    payNowCents,
    balanceCents,
    balanceDueDate: balanceCents > 0 ? addDays(line.date, -config.balanceDaysBeforeDeparture) : null,
    fullPaymentReason,
    policyReason: line.paymentPolicy.fullPaymentReason,
  };
}

export function computePaymentPlan(
  lines: readonly CartLine[],
  option: PaymentOption,
  today: string,
  config: PaymentPlanConfig = DEFAULT_PLAN_CONFIG,
): PaymentPlan {
  const planned = lines.map((l) => planLine(l, option, today, config));

  const totalsByCurrency = new Map<Currency, CurrencyTotals>();
  for (const p of planned) {
    if (p.currency === null || p.totalCents === null) continue;
    const acc = totalsByCurrency.get(p.currency) ?? {
      currency: p.currency,
      totalCents: 0,
      payNowCents: 0,
      balanceCents: 0,
    };
    acc.totalCents += p.totalCents;
    acc.payNowCents += p.payNowCents ?? 0;
    acc.balanceCents += p.balanceCents ?? 0;
    totalsByCurrency.set(p.currency, acc);
  }

  // La opción 50 % se ofrece si algún ítem la admite (aunque esté por cotizar: el viajero elige ya).
  const depositAvailable = lines.map((l) => planLine(l, "deposit", today, config)).some((p) => p.percentNow < 100);

  return {
    option,
    lines: planned,
    totals: [...totalsByCurrency.values()],
    unpricedCount: planned.filter((p) => p.totalCents === null).length,
    depositAvailable,
  };
}
