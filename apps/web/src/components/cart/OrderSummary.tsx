"use client";

import Image from "next/image";
import type { ReactNode } from "react";

import { useTravelersText } from "@/hooks/useTravelersText";
import type { CartLine } from "@/lib/cart/types";
import type { PaymentPlan } from "@/lib/checkout/payment-plan";
import { formatDate } from "@/lib/format";
import { formatTotals, lineTotalLabel, POR_COTIZAR } from "./cart-helpers";

interface OrderSummaryProps {
  lines: CartLine[];
  plan: PaymentPlan;
  title?: string;
  showThumbnails?: boolean;
  children?: ReactNode;
}

/** Resumen del pedido (carrito y checkout): el total es el mismo en ambos. */
export function OrderSummary({ lines, plan, title = "Resumen", showThumbnails = false, children }: OrderSummaryProps) {
  const travelersText = useTravelersText();
  const earliestDue = plan.lines
    .map((l) => l.balanceDueDate)
    .filter((d): d is string => !!d)
    .sort()[0];
  const hasPriced = plan.totals.length > 0;

  return (
    <section aria-labelledby="order-summary-title" className="rounded-lg border border-border bg-surface p-5 shadow-md md:p-6">
      <h2 id="order-summary-title" className="text-h4 font-medium">
        {title}
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
                {formatDate(line.date)} · {travelersText(line.travelers)}
              </p>
            </div>
            <span className="tabular shrink-0 font-medium">{lineTotalLabel(line)}</span>
          </li>
        ))}
      </ul>

      <dl className="mt-5 space-y-2 border-t border-border pt-4">
        <div className="flex items-baseline justify-between gap-4">
          <dt className="text-foreground-muted">Total (impuestos incluidos)</dt>
          <dd className="tabular text-price-lg font-semibold">{formatTotals(plan.totals, "totalCents")}</dd>
        </div>
        {hasPriced ? (
          <>
            <div className="flex items-baseline justify-between gap-4">
              <dt className="text-foreground-muted">{plan.option === "deposit" ? "Hoy pagas desde" : "Hoy pagas"}</dt>
              <dd className="tabular font-semibold text-success">{formatTotals(plan.totals, "payNowCents")}</dd>
            </div>
            {plan.totals.some((t) => t.balanceCents > 0) ? (
              <div className="flex items-baseline justify-between gap-4">
                <dt className="text-foreground-muted">Saldo pendiente</dt>
                <dd className="tabular text-right">
                  {formatTotals(plan.totals, "balanceCents")}
                  {earliestDue ? (
                    <span className="block text-sm text-foreground-muted">el primero vence el {formatDate(earliestDue)}</span>
                  ) : null}
                </dd>
              </div>
            ) : null}
          </>
        ) : null}
      </dl>

      {plan.unpricedCount > 0 ? (
        <p className="mt-4 rounded-md bg-warning-soft px-3 py-2 text-sm text-warning">
          {plan.unpricedCount === lines.length
            ? `Precio ${POR_COTIZAR.toLowerCase()}: te enviaremos el monto exacto antes de cobrar.`
            : `${plan.unpricedCount} ${plan.unpricedCount === 1 ? "tour" : "tours"} ${POR_COTIZAR.toLowerCase()}: no se cobran hoy.`}
        </p>
      ) : null}

      {children}
    </section>
  );
}
