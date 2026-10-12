"use client";

import { useLocale, useTranslations } from "next-intl";
import { useMemo } from "react";

import type { Locale } from "@/i18n/routing";
import type { CartLine } from "@/lib/cart/types";
import type { CurrencyTotals } from "@/lib/checkout/payment-plan";
import { lineTotalCents } from "@/lib/checkout/payment-plan";
import { formatMoney } from "@/lib/format";

type TotalKey = "totalCents" | "payNowCents" | "balanceCents";

export function lineTotalLabel(line: CartLine, locale: Locale, onRequest: string): string {
  const total = lineTotalCents(line.unitPricing, line.travelers);
  return total === null || !line.unitPricing ? onRequest : formatMoney(total, line.unitPricing.currency, locale);
}

/** Totales por moneda ("S/ 1,250.00" o "S/ 1,250.00 + USD 300.00"). */
export function formatTotals(totals: CurrencyTotals[], key: TotalKey, locale: Locale, onRequest: string): string {
  if (!totals.length) return onRequest;
  return totals.map((t) => formatMoney(t[key], t.currency, locale)).join(" + ");
}

/** Montos del carrito en el idioma activo ("Por cotizar" / "Price on request" si falta precio). */
export function useCartMoney() {
  const locale = useLocale();
  const t = useTranslations("cart");
  const onRequest = t("onRequest");
  return useMemo(
    () => ({
      onRequest,
      lineTotal: (line: CartLine) => lineTotalLabel(line, locale, onRequest),
      totals: (totals: CurrencyTotals[], key: TotalKey) => formatTotals(totals, key, locale, onRequest),
    }),
    [locale, onRequest],
  );
}
