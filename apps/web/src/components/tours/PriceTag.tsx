"use client";

import { useTranslations } from "next-intl";

import type { PaymentPolicy, TourPricing } from "@/lib/catalog/types";
import { percentOfCentsCeil } from "@/lib/checkout/payment-plan";
import { pricingFor, usePriceResidency } from "@/lib/pricing/residency";
import { useFormat } from "@/hooks/useFormat";

/**
 * Precio de tarjetas, ficha y comparador. Sin tarifa → "Precio a consultar".
 * Con tarifa → "Desde S/ X por adulto" + adelanto calculado en céntimos, en la moneda de la residencia
 * elegida (residentes en el Perú: soles; extranjeros: dólares), y debajo el precio de la otra.
 */
export function PriceTag({
  pricing: national,
  foreignPricing = null,
  policy,
  size = "md",
}: {
  /** Soles, tarifa nacional. */
  pricing: TourPricing | null;
  /** Dólares, tarifa extranjera. */
  foreignPricing?: TourPricing | null;
  policy: PaymentPolicy;
  size?: "md" | "lg";
}) {
  const t = useTranslations("price");
  const f = useFormat();
  const [residency] = usePriceResidency();
  const { pricing, other, shown } = pricingFor(residency, national, foreignPricing);
  const fullPayment = policy.depositPercent >= 100;
  return (
    <div className="flex flex-col gap-1">
      {pricing ? (
        <p className="text-sm text-foreground-muted">
          {t.rich("from", {
            amount: () => (
              <strong className={size === "lg" ? "tabular text-price-lg font-semibold text-foreground" : "tabular text-h4 font-semibold text-foreground"}>
                {f.money(pricing.adultCents, pricing.currency)}
              </strong>
            ),
          })}
        </p>
      ) : (
        <p className={size === "lg" ? "text-h3 font-semibold text-foreground" : "text-body font-semibold text-foreground"}>{t("onRequest")}</p>
      )}
      <p className={fullPayment ? "text-sm text-warning" : "text-sm text-success"}>
        {fullPayment
          ? t("fullPayment")
          : pricing
            ? t("depositAmount", {
                percent: policy.depositPercent,
                amount: f.money(percentOfCentsCeil(pricing.adultCents, policy.depositPercent), pricing.currency),
              })
            : t("depositPercent", { percent: policy.depositPercent })}
      </p>
      {other ? (
        <p className="text-xs text-foreground-muted">
          {t(shown === "national" ? "otherForeign" : "otherNational", { amount: f.money(other.adultCents, other.currency) })}
        </p>
      ) : null}
    </div>
  );
}
