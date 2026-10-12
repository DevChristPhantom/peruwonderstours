"use client";

import { useTranslations } from "next-intl";
import type { ReactNode } from "react";

import { useFormat } from "@/hooks/useFormat";

import type { CheckoutQuote } from "@/lib/checkout/api-checkout";
import type { PaymentOption } from "@/lib/checkout/payment-plan";

/** Resumen con los montos VIGENTES de la API (tras revalidar precio y cupo). */
export function QuoteSummary({ quote, option, children }: { quote: CheckoutQuote; option: PaymentOption; children?: ReactNode }) {
  const t = useTranslations("cart");
  const tq = useTranslations("checkout");
  const fmt = useFormat();
  const plans = quote.plans;
  const effective = quote.booking?.option ?? (plans?.deposit ? option : "full");
  const plan = plans ? ((effective === "deposit" ? plans.deposit : plans.full) ?? plans.full ?? plans.deposit) : null;
  const money = (cents: number) => fmt.money(cents, quote.currency);

  return (
    <section aria-labelledby="quote-summary-title" className="rounded-lg border border-border bg-surface p-5 shadow-md md:p-6">
      <h2 id="quote-summary-title" className="text-h4 font-medium">
        {t("yourOrder")}
      </h2>
      <p className="mt-1 text-sm text-foreground-muted">{tq("pricesConfirmed")}</p>
      <ul className="mt-4 space-y-3">
        {quote.lines.map((l) => (
          <li key={l.lineId} className="flex items-start justify-between gap-3 text-sm">
            <span className="min-w-0">
              <span className="line-clamp-2 font-medium">{l.title}</span>
              <span className="text-foreground-muted">{fmt.date(l.date)}</span>
            </span>
            <span className="tabular shrink-0 font-medium">{money(l.subtotalCents)}</span>
          </li>
        ))}
      </ul>
      <dl className="mt-5 space-y-2 border-t border-border pt-4">
        <div className="flex items-baseline justify-between gap-4">
          <dt className="text-foreground-muted">{t("totalTaxes")}</dt>
          <dd className="tabular text-price-lg font-semibold">{money(quote.totalCents)}</dd>
        </div>
        {plan ? (
          <div className="flex items-baseline justify-between gap-4">
            <dt className="text-foreground-muted">{t("payToday")}</dt>
            <dd className="tabular font-semibold text-success">{money(plan.payNowCents)}</dd>
          </div>
        ) : null}
        {plan && plan.balanceCents > 0 ? (
          <div className="flex items-baseline justify-between gap-4">
            <dt className="text-foreground-muted">{t("balanceDue")}</dt>
            <dd className="tabular text-right">
              {money(plan.balanceCents)}
              {plan.balanceDueAt ? (
                <span className="block text-sm text-foreground-muted">{tq("dueOnShort", { date: fmt.instant(plan.balanceDueAt) })}</span>
              ) : null}
            </dd>
          </div>
        ) : null}
      </dl>
      {children}
    </section>
  );
}
