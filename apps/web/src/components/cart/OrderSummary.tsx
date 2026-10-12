"use client";

import Image from "next/image";
import { useTranslations } from "next-intl";
import type { ReactNode } from "react";

import { useFormat } from "@/hooks/useFormat";
import { useTravelersText } from "@/hooks/useTravelersText";
import type { CartLine } from "@/lib/cart/types";
import type { PaymentPlan } from "@/lib/checkout/payment-plan";
import { useCartMoney } from "./cart-helpers";

interface OrderSummaryProps {
  lines: CartLine[];
  plan: PaymentPlan;
  title?: string;
  showThumbnails?: boolean;
  children?: ReactNode;
}

/** Resumen del pedido (carrito y checkout): el total es el mismo en ambos. */
export function OrderSummary({ lines, plan, title, showThumbnails = false, children }: OrderSummaryProps) {
  const t = useTranslations("cart");
  const fmt = useFormat();
  const money = useCartMoney();
  const travelersText = useTravelersText();
  const earliestDue = plan.lines
    .map((l) => l.balanceDueDate)
    .filter((d): d is string => !!d)
    .sort()[0];
  const hasPriced = plan.totals.length > 0;

  return (
    <section aria-labelledby="order-summary-title" className="rounded-lg border border-border bg-surface p-5 shadow-md md:p-6">
      <h2 id="order-summary-title" className="text-h4 font-medium">
        {title ?? t("summary")}
      </h2>
      <ul className="mt-4 space-y-3">
        {lines.map((line) => (
          <li key={line.id} className="flex items-start gap-3 text-sm">
            {showThumbnails ? (
              <div className="relative size-14 shrink-0 overflow-hidden rounded-md bg-surface-muted">
                {line.image ? <Image src={line.image.src} alt="" fill sizes="56px" className="object-cover" /> : null}
              </div>
            ) : null}
            <div className="min-w-0 flex-1">
              <p className="line-clamp-2 font-medium text-foreground">{line.title}</p>
              <p className="text-foreground-muted">
                {fmt.date(line.date)} · {travelersText(line.travelers)}
              </p>
            </div>
            <span className="tabular shrink-0 font-medium">{money.lineTotal(line)}</span>
          </li>
        ))}
      </ul>

      <dl className="mt-5 space-y-2 border-t border-border pt-4">
        <div className="flex items-baseline justify-between gap-4">
          <dt className="text-foreground-muted">{t("totalTaxes")}</dt>
          <dd className="tabular text-price-lg font-semibold">{money.totals(plan.totals, "totalCents")}</dd>
        </div>
        {hasPriced ? (
          <>
            <div className="flex items-baseline justify-between gap-4">
              <dt className="text-foreground-muted">{plan.option === "deposit" ? t("payTodayFrom") : t("payToday")}</dt>
              <dd className="tabular font-semibold text-success">{money.totals(plan.totals, "payNowCents")}</dd>
            </div>
            {plan.totals.some((tot) => tot.balanceCents > 0) ? (
              <div className="flex items-baseline justify-between gap-4">
                <dt className="text-foreground-muted">{t("balanceDue")}</dt>
                <dd className="tabular text-right">
                  {money.totals(plan.totals, "balanceCents")}
                  {earliestDue ? (
                    <span className="block text-sm text-foreground-muted">{t("firstDue", { date: fmt.date(earliestDue) })}</span>
                  ) : null}
                </dd>
              </div>
            ) : null}
          </>
        ) : null}
      </dl>

      {plan.unpricedCount > 0 ? (
        <p className="mt-4 rounded-md bg-warning-soft px-3 py-2 text-sm text-warning">
          {plan.unpricedCount === lines.length ? t("summaryAllUnpriced") : t("summarySomeUnpriced", { count: plan.unpricedCount })}
        </p>
      ) : null}

      {children}
    </section>
  );
}
