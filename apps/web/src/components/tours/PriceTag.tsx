"use client";

import { useTranslations } from "next-intl";

import type { PaymentPolicy, TourPricing } from "@/lib/catalog/types";
import { percentOfCentsCeil } from "@/lib/checkout/payment-plan";
import { useFormat } from "@/hooks/useFormat";

/**
 * Precio de tarjeta/ficha. Sin tarifa → "Precio a consultar" (seed sin precios).
 * Con tarifa → "Desde S/ X por persona" + adelanto calculado en céntimos.
 */
export function PriceTag({
  pricing,
  policy,
  size = "md",
}: {
  pricing: TourPricing | null;
  policy: PaymentPolicy;
  size?: "md" | "lg";
}) {
  const t = useTranslations("price");
  const f = useFormat();
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
    </div>
  );
}
