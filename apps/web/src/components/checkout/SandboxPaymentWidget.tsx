"use client";

import { FlaskConical } from "lucide-react";
import { useTranslations } from "next-intl";
import { useId, useImperativeHandle, useState } from "react";

import { useFormat } from "@/hooks/useFormat";

import type { PaymentWidgetProps, SimulatedOutcome } from "@/lib/payments/types";

/**
 * Implementación SANDBOX de `PaymentWidget`: no contacta a ningún proveedor ni cobra.
 * Ocupa el lugar del formulario embebido del proveedor y permite elegir el resultado que la
 * pasarela SIMULADA de la API devolverá cuando el servidor confirme el cobro.
 * No pide datos de tarjeta (en producción los captura el iframe del proveedor).
 */
export function SandboxPaymentWidget({ request, method, disabled, ref }: PaymentWidgetProps) {
  const id = useId();
  const t = useTranslations("checkout.sandbox");
  const tp = useTranslations("checkout.payment");
  const fmt = useFormat();
  const [chosen, setChosen] = useState<SimulatedOutcome | null>(null);
  // PagoEfectivo genera un código CIP: por defecto queda pendiente; el resto se aprueba.
  const outcome: SimulatedOutcome = chosen ?? (method === "pagoefectivo" ? "pending" : "approved");

  useImperativeHandle(ref, () => ({ collect: async () => ({ simulate: outcome }) }), [outcome]);

  return (
    <div className="rounded-lg border-2 border-dashed border-warning bg-warning-soft p-4">
      <p className="flex items-center gap-2 font-medium text-warning">
        <FlaskConical aria-hidden size={20} strokeWidth={1.5} />
        {t("title")}
      </p>
      <p className="mt-2 text-sm text-foreground">
        {t("text", { method: tp(`methods.${method}.label`) })}
      </p>
      <p className="mt-2 text-sm text-foreground">
        {t("amount")} <strong className="tabular">{fmt.money(request.amountCents, request.currency)}</strong>
        {request.orderCode ? (
          <>
            {" "}
            · {t("booking")} <span className="font-mono">{request.orderCode}</span>
          </>
        ) : null}
      </p>
      <fieldset className="mt-3" disabled={disabled}>
        <legend className="text-sm font-medium">{t("outcome")}</legend>
        <div className="mt-2 flex flex-wrap gap-2">
          {(
            [
              ["approved", t("approved")],
              ["rejected", t("rejected")],
              ["pending", t("pending")],
            ] as const
          ).map(([value, label]) => (
            <label
              key={value}
              htmlFor={`${id}-${value}`}
              className="inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-pill border border-border-strong bg-surface px-4 text-sm has-[:checked]:border-primary has-[:checked]:font-medium"
            >
              <input
                id={`${id}-${value}`}
                type="radio"
                name={`${id}-outcome`}
                value={value}
                checked={outcome === value}
                onChange={() => setChosen(value)}
              />
              {label}
            </label>
          ))}
        </div>
      </fieldset>
    </div>
  );
}
