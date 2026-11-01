"use client";

import { useMutation } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { useRef, useState } from "react";

import { confirmBookingPaymentAction, payBookingAction } from "@/app/[locale]/(site)/reserva/[codigo]/actions";
import type { Currency } from "@/lib/catalog/types";
import { useFormat } from "@/hooks/useFormat";
import { izipayConfig, openIzipayForm, type IzipayResponse } from "@/lib/payments/izipay-checkout";
import { PAYMENT_METHOD_LABEL, type PaymentMethod, type PaymentProvider, type PaymentWidgetHandle } from "@/lib/payments/types";
import { useUiStore } from "@/stores/ui-store";
import { buttonClass } from "@/components/ui/button-styles";
import { ErrorSummary } from "./form-fields";
import { HoldTimer } from "./HoldTimer";
import { IzipayPaymentWidget } from "./IzipayPaymentWidget";
import { SandboxPaymentWidget } from "./SandboxPaymentWidget";

const KINDS = ["deposit", "full", "balance"] as const;
type Kind = (typeof KINDS)[number];
const isKind = (value: string): value is Kind => (KINDS as readonly string[]).includes(value);

/** Pago (o reintento) desde la página de la reserva. Todo el cobro ocurre en el servidor (BFF). */
export function PayBookingForm({
  code,
  amountCents,
  currency,
  kind,
  holdExpiresAt,
  provider = "sandbox",
}: {
  code: string;
  amountCents: number;
  currency: Currency;
  kind: string;
  holdExpiresAt: string | null;
  /** Pasarela activa (variable de servidor PAYMENT_PROVIDER). */
  provider?: PaymentProvider;
}) {
  const t = useTranslations("checkout.payBooking");
  const tp = useTranslations("checkout.payment");
  const ti = useTranslations("checkout.izipay");
  const locale = useLocale();
  const fmt = useFormat();
  const router = useRouter();
  const announce = useUiStore((s) => s.announce);
  const widgetRef = useRef<PaymentWidgetHandle>(null);
  const errorRef = useRef<HTMLDivElement>(null);
  const [method, setMethod] = useState<PaymentMethod>("card");
  const [error, setError] = useState<string | null>(null);
  const [expired, setExpired] = useState(false);
  const [opening, setOpening] = useState(false);
  // Candado síncrono: varios clics en el mismo instante llegan antes de que React deshabilite el botón.
  const paying = useRef(false);
  // Izipay no ofrece PagoEfectivo (CIP) en su formulario.
  const methods = (Object.keys(PAYMENT_METHOD_LABEL) as PaymentMethod[]).filter((m) => provider !== "izipay" || m !== "pagoefectivo");

  const request = {
    orderCode: code,
    amountCents,
    currency,
    option: kind === "deposit" ? ("deposit" as const) : ("full" as const),
    description: t("description", { code }),
    providerSessionToken: null,
  };

  const pay = useMutation({
    mutationFn: async () => {
      const confirmation = widgetRef.current ? await widgetRef.current.collect() : { simulate: "approved" as const };
      if (!confirmation) return null; // el widget ya marcó el campo a corregir
      const placed = await payBookingAction({ code, method, simulate: confirmation.simulate });
      if (!placed.ok || placed.data.payment !== "action") return placed;

      const { action } = placed.data;
      let response: IzipayResponse;
      setOpening(true);
      try {
        const buyer = confirmation.buyer!;
        const config = izipayConfig(action, { ...buyer, email: "", holder: confirmation.holder! }, method, locale, code);
        response = await openIzipayForm(action, config);
      } catch {
        return { ok: false as const, error: { code: "izipay-load-failed", kind: "unavailable" as const, message: ti("loadFailed") } };
      } finally {
        setOpening(false);
      }
      return confirmBookingPaymentAction({ code, paymentId: action.paymentId, payloadHttp: response.payloadHttp, signature: response.signature });
    },
    onSuccess: (res) => {
      if (!res) return;
      if (res.ok && (res.data.payment === "open" || res.data.payment === "action")) {
        setError(ti("notCompleted"));
        announce(ti("notCompleted"));
        requestAnimationFrame(() => errorRef.current?.focus());
        return;
      }
      if (res.ok) {
        setError(null);
        announce(res.data.payment === "succeeded" ? t("succeeded") : t("pending"));
        router.refresh();
        return;
      }
      setError(res.error.message);
      announce(res.error.message);
      requestAnimationFrame(() => errorRef.current?.focus());
    },
    onError: () => {
      setError(t("connectionError"));
      requestAnimationFrame(() => errorRef.current?.focus());
    },
  });

  return (
    <form
      noValidate
      aria-labelledby="pay-now-title"
      onSubmit={(e) => {
        e.preventDefault();
        if (paying.current) return;
        paying.current = true;
        pay.mutate(undefined, { onSettled: () => (paying.current = false) });
      }}
    >
      <h3 id="pay-now-title" className="font-medium">
        {t(`kind.${isKind(kind) ? kind : "now"}`)}: <span className="tabular">{fmt.money(amountCents, currency)}</span>
      </h3>
      {error ? (
        <div className="mt-3">
          <ErrorSummary ref={errorRef} title={tp("payFailed")} errors={[{ path: "pay-booking", message: error }]} />
        </div>
      ) : null}
      {holdExpiresAt ? (
        <div className="mt-3">
          <HoldTimer expiresAt={holdExpiresAt} onExpire={() => setExpired(true)} />
        </div>
      ) : null}
      <fieldset className="mt-4">
        <legend className="text-sm font-medium">{tp("method")}</legend>
        <div className="mt-2 flex flex-wrap gap-2">
          {methods.map((m) => (
            <label
              key={m}
              className="inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-pill border border-border-strong px-4 text-sm has-[:checked]:border-primary has-[:checked]:font-medium"
            >
              <input type="radio" name="method" value={m} checked={method === m} onChange={() => setMethod(m)} />
              {tp(`methods.${m}.label`)}
            </label>
          ))}
        </div>
      </fieldset>
      <div className="mt-4">
        {provider === "izipay" ? (
          <IzipayPaymentWidget ref={widgetRef} method={method} disabled={pay.isPending} national={false} askBuyer request={request} />
        ) : (
          <SandboxPaymentWidget ref={widgetRef} method={method} disabled={pay.isPending} request={request} />
        )}
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
            {opening ? ti("opening") : tp("processing")}
          </>
        ) : (
          tp("payAmount", { amount: fmt.money(amountCents, currency) })
        )}
      </button>
    </form>
  );
}
