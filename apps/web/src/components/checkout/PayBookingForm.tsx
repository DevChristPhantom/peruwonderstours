"use client";

import { useMutation } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";

import { payBookingAction } from "@/app/es/(site)/reserva/[codigo]/actions";
import type { Currency } from "@/lib/catalog/types";
import { formatMoney } from "@/lib/format";
import { PAYMENT_METHOD_LABEL, type PaymentMethod, type PaymentWidgetHandle } from "@/lib/payments/types";
import { useUiStore } from "@/stores/ui-store";
import { buttonClass } from "@/components/ui/button-styles";
import { ErrorSummary } from "./form-fields";
import { HoldTimer } from "./HoldTimer";
import { SandboxPaymentWidget } from "./SandboxPaymentWidget";

const KIND_LABEL: Record<string, string> = { deposit: "el adelanto", full: "el total", balance: "el saldo" };

/** Pago (o reintento) desde la página de la reserva. Todo el cobro ocurre en el servidor (BFF). */
export function PayBookingForm({
  code,
  amountCents,
  currency,
  kind,
  holdExpiresAt,
}: {
  code: string;
  amountCents: number;
  currency: Currency;
  kind: string;
  holdExpiresAt: string | null;
}) {
  const router = useRouter();
  const announce = useUiStore((s) => s.announce);
  const widgetRef = useRef<PaymentWidgetHandle>(null);
  const errorRef = useRef<HTMLDivElement>(null);
  const [method, setMethod] = useState<PaymentMethod>("card");
  const [error, setError] = useState<string | null>(null);
  const [expired, setExpired] = useState(false);

  const pay = useMutation({
    mutationFn: async () => {
      const confirmation = (await widgetRef.current?.collect()) ?? { simulate: "approved" as const };
      return payBookingAction({ code, method, simulate: confirmation.simulate });
    },
    onSuccess: (res) => {
      if (res.ok) {
        setError(null);
        announce(res.data.payment === "succeeded" ? "Pago registrado. Actualizamos tu reserva." : "Pago pendiente de confirmación.");
        router.refresh();
        return;
      }
      setError(res.error.message);
      announce(res.error.message);
      requestAnimationFrame(() => errorRef.current?.focus());
    },
    onError: () => {
      setError("No pudimos conectar con el sistema de pagos. No se te cobró nada; intenta de nuevo.");
      requestAnimationFrame(() => errorRef.current?.focus());
    },
  });

  return (
    <form
      noValidate
      aria-labelledby="pay-now-title"
      onSubmit={(e) => {
        e.preventDefault();
        if (!pay.isPending) pay.mutate();
      }}
    >
      <h3 id="pay-now-title" className="font-medium">
        Pagar {KIND_LABEL[kind] ?? "ahora"}: <span className="tabular">{formatMoney(amountCents, currency)}</span>
      </h3>
      {error ? (
        <div className="mt-3">
          <ErrorSummary ref={errorRef} title="No pudimos completar el pago:" errors={[{ path: "pay-booking", message: error }]} />
        </div>
      ) : null}
      {holdExpiresAt ? (
        <div className="mt-3">
          <HoldTimer expiresAt={holdExpiresAt} onExpire={() => setExpired(true)} />
        </div>
      ) : null}
      <fieldset className="mt-4">
        <legend className="text-sm font-medium">Método de pago</legend>
        <div className="mt-2 flex flex-wrap gap-2">
          {(Object.keys(PAYMENT_METHOD_LABEL) as PaymentMethod[]).map((m) => (
            <label
              key={m}
              className="inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-pill border border-border-strong px-4 text-sm has-[:checked]:border-primary has-[:checked]:font-medium"
            >
              <input type="radio" name="method" value={m} checked={method === m} onChange={() => setMethod(m)} />
              {PAYMENT_METHOD_LABEL[m]}
            </label>
          ))}
        </div>
      </fieldset>
      <div className="mt-4">
        <SandboxPaymentWidget
          ref={widgetRef}
          method={method}
          disabled={pay.isPending}
          request={{
            orderCode: code,
            amountCents,
            currency,
            option: kind === "deposit" ? "deposit" : "full",
            description: `Reserva ${code}`,
            providerSessionToken: null,
          }}
        />
      </div>
      <button
        id="f-pay-booking"
        type="submit"
        className={buttonClass("primary", "lg", "mt-4 w-full")}
        disabled={pay.isPending || expired}
        aria-busy={pay.isPending}
      >
        {pay.isPending ? (
          <>
            <Loader2 aria-hidden size={18} strokeWidth={1.5} className="animate-spin motion-reduce:animate-none" />
            Procesando tu pago…
          </>
        ) : (
          `Pagar ${formatMoney(amountCents, currency)}`
        )}
      </button>
    </form>
  );
}
