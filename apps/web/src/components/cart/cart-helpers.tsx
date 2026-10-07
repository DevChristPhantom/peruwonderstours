import type { CartLine } from "@/lib/cart/types";
import type { CurrencyTotals } from "@/lib/checkout/payment-plan";
import { lineTotalCents } from "@/lib/checkout/payment-plan";
import { formatMoney } from "@/lib/format";

export const POR_COTIZAR = "Por cotizar";

export function lineTotalLabel(line: CartLine): string {
  const total = lineTotalCents(line.unitPricing, line.travelers);
  return total === null || !line.unitPricing ? POR_COTIZAR : formatMoney(total, line.unitPricing.currency);
}

/** Totales por moneda ("S/ 1,250.00" o "S/ 1,250.00 + USD 300.00"). */
export function formatTotals(totals: CurrencyTotals[], key: "totalCents" | "payNowCents" | "balanceCents"): string {
  if (!totals.length) return POR_COTIZAR;
  return totals.map((t) => formatMoney(t[key], t.currency)).join(" + ");
}
