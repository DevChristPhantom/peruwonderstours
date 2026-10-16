"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { AlertTriangle, CreditCard, Landmark, Loader2, Lock, MessageCircle, RefreshCw, Smartphone } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useRef, useState, type Ref } from "react";
import { useForm, useWatch } from "react-hook-form";

import { placeBookingAction, prepareCheckoutAction } from "@/app/[locale]/(checkout)/checkout/actions";
import type { UserError } from "@/lib/api/problems";
import { useFormat } from "@/hooks/useFormat";
import { useTravelersText } from "@/hooks/useTravelersText";
import { Link } from "@/i18n/navigation";
import { useWhatsappTools } from "@/hooks/useWhatsappTools";
import type { CartLine } from "@/lib/cart/types";
import type { ActionResult, CheckoutQuote, PlaceResult, PlanView } from "@/lib/checkout/api-checkout";
import { checkoutPhoneE164 } from "@/lib/checkout/api-checkout";
import { lineTotalCents, type PaymentOption } from "@/lib/checkout/payment-plan";
import { paymentStepSchema, type ContactValues, type PaymentStepValues, type TravelersValues } from "@/lib/checkout/schemas";
import type { PaymentMethod, PaymentRequest, PaymentWidgetHandle } from "@/lib/payments/types";
import { cartHelpMessage, whatsappHref } from "@/lib/whatsapp/messages";
import { useUiStore } from "@/stores/ui-store";
import { buttonClass } from "@/components/ui/button-styles";
import { HoldTimer } from "./HoldTimer";
import { SandboxPaymentWidget } from "./SandboxPaymentWidget";
import { ErrorSummary, fieldId, flattenErrors, useErrorText } from "./form-fields";

/** Motivos de pago completo que envía la API (`FullPaymentReason` sin `customer_choice`). */
const FULL_ONLY_REASONS = ["departure_too_close", "third_party_tickets", "tour_override", "deposit_covers_total"] as const;
type FullOnlyReason = (typeof FULL_ONLY_REASONS)[number];
const isFullOnlyReason = (reason: string | null | undefined): reason is FullOnlyReason =>
  (FULL_ONLY_REASONS as readonly string[]).includes(reason ?? "");

const METHODS: { value: PaymentMethod; icon: typeof CreditCard }[] = [
  { value: "card", icon: CreditCard },
  { value: "yape", icon: Smartphone },
  { value: "pagoefectivo", icon: Landmark },
];

/**
 * Notas para la reserva: hotel, necesidades y bebés (la API no tiene tipo de pasajero "bebé").
 * Las lee el equipo de operaciones de la agencia: van siempre en español (no son texto de la UI).
 */
function buildNotes(lines: CartLine[], travelers: TravelersValues | null): string | undefined {
  const parts: string[] = [];
  if (travelers?.hotel) parts.push(`Hotel para el recojo: ${travelers.hotel}`);
  if (travelers?.notes) parts.push(`Necesidades especiales: ${travelers.notes}`);
  for (const l of lines) {
    if (l.travelers.infants > 0) parts.push(`${l.title} (${l.date}): ${l.travelers.infants} bebé(s) de 0 a 2 años, sin costo.`);
  }
  return parts.length ? parts.join("\n") : undefined;
}

export function PaymentStep({
  lines,
  contact,
  travelers,
  option,
  onOptionChange,
  onQuote,
  onBackToContact,
  onBackToTravelers,
  onPaid,
  headingRef,
  cardFeePercent,
}: {
  lines: CartLine[];
  contact: ContactValues;
  travelers: TravelersValues | null;
  option: PaymentOption;
  onOptionChange: (o: PaymentOption) => void;
  onQuote: (quote: CheckoutQuote | null) => void;
  onBackToContact: () => void;
  onBackToTravelers: () => void;
  onPaid: (result: PlaceResult) => void;
  headingRef: Ref<HTMLHeadingElement>;
  /** Comisión por tarjeta (RN-03). null = no configurada → no se muestra ni se menciona. */
  cardFeePercent: number | null;
}) {
  const t = useTranslations("checkout.payment");
  const tc = useTranslations("checkout");
  const fmt = useFormat();
  const errorText = useErrorText();
  const announce = useUiStore((s) => s.announce);
  const travelersText = useTravelersText();
  const wa = useWhatsappTools();
  const widgetRef = useRef<PaymentWidgetHandle>(null);
  const summaryRef = useRef<HTMLDivElement>(null);
  const apiErrorRef = useRef<HTMLDivElement>(null);
  const [apiError, setApiError] = useState<(UserError & { bookingCode?: string }) | null>(null);
  const [expired, setExpired] = useState(false);

  /* ---------- 1. Revalidación de precios y cupos en la API (BFF) ---------- */
  const prepare = useMutation({
    mutationFn: async (): Promise<ActionResult<CheckoutQuote>> =>
      prepareCheckoutAction({
        country: contact.country,
        lines: lines.map((l) => ({
          id: l.id,
          tourSlug: l.tourSlug,
          title: l.title,
          date: l.date,
          travelers: l.travelers,
          expectedCents: lineTotalCents(l.unitPricing, l.travelers),
          currency: l.unitPricing?.currency ?? null,
        })),
      }),
    onSuccess: (res) => {
      onQuote(res.ok ? res.data : null);
      if (!res.ok) return;
      const q = res.data;
      if (q.issues.some((i) => i.blocking)) announce(t("announceBlocked"));
      else if (q.priceChanged) announce(t("announcePriceChanged"));
      else announce(t("announceConfirmed", { total: fmt.money(q.totalCents, q.currency) }));
    },
  });
  const { mutate: runPrepare } = prepare;
  // Se cotiza una vez al entrar al paso (las líneas no cambian dentro del checkout).
  useEffect(() => {
    runPrepare();
  }, [runPrepare]);

  const quote = prepare.data?.ok ? prepare.data.data : null;
  const prepareError = prepare.data && !prepare.data.ok ? prepare.data.error : null;

  const plans = quote?.plans ?? null;
  const lockedOption = quote?.booking?.option ?? null;
  const depositAvailable = !!plans?.deposit && !lockedOption;
  const effectiveOption: PaymentOption = lockedOption ?? (depositAvailable ? option : "full");
  const plan: PlanView | null = plans ? (effectiveOption === "deposit" ? plans.deposit : plans.full) ?? plans.full ?? plans.deposit : null;

  const {
    register,
    handleSubmit,
    control,
    setError,
    formState: { errors, submitCount },
  } = useForm<PaymentStepValues>({
    resolver: zodResolver(paymentStepSchema),
    defaultValues: { option, method: "card", terms: false, ackPrice: false },
    mode: "onBlur",
  });
  const method = useWatch({ control, name: "method" });
  const watchedOption = useWatch({ control, name: "option" });

  useEffect(() => {
    if (watchedOption && watchedOption !== option) onOptionChange(watchedOption);
  }, [watchedOption, option, onOptionChange]);

  /* ---------- 2. Reserva + cobro sandbox (Server Action) ---------- */
  const pay = useMutation({
    mutationFn: async (values: PaymentStepValues) => {
      if (!quote || !plan) throw new Error("No quote");
      const confirmation = widgetRef.current ? await widgetRef.current.collect() : { simulate: "approved" as const };
      return placeBookingAction({
        option: effectiveOption,
        method: values.method,
        simulate: confirmation.simulate,
        contact: {
          firstName: contact.firstName, lastName: contact.lastName, email: contact.email, country: contact.country,
          phone: checkoutPhoneE164(contact.phoneCountry, contact.phone),
          marketingEmail: contact.marketingEmail, marketingWhatsapp: contact.marketingWhatsapp,
        },
        notes: buildNotes(lines, travelers),
        acceptTerms: values.terms,
        // La casilla final incluye el acuse de lectura de la Política de privacidad (informativo, no consentimiento).
        acceptPrivacy: values.terms,
        expectedTotalCents: quote.totalCents,
      });
    },
    onSuccess: (res) => {
      if (res.ok) {
        setApiError(null);
        onPaid(res.data);
        return;
      }
      setApiError({ ...res.error, bookingCode: res.bookingCode });
      announce(res.error.message);
      requestAnimationFrame(() => apiErrorRef.current?.focus());
      // Precio o cupo cambió: se vuelve a cotizar para mostrar los montos vigentes.
      if (res.requote) runPrepare();
    },
    onError: () => {
      setApiError({ code: "api-unavailable", kind: "unavailable", message: t("connectionError") });
      requestAnimationFrame(() => apiErrorRef.current?.focus());
    },
  });

  const blocking = quote?.issues.filter((i) => i.blocking) ?? [];
  const canPay = !!quote && !!plan && quote.canCheckout && blocking.length === 0 && !expired;

  const request: PaymentRequest | null =
    quote && plan
      ? {
          orderCode: quote.booking?.code ?? null,
          amountCents: plan.payNowCents + (cardFeePercent && method === "card" ? Math.round((plan.payNowCents * cardFeePercent) / 100) : 0),
          currency: quote.currency,
          option: effectiveOption,
          description: t("requestDescription", { count: lines.length }),
          providerSessionToken: null,
        }
      : null;

  const onValid = (values: PaymentStepValues) => {
    if (quote?.priceChanged && !values.ackPrice) {
      setError("ackPrice", { type: "custom", message: t("ackPriceRequired") });
      requestAnimationFrame(() => summaryRef.current?.focus());
      return;
    }
    pay.mutate(values);
  };

  /* ---------- Estados de carga / error de la cotización ---------- */
  if (prepare.isPending || (!prepare.data && !prepare.isError)) {
    return (
      <div aria-busy="true">
        <h2 id="step-payment-title" ref={headingRef} tabIndex={-1} className="font-display text-h2 font-medium focus:outline-none">
          {t("title")}
        </h2>
        <p className="mt-4 flex items-center gap-2 text-foreground-muted" role="status">
          <Loader2 aria-hidden size={18} strokeWidth={1.5} className="animate-spin motion-reduce:animate-none" />
          {t("confirming")}
        </p>
        <div className="mt-6 h-64 animate-pulse rounded-lg bg-surface-muted motion-reduce:animate-none" />
      </div>
    );
  }

  if (!quote) {
    const message = prepareError?.message ?? t("connectionError");
    return (
      <div>
        <h2 id="step-payment-title" ref={headingRef} tabIndex={-1} className="font-display text-h2 font-medium focus:outline-none">
          {t("title")}
        </h2>
        <div role="alert" className="mt-6 rounded-md border border-danger bg-danger-soft p-4 text-danger">
          <p className="font-medium">{t("prepareFailed")}</p>
          <p className="mt-1 text-sm">{message}</p>
        </div>
        <div className="mt-6 flex flex-wrap gap-3">
          <button type="button" className={buttonClass("primary", "lg")} onClick={() => runPrepare()}>
            <RefreshCw aria-hidden size={18} strokeWidth={1.5} />
            {t("retry")}
          </button>
          <Link href="/carrito" className={buttonClass("ghost", "lg")}>
            {t("backToCart")}
          </Link>
        </div>
      </div>
    );
  }

  const money = (cents: number) => fmt.money(cents, quote.currency);
  // HU-B.A10: contexto del pedido (tours, fechas, código de reserva si ya existe). Sin datos personales.
  const helpHref = (bookingCode: string | null) =>
    whatsappHref(
      cartHelpMessage(
        wa,
        lines.map((l) => ({ title: l.title, date: l.date, travelers: l.travelers })),
        { step: t("whatsappStep"), bookingCode },
      ),
    );
  // Comisión por tarjeta: solo si está configurada, visible ANTES de pagar y sumada al total
  // (Código del Consumidor art. 7). Requiere que la API la cobre antes de activarla (ver reporte).
  const cardFee = cardFeePercent && method === "card" && plan ? Math.round((plan.payNowCents * cardFeePercent) / 100) : 0;
  const payTodayCents = plan ? plan.payNowCents + cardFee : 0;
  const payLabel = plan ? t("payAmount", { amount: money(payTodayCents) }) : t("pay");

  return (
    <form noValidate aria-labelledby="step-payment-title" onSubmit={(e) => handleSubmit(onValid, () => requestAnimationFrame(() => summaryRef.current?.focus()))(e)}>
      <h2 id="step-payment-title" ref={headingRef} tabIndex={-1} className="font-display text-h2 font-medium focus:outline-none">
        {t("title")}
      </h2>
      <p className="mt-2 mb-6 text-foreground-muted">{t("intro")}</p>

      {submitCount > 0 ? <ErrorSummary ref={summaryRef} errors={flattenErrors(errors)} /> : null}

      {apiError ? (
        <ErrorSummary
          ref={apiErrorRef}
          title={t("payFailed")}
          errors={[{ path: apiError.field ?? "submit", message: apiError.message }]}
        >
          <a
            href={helpHref(apiError.bookingCode ?? quote.booking?.code ?? null)}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-3 inline-flex min-h-11 items-center gap-2 text-sm underline underline-offset-2"
          >
            <MessageCircle aria-hidden size={18} strokeWidth={1.5} />
            {t("whatsappHelp")}
          </a>
          {apiError.bookingCode ? (
            <p className="mt-3 text-sm">
              {t.rich("bookingKept", { code: apiError.bookingCode, mono: (chunks) => <span className="font-mono">{chunks}</span> })}{" "}
              <Link href={{ pathname: "/reserva/[codigo]", params: { codigo: apiError.bookingCode } }} className="underline underline-offset-2">
                {t("viewBooking")}
              </Link>
            </p>
          ) : null}
        </ErrorSummary>
      ) : null}

      {/* Incidencias de cupo / fecha / tours sin precio en línea */}
      {blocking.length ? (
        <div role="alert" className="mb-6 rounded-md border border-danger bg-danger-soft p-4 text-danger">
          <p className="flex items-center gap-2 font-medium">
            <AlertTriangle aria-hidden size={18} strokeWidth={1.5} />
            {t("fixCart")}
          </p>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm">
            {blocking.map((i, n) => (
              <li key={`${i.lineId}-${n}`}>{i.message}</li>
            ))}
          </ul>
          <Link href="/carrito" className="mt-3 inline-flex min-h-11 items-center underline underline-offset-2">
            {tc("editCart")}
          </Link>
        </div>
      ) : null}

      {/* Cambios de precio detectados al revalidar */}
      {quote.priceChanged ? (
        <div className="mb-6 rounded-md border border-warning bg-warning-soft p-4 text-sm text-warning" role="status">
          <p className="font-medium text-foreground">{t("priceChangedTitle")}</p>
          <ul className="mt-2 space-y-1 text-foreground">
            {quote.lines
              .filter((l) => l.priceChanged)
              .map((l) => (
                <li key={l.lineId}>
                  {l.title}: <s className="text-foreground-muted">{l.previousCents !== null ? money(l.previousCents) : t("onRequest")}</s>{" "}
                  <span className="tabular font-semibold">{money(l.subtotalCents)}</span>
                </li>
              ))}
          </ul>
          <label className="mt-3 flex cursor-pointer items-start gap-3 text-foreground">
            <input
              id={fieldId("ackPrice")}
              type="checkbox"
              className="mt-1 size-5 shrink-0"
              aria-invalid={!!errors.ackPrice}
              aria-describedby={errors.ackPrice ? `${fieldId("ackPrice")}-error` : undefined}
              {...register("ackPrice")}
            />
            <span>{t("ackPrice", { total: money(quote.totalCents) })}</span>
          </label>
          {errors.ackPrice ? (
            <p id={`${fieldId("ackPrice")}-error`} className="mt-1 ml-8 text-danger">
              {errorText(errors.ackPrice.message)}
            </p>
          ) : null}
        </div>
      ) : null}

      {/* 3.1 ¿Cuánto quieres pagar hoy? */}
      {plans && depositAvailable && plans.deposit && plans.full ? (
        <fieldset>
          <legend className="text-h4 font-medium">{t("howMuch")}</legend>
          <div className="mt-4 space-y-3">
            {(
              [
                ["deposit", t("depositOption", { percent: plans.deposit.depositPercent }), t("depositHelp"), plans.deposit],
                ["full", t("fullOption"), t("fullHelp"), plans.full],
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
                      <span className="tabular font-semibold">{money(p.payNowCents)}</span>
                    </span>
                    <span className="mt-1 block text-sm text-foreground-muted">{help}</span>
                  </span>
                </span>
              </label>
            ))}
          </div>
        </fieldset>
      ) : plan ? (
        <p className="rounded-md bg-surface-muted p-4">
          {lockedOption
            ? t("lockedOption", { code: quote.booking?.code ?? "", amount: money(plan.payNowCents) })
            : isFullOnlyReason(plans?.depositUnavailableReason)
              ? t(`fullOnlyReasons.${plans.depositUnavailableReason}`)
              : t("fullOnly")}
        </p>
      ) : null}

      {/* Desglose con montos de la API */}
      {plan ? (
        <div className="mt-6 rounded-lg border border-border bg-surface p-5" aria-live="polite">
          <ul className="space-y-1 text-sm">
            {quote.lines.map((l) => {
              const local = lines.find((x) => x.id === l.lineId);
              return (
                <li key={l.lineId} className="flex justify-between gap-4">
                  <span className="text-foreground-muted">
                    {l.title} · {fmt.date(l.date)}
                    {local ? ` · ${travelersText(local.travelers)}` : ""}
                  </span>
                  <span className="tabular">{money(l.subtotalCents)}</span>
                </li>
              );
            })}
          </ul>
          <p className="mt-3 flex items-baseline justify-between border-t border-border pt-3">
            <span>{t("bookingTotal")}</span>
            <span className="tabular font-semibold">{money(quote.totalCents)}</span>
          </p>
          {cardFee > 0 ? (
            <>
              <p className="mt-1 flex items-baseline justify-between">
                <span>{effectiveOption === "deposit" ? t("deposit") : t("payment")}</span>
                <span className="tabular">{money(plan.payNowCents)}</span>
              </p>
              <p className="mt-1 flex items-baseline justify-between">
                <span>{t("cardFee", { percent: cardFeePercent ?? 0 })}</span>
                <span className="tabular">{money(cardFee)}</span>
              </p>
            </>
          ) : null}
          <p className="mt-1 flex items-baseline justify-between font-medium">
            <span>{t("payToday")}</span>
            <span className="tabular text-success">{money(payTodayCents)}</span>
          </p>
          {plan.balanceCents > 0 ? (
            <>
              <p className="mt-1 flex items-baseline justify-between">
                <span>{t("balance")}</span>
                <span className="tabular">{money(plan.balanceCents)}</span>
              </p>
              {plan.balanceDueAt ? (
                <p className="text-sm text-foreground-muted">{t("dueOn", { date: fmt.instant(plan.balanceDueAt) })}</p>
              ) : null}
              <p className="mt-3 text-sm text-foreground-muted">
                {t("howToPayBalance")}
              </p>
            </>
          ) : null}
        </div>
      ) : null}

      {/* 3.2 Método de pago */}
      {canPay && request ? (
        <fieldset className="mt-8">
          <legend className="text-h4 font-medium">{t("method")}</legend>
          <div className="mt-3 grid gap-3 sm:grid-cols-3">
            {METHODS.map(({ value, icon: Icon }) => (
              <label
                key={value}
                className="flex cursor-pointer flex-col gap-1 rounded-lg border-2 border-border p-3 has-[:checked]:border-primary has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-ring"
              >
                <span className="flex items-center gap-2 font-medium">
                  <input type="radio" value={value} className="size-5" {...register("method")} />
                  <Icon aria-hidden size={18} strokeWidth={1.5} />
                  {t(`methods.${value}.label`)}
                </span>
                <span className="text-sm text-foreground-muted">{t(`methods.${value}.note`)}</span>
                {value === "card" && cardFeePercent ? (
                  <span className="text-sm text-foreground-muted">{t("cardFeeNote", { percent: cardFeePercent })}</span>
                ) : null}
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
              <span className="font-medium">{t("contact")}</span> {contact.firstName} {contact.lastName} · {contact.email}
            </p>
            <button type="button" className="pwt-link shrink-0" onClick={onBackToContact}>
              {t("edit")}
            </button>
          </div>
          <div className="mt-2 flex justify-between gap-4">
            <p>
              <span className="font-medium">{t("travelers")}</span> {t("tourCount", { count: lines.length })}
            </p>
            <button type="button" className="pwt-link shrink-0" onClick={onBackToTravelers}>
              {t("edit")}
            </button>
          </div>
        </div>

        <div className="rounded-lg bg-surface-muted p-4 text-sm">
          <p className="font-medium">{t("cancellationTitle")}</p>
          {/* TODO(cliente/cumplimiento): texto completo y tabla de penalidades (RN-04 a RN-07) en modal. */}
          <ul className="mt-2 list-disc space-y-1 pl-5 text-foreground-muted">
            <li>{t("cancellation1")}</li>
            <li>{t("cancellation2")}</li>
            <li>{t("cancellation3")}</li>
          </ul>
          <Link href="/politicas/condiciones-de-pago" target="_blank" className="pwt-link mt-2 inline-flex min-h-11 items-center">
            {t("fullPolicy")}
          </Link>
        </div>

        {quote.booking?.holdExpiresAt ? (
          <HoldTimer expiresAt={quote.booking.holdExpiresAt} onExpire={() => setExpired(true)} />
        ) : (
          <p className="text-sm text-foreground-muted">{t("holdNote")}</p>
        )}

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
            <span>
              {t.rich("terms", {
                terms: (chunks) => (
                  <Link href="/politicas/terminos-y-condiciones" target="_blank" className="pwt-link">
                    {chunks}
                  </Link>
                ),
                payments: (chunks) => (
                  <Link href="/politicas/condiciones-de-pago" target="_blank" className="pwt-link">
                    {chunks}
                  </Link>
                ),
                privacy: (chunks) => (
                  <Link href="/politicas/proteccion-de-datos-personales" target="_blank" className="pwt-link">
                    {chunks}
                  </Link>
                ),
              })}
            </span>
          </label>
          {errors.terms ? (
            <p id={`${fieldId("terms")}-error`} className="mt-1 ml-8 text-sm text-danger">
              {errorText(errors.terms.message)}
            </p>
          ) : null}
        </div>
      </div>

      {/* 3.4 Botón final */}
      <button
        id={fieldId("submit")}
        type="submit"
        className={buttonClass("primary", "xl", "mt-8 w-full")}
        disabled={pay.isPending || !canPay}
        aria-busy={pay.isPending}
      >
        {pay.isPending ? (
          <>
            <Loader2 aria-hidden size={20} strokeWidth={1.5} className="animate-spin motion-reduce:animate-none" />
            {t("processing")}
          </>
        ) : (
          payLabel
        )}
      </button>
      <p className="mt-3 flex items-center justify-center gap-2 text-sm text-foreground-muted">
        <Lock aria-hidden size={16} strokeWidth={1.5} />
        {t("secureNote")}
      </p>
      <p className="mt-2 text-center">
        <a
          href={helpHref(quote.booking?.code ?? null)}
          target="_blank"
          rel="noopener noreferrer"
          className="pwt-link inline-flex min-h-11 items-center gap-2 text-sm"
        >
          <MessageCircle aria-hidden size={18} strokeWidth={1.5} />
          {t("payHelp")}
        </a>
      </p>
    </form>
  );
}
