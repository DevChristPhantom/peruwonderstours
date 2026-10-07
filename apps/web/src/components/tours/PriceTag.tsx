import type { PaymentPolicy, TourPricing } from "@/lib/catalog/types";
import { percentOfCentsCeil } from "@/lib/checkout/payment-plan";
import { formatMoney } from "@/lib/format";

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
  const fullPayment = policy.depositPercent >= 100;
  return (
    <div className="flex flex-col gap-1">
      {pricing ? (
        <p className="text-sm text-foreground-muted">
          Desde{" "}
          <strong className={size === "lg" ? "tabular text-price-lg font-semibold text-foreground" : "tabular text-h4 font-semibold text-foreground"}>
            {formatMoney(pricing.adultCents, pricing.currency)}
          </strong>{" "}
          por persona
        </p>
      ) : (
        <p className={size === "lg" ? "text-h3 font-semibold text-foreground" : "text-body font-semibold text-foreground"}>
          Precio a consultar
        </p>
      )}
      <p className={fullPayment ? "text-sm text-warning" : "text-sm text-success"}>
        {fullPayment
          ? "Pago completo al reservar"
          : pricing
            ? `Reserva con ${policy.depositPercent} %: ${formatMoney(
                percentOfCentsCeil(pricing.adultCents, policy.depositPercent),
                pricing.currency,
              )}`
            : `Reserva con el ${policy.depositPercent} % del total`}
      </p>
    </div>
  );
}
