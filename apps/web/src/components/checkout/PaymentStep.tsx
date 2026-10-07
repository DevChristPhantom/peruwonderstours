"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { CreditCard, Landmark, Loader2, Lock, Smartphone } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState, type Ref } from "react";
import { useForm, useWatch } from "react-hook-form";

import type { CartLine } from "@/lib/cart/types";
import { computePaymentPlan, type LinePlan, type PaymentOption } from "@/lib/checkout/payment-plan";
import { paymentStepSchema, type ContactValues, type PaymentStepValues } from "@/lib/checkout/schemas";
import { formatDate, formatMoney, todayInLima } from "@/lib/format";
import type { PaymentMethod, PaymentRequest, PaymentResult, PaymentWidgetHandle } from "@/lib/payments/types";
import { useUiStore } from "@/stores/ui-store";
import { formatTotals } from "@/components/cart/cart-helpers";
import { buttonClass } from "@/components/ui/button-styles";
import { HoldTimer } from "./HoldTimer";
import { SandboxPaymentWidget } from "./SandboxPaymentWidget";
import { ErrorSummary, fieldId, flattenErrors } from "./form-fields";

const METHODS: { value: PaymentMethod; label: string; icon: typeof CreditCard; note: string }[] = [
  { value: "card", label: "Tarjeta", icon: CreditCard, note: "Visa, Mastercard, Amex, Diners" },
  { value: "yape", label: "Yape", icon: Smartphone, note: "Pago desde tu celular" },
  { value: "pagoefectivo", label: "PagoEfectivo", icon: Landmark, note: "Banca por internet o agentes (código CIP 24 h)" },
];

function lineNote(l: LinePlan): string {
  if (l.totalCents === null) return "por cotizar";
  if (l.fullPaymentReason === "policy") return "100 % (boletos)";
  if (l.fullPaymentReason === "close-departure") return "100 % (sale en menos de 7 días)";
  return `${l.percentNow} %`;
}

function lineMoney(l: LinePlan, key: "payNowCents" | "balanceCents" | "totalCents"): string {
  const v = l[key];
  return v === null || !l.currency ? "Por cotizar" : formatMoney(v, l.currency);
}

export interface PaymentSubmit {
  option: PaymentOption;
  method: PaymentMethod;
  result: PaymentResult | null;
}

export function PaymentStep({
  lines,
  contact,
  orderCode,
  option,
  onOptionChange,
  onBackToContact,
  onBackToTravelers,
  onPaid,
  headingRef,
}: {
  lines: CartLine[];
  contact: ContactValues;
  orderCode: string;
  option: PaymentOption;
  onOptionChange: (o: PaymentOption) => void;
  onBackToContact: () => void;
  onBackToTravelers: () => void;
  onPaid: (submit: PaymentSubmit) => void;
  headingRef: Ref<HTMLHeadingElement>;
}) {
  const announce = useUiStore((s) => s.announce);
  const widgetRef = useRef<PaymentWidgetHandle>(null);
  const summaryRef = useRef<HTMLDivElement>(null);
  const [rejection, setRejection] = useState<string | null>(null);

  const today = useMemo(() => todayInLima(), []);
  const depositPlan = useMemo(() => computePaymentPlan(lines, "deposit", today), [lines, today]);
  const fullPlan = useMemo(() => computePaymentPlan(lines, "full", today), [lines, today]);
  const effectiveOption: PaymentOption = depositPlan.depositAvailable ? option : "full";
  const plan = effectiveOption === "deposit" ? depositPlan : fullPlan;
  const multiCurrency = plan.totals.length > 1;
  const payNow = plan.totals[0] ?? null;
  const quoteOnly = !payNow || payNow.payNowCents === 0;

  const {
    register,
    handleSubmit,
    control,
    formState: { errors, submitCount },
  } = useForm<PaymentStepValues>({
    resolver: zodResolver(paymentStepSchema),
    defaultValues: { option: effectiveOption, method: "card", terms: false },
    mode: "onBlur",
  });
  const method = useWatch({ control, name: "method" });
  const watchedOption = useWatch({ control, name: "option" });

  useEffect(() => {
    if (watchedOption && watchedOption !== option) onOptionChange(watchedOption);
  }, [watchedOption, option, onOptionChange]);

  useEffect(() => {
    if (!payNow) return;
    announce(`Pagarás hoy ${formatMoney(payNow.payNowCents, payNow.currency)}.`);
  }, [effectiveOption, payNow, announce]);

  const request: PaymentRequest | null = payNow
    ? {
        orderCode,
        amountCents: payNow.payNowCents,
        currency: payNow.currency,
        option: effectiveOption,
        description: `Reserva ${orderCode} · ${lines.length} ${lines.length === 1 ? "tour" : "tours"}`,
        customer: { firstName: contact.firstName, lastName: contact.lastName, email: contact.email },
        providerSessionToken: null,
      }
    : null;

  const pay = useMutation({
    mutationFn: async (values: PaymentStepValues): Promise<PaymentSubmit> => {
      // TODO(backend): POST /api/v1/bookings (crea orden + hold y congela precios) antes del widget.
      if (quoteOnly || !widgetRef.current) return { option: effectiveOption, method: values.method, result: null };
      const result = await widgetRef.current.confirm();
      return { option: effectiveOption, method: values.method, result };
    },
    onSuccess: (submit) => {
      if (submit.result?.status === "rejected") {
        setRejection(submit.result.message);
        announce(submit.result.message);
        return;
      }
      setRejection(null);
      onPaid(submit);
    },
  });

  const payLabel = quoteOnly
    ? "Enviar solicitud de reserva"
    : `Pagar ${formatTotals(plan.totals, "payNowCents")}`;

  return (
    <form
      noValidate
      aria-labelledby="step-payment-title"
      onSubmit={(e) =>
        handleSubmit(
          (values) => pay.mutate(values),
          () => requestAnimationFrame(() => summaryRef.current?.focus()),
        )(e)
      }
    >
      <h2 id="step-payment-title" ref={headingRef} tabIndex={-1} className="font-display text-h2 font-medium focus:outline-none">
        Pago
      </h2>
      <p className="mt-2 mb-6 text-foreground-muted">Revisa el monto, elige cómo pagar y confirma.</p>

      {submitCount > 0 ? <ErrorSummary ref={summaryRef} errors={flattenErrors(errors)} /> : null}

      {/* 3.1 ¿Cuánto quieres pagar hoy? */}
      {depositPlan.depositAvailable ? (
        <fieldset>
          <legend className="text-h4 font-medium">¿Cuánto quieres pagar hoy?</legend>
          <div className="mt-4 space-y-3">
            {(
              [
                ["deposit", "Pagar 50 % ahora", "Reserva tus cupos hoy y paga el resto antes de viajar.", depositPlan],
                ["full", "Pagar el 100 % ahora", "Sin saldos pendientes. Recibes un solo comprobante.", fullPlan],
              ] as const
            ).map(([value, label, help, p]) => (
              <label
                key={value}
                className="block cursor-pointer rounded-lg border-2 border-border p-4 transition-colors duration-150 has-[:checked]:border-primary has-[:checked]:bg-surface-muted has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-ring"
              >
                <span className="flex items-start gap-3">
                  <input type="radio" value={value} className="mt-1 size-5 shrink-0" {...register("option")} />
                  <span className="flex-1">
                    <span className="flex flex-wrap items-baseline justify-between gap-2">
                      <span className="font-medium">{label}</span>
                      <span className="tabular font-semibold">{formatTotals(p.totals, "payNowCents")}</span>
                    </span>
                    <span className="mt-1 block text-sm text-foreground-muted">{help}</span>
                  </span>
                </span>
              </label>
            ))}
          </div>
        </fieldset>
      ) : (
        <p className="rounded-md bg-surface-muted p-4">
          Este pedido se paga completo: incluye boletos de terceros o salidas en menos de 7 días.
        </p>
      )}

      {/* Desglose (siempre visible con 50 %) */}
      <div className="mt-6 rounded-lg border border-border bg-surface p-5" aria-live="polite">
        <h3 className="flex items-baseline justify-between font-medium">
          <span>Hoy</span>
          <span className="tabular">{formatTotals(plan.totals, "payNowCents")}</span>
        </h3>
        <ul className="mt-2 space-y-1 text-sm">
          {plan.lines.map((l) => (
            <li key={l.lineId} className="flex justify-between gap-4">
              <span className="text-foreground-muted">
                {l.title} · {lineNote(l)}
              </span>
              <span className="tabular">{lineMoney(l, "payNowCents")}</span>
            </li>
          ))}
        </ul>
        {plan.totals.some((t) => t.balanceCents > 0) ? (
          <>
            <h3 className="mt-4 flex items-baseline justify-between border-t border-border pt-3 font-medium">
              <span>Saldo pendiente</span>
              <span className="tabular">{formatTotals(plan.totals, "balanceCents")}</span>
            </h3>
            <ul className="mt-2 space-y-1 text-sm">
              {plan.lines
                .filter((l) => (l.balanceCents ?? 0) > 0 && l.balanceDueDate)
                .map((l) => (
                  <li key={l.lineId} className="text-foreground-muted">
                    <span className="tabular text-foreground">{lineMoney(l, "balanceCents")}</span> hasta el{" "}
                    {formatDate(l.balanceDueDate as string)} ({l.title})
                  </li>
                ))}
            </ul>
            <p className="mt-3 text-sm text-foreground-muted">
              Cómo pagar el saldo: enlace de pago que te enviaremos por correo y WhatsApp, o en efectivo/transferencia en Puno.
            </p>
          </>
        ) : null}
        {plan.unpricedCount > 0 ? (
          <p className="mt-3 rounded-md bg-warning-soft px-3 py-2 text-sm text-warning">
            {plan.unpricedCount === lines.length
              ? "Tus tours aún no tienen precio publicado: hoy no se cobra nada. Te enviaremos la cotización para confirmar."
              : "Los tours por cotizar no se cobran hoy; te enviaremos su precio."}
          </p>
        ) : null}
        {multiCurrency ? (
          <p className="mt-3 rounded-md bg-danger-soft px-3 py-2 text-sm text-danger">
            Tu carrito tiene tours en distintas monedas. Por ahora se cobra cada moneda por separado: escríbenos para completar la reserva.
          </p>
        ) : null}
      </div>

      {/* 3.2 Método de pago */}
      {!quoteOnly && request ? (
        <fieldset className="mt-8">
          <legend className="text-h4 font-medium">Método de pago</legend>
          {rejection ? (
            <p role="alert" className="mt-3 rounded-md bg-danger-soft p-3 text-sm text-danger">
              {rejection}
            </p>
          ) : null}
          <div className="mt-3 grid gap-3 sm:grid-cols-3">
            {METHODS.map(({ value, label, icon: Icon, note }) => (
              <label
                key={value}
                className="flex cursor-pointer flex-col gap-1 rounded-lg border-2 border-border p-3 has-[:checked]:border-primary has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-ring"
              >
                <span className="flex items-center gap-2 font-medium">
                  <input type="radio" value={value} className="size-5" {...register("method")} />
                  <Icon aria-hidden size={18} strokeWidth={1.5} />
                  {label}
                </span>
                <span className="text-sm text-foreground-muted">{note}</span>
              </label>
            ))}
          </div>
          <div className="mt-4">
            <SandboxPaymentWidget ref={widgetRef} request={request} method={method} disabled={pay.isPending} />
          </div>
        </fieldset>
      ) : null}

      {/* 3.3 Revisión y consentimiento */}
      <div className="mt-8 space-y-4">
        <div className="rounded-lg border border-border p-4 text-sm">
          <div className="flex justify-between gap-4">
            <p>
              <span className="font-medium">Contacto:</span> {contact.firstName} {contact.lastName} · {contact.email}
            </p>
            <button type="button" className="pwt-link shrink-0" onClick={onBackToContact}>
              Editar
            </button>
          </div>
          <div className="mt-2 flex justify-between gap-4">
            <p>
              <span className="font-medium">Viajeros:</span> {lines.length} {lines.length === 1 ? "tour" : "tours"}
            </p>
            <button type="button" className="pwt-link shrink-0" onClick={onBackToTravelers}>
              Editar
            </button>
          </div>
        </div>

        <div className="rounded-lg bg-surface-muted p-4 text-sm">
          <p className="font-medium">Política de cancelación (resumen)</p>
          {/* TODO(cliente/cumplimiento): texto completo y tabla de penalidades (RN-04 a RN-07) en modal. */}
          <ul className="mt-2 list-disc space-y-1 pl-5 text-foreground-muted">
            <li>Cancelaciones con al menos 20 días hábiles: se descuentan gastos de servicios ya emitidos.</li>
            <li>Boletos de tren, ingreso a Machu Picchu y sobrevuelos no son reembolsables una vez emitidos.</li>
            <li>Cancelaciones con pocos días o servicios no usados: sin devolución.</li>
          </ul>
          <Link href="/es/politicas/condiciones-de-pago" target="_blank" className="pwt-link mt-2 inline-flex min-h-11 items-center">
            Ver política completa
          </Link>
        </div>

        <HoldTimer />

        <div>
          <label className="flex cursor-pointer items-start gap-3">
            <input
              id={fieldId("terms")}
              type="checkbox"
              className="mt-1 size-5 shrink-0"
              aria-invalid={!!errors.terms}
              aria-describedby={errors.terms ? `${fieldId("terms")}-error` : undefined}
              {...register("terms")}
            />
            <span>Leí y acepto los Términos y condiciones y la Política de cancelación.</span>
          </label>
          {errors.terms ? (
            <p id={`${fieldId("terms")}-error`} className="mt-1 ml-8 text-sm text-danger">
              {errors.terms.message}
            </p>
          ) : null}
        </div>
      </div>

      {/* 3.4 Botón final */}
      <button
        type="submit"
        className={buttonClass("primary", "xl", "mt-8 w-full")}
        disabled={pay.isPending || multiCurrency}
        aria-busy={pay.isPending}
      >
        {pay.isPending ? (
          <>
            <Loader2 aria-hidden size={20} strokeWidth={1.5} className="animate-spin motion-reduce:animate-none" />
            Procesando tu pago…
          </>
        ) : (
          payLabel
        )}
      </button>
      <p className="mt-3 flex items-center justify-center gap-2 text-sm text-foreground-muted">
        <Lock aria-hidden size={16} strokeWidth={1.5} />
        Pago seguro · Recibirás tu comprobante electrónico por correo
      </p>
    </form>
  );
}
