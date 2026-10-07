"use client";

import { FlaskConical } from "lucide-react";
import { useId, useImperativeHandle, useState } from "react";

import { formatMoney } from "@/lib/format";
import { PAYMENT_METHOD_LABEL, type PaymentResult, type PaymentWidgetProps } from "@/lib/payments/types";

type SimulatedOutcome = "approved" | "rejected" | "pending";

const DELAY_MS = 900;

/**
 * Implementación SANDBOX de `PaymentWidget`: no contacta a ningún proveedor ni cobra.
 * Ocupa el lugar del formulario embebido del proveedor y permite simular el resultado.
 * No pide datos de tarjeta (en producción los captura el iframe del proveedor).
 */
export function SandboxPaymentWidget({ request, method, disabled, ref }: PaymentWidgetProps) {
  const id = useId();
  const [outcome, setOutcome] = useState<SimulatedOutcome>(method === "pagoefectivo" ? "pending" : "approved");

  useImperativeHandle(
    ref,
    () => ({
      confirm: () =>
        new Promise<PaymentResult>((resolve) => {
          window.setTimeout(() => {
            const reference = `SBX-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
            if (outcome === "approved") {
              resolve({ status: "approved", reference, methodLabel: `${PAYMENT_METHOD_LABEL[method]} (simulado)` });
            } else if (outcome === "pending") {
              const expires = new Date(Date.now() + 24 * 3600 * 1000).toISOString();
              resolve({
                status: "pending",
                reference,
                instructions: "Código CIP simulado. En producción lo emite PagoEfectivo y vence en 24 h.",
                expiresAt: expires,
              });
            } else {
              resolve({
                status: "rejected",
                code: "SANDBOX_DECLINED",
                message: "Tu banco rechazó el pago. Prueba con otra tarjeta o paga con Yape.",
              });
            }
          }, DELAY_MS);
        }),
    }),
    [outcome, method],
  );

  return (
    <div className="rounded-lg border-2 border-dashed border-warning bg-warning-soft p-4">
      <p className="flex items-center gap-2 font-medium text-warning">
        <FlaskConical aria-hidden size={20} strokeWidth={1.5} />
        Modo sandbox: pago simulado, no se realizará ningún cobro
      </p>
      <p className="mt-2 text-sm text-foreground">
        Aquí se mostrará el formulario seguro del proveedor de pagos para {PAYMENT_METHOD_LABEL[method]}. Tus datos de
        tarjeta irán directo al proveedor; Peru Wonders Tours no los guarda.
      </p>
      <p className="mt-2 text-sm text-foreground">
        Monto a enviar: <strong className="tabular">{formatMoney(request.amountCents, request.currency)}</strong> · Orden{" "}
        <span className="font-mono">{request.orderCode}</span>
      </p>
      <fieldset className="mt-3" disabled={disabled}>
        <legend className="text-sm font-medium">Resultado a simular</legend>
        <div className="mt-2 flex flex-wrap gap-2">
          {(
            [
              ["approved", "Aprobado"],
              ["rejected", "Rechazado"],
              ["pending", "Pendiente (CIP)"],
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
                onChange={() => setOutcome(value)}
              />
              {label}
            </label>
          ))}
        </div>
      </fieldset>
    </div>
  );
}
