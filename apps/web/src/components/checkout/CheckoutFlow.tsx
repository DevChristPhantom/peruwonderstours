"use client";

import clsx from "clsx";
import { Check, ChevronDown } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useMemo, useRef, useState } from "react";

import { Link, useRouter } from "@/i18n/navigation";
import { computePaymentPlan, type PaymentOption } from "@/lib/checkout/payment-plan";
import type { CheckoutQuote, PlaceResult } from "@/lib/checkout/api-checkout";
import { COUNTRY_PHONE, guessCountry, type ContactValues } from "@/lib/checkout/schemas";
import { todayInLima } from "@/lib/format";
import { PAYMENTS_MODE } from "@/lib/payments/types";
import { useCartHydrated, useCartStore } from "@/stores/cart-store";
import { useTripGate } from "@/stores/trip-store";
import { useIsClient } from "@/hooks/useClientOnly";
import { safeSessionStorage } from "@/stores/safe-storage";
import { useUiStore } from "@/stores/ui-store";
import { useCartMoney } from "@/components/cart/cart-helpers";
import { OrderSummary } from "@/components/cart/OrderSummary";
import { TripConflictAlert } from "@/components/trip/TripConflictAlert";
import { buttonClass } from "@/components/ui/button-styles";
import { ContactStep, EMPTY_CONTACT } from "./ContactStep";
import { PaymentStep } from "./PaymentStep";
import { QuoteSummary } from "./QuoteSummary";

// Dos pasos: cada pantalla extra es un punto donde el cliente abandona. Los datos de cada viajero
// (nombres y documentos para boletos de terceros) se coordinan después de reservar.
type Step = 1 | 2;
const STEPS: { n: Step; key: "contact" | "payment" }[] = [
  { n: 1, key: "contact" },
  { n: 2, key: "payment" },
];

const DRAFT_KEY = "pwt-checkout-draft";

interface Draft {
  contact: ContactValues | null;
}

function loadDraft(): Draft {
  try {
    const raw = safeSessionStorage.getItem(DRAFT_KEY);
    if (typeof raw === "string") return JSON.parse(raw) as Draft;
  } catch {
    /* borrador corrupto: se ignora */
  }
  return { contact: null };
}

function saveDraft(draft: Draft) {
  safeSessionStorage.setItem(DRAFT_KEY, JSON.stringify({ contact: draft.contact }));
}

/** Primera vez: país y código telefónico según el idioma del navegador (se pueden cambiar). */
function initialContact(saved: ContactValues | null): ContactValues {
  if (saved) return { ...EMPTY_CONTACT, ...saved };
  const country = typeof navigator === "undefined" ? null : guessCountry(navigator.languages ?? [navigator.language]);
  if (!country) return EMPTY_CONTACT;
  return { ...EMPTY_CONTACT, country, phoneCountry: COUNTRY_PHONE[country] ?? EMPTY_CONTACT.phoneCountry, receipt: "boleta" };
}

function StepIndicator({ step, maxReached, onGo }: { step: Step; maxReached: Step; onGo: (s: Step) => void }) {
  const t = useTranslations("checkout");
  return (
    <nav aria-label={t("stepsLabel")} className="mb-8">
      <p className="mb-2 text-sm text-foreground-muted md:hidden">
        {t("stepOf", { step, total: STEPS.length })} · {t(`steps.${STEPS[step - 1].key}`)}
      </p>
      <div className="h-1 overflow-hidden rounded-pill bg-surface-muted md:hidden" aria-hidden="true">
        <div className="h-full origin-left bg-primary transition-transform duration-500 motion-reduce:transition-none" style={{ transform: `scaleX(${step / STEPS.length})` }} />
      </div>
      <ol className="hidden items-center gap-3 md:flex">
        {STEPS.map(({ n, key }, i) => {
          const label = t(`steps.${key}`);
          const done = n < step;
          const reachable = n <= maxReached && n !== step;
          const content = (
            <>
              <span
                className={clsx(
                  "inline-flex size-7 items-center justify-center rounded-pill border text-sm font-medium",
                  n === step && "border-primary bg-primary text-on-primary",
                  done && "border-success bg-success text-surface",
                  !done && n !== step && "border-border-strong text-foreground-muted",
                )}
                aria-hidden="true"
              >
                {done ? <Check size={16} strokeWidth={2} /> : n}
              </span>
              <span className={n === step ? "font-medium" : "text-foreground-muted"}>
                {label}
                {done ? <span className="sr-only"> {t("stepDone")}</span> : null}
              </span>
            </>
          );
          return (
            <li key={n} className="flex items-center gap-3" aria-current={n === step ? "step" : undefined}>
              {reachable ? (
                <button type="button" onClick={() => onGo(n)} className="inline-flex min-h-11 items-center gap-2 hover:underline">
                  {content}
                </button>
              ) : (
                <span className="inline-flex min-h-11 items-center gap-2">{content}</span>
              )}
              {i < STEPS.length - 1 ? <span aria-hidden="true" className="h-px w-8 bg-border-strong" /> : null}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

export function CheckoutFlow({ cardFeePercent = null }: { cardFeePercent?: number | null }) {
  const t = useTranslations("checkout");
  const tc = useTranslations("cart");
  const money = useCartMoney();
  const router = useRouter();
  const hydrated = useCartHydrated();
  const lines = useCartStore((s) => s.lines);
  const clearCart = useCartStore((s) => s.clear);
  const announce = useUiStore((s) => s.announce);

  const [step, setStep] = useState<Step>(1);
  const [maxReached, setMaxReached] = useState<Step>(1);
  const [direction, setDirection] = useState<1 | -1>(1);
  // El borrador vive en sessionStorage: en el servidor se usa vacío (se muestra un skeleton igual).
  const [draft, setDraft] = useState<Draft>(() =>
    typeof window === "undefined" ? { contact: null } : loadDraft(),
  );
  const isClient = useIsClient();
  const [option, setOption] = useState<PaymentOption>("deposit");
  const [quote, setQuote] = useState<CheckoutQuote | null>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const firstRender = useRef(true);

  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    headingRef.current?.focus();
    announce(t("stepAnnounce", { step, total: STEPS.length, label: t(`steps.${STEPS[step - 1].key}`) }));
  }, [step, announce, t]);

  const today = useMemo(() => todayInLima(), []);
  const plan = useMemo(() => computePaymentPlan(lines, option, today), [lines, option, today]);
  const { pending: pendingConflicts } = useTripGate(lines);

  const go = (next: Step) => {
    setDirection(next > step ? 1 : -1);
    setStep(next);
    setMaxReached((m) => (next > m ? next : m));
    window.scrollTo({ top: 0 });
  };

  if (!hydrated || !isClient) {
    return (
      <div className="pwt-container py-16" aria-busy="true">
        <div className="h-8 w-64 animate-pulse rounded-md bg-surface-muted motion-reduce:animate-none" />
        <div className="mt-6 h-96 animate-pulse rounded-lg bg-surface-muted motion-reduce:animate-none" />
        <span className="sr-only">{t("loading")}</span>
      </div>
    );
  }

  if (lines.length === 0) {
    return (
      <div className="pwt-container-narrow py-20 text-center">
        <h1 className="font-display text-h1 font-medium">{t("emptyTitle")}</h1>
        <p className="mt-3 text-foreground-muted">{t("emptyText")}</p>
        <Link href="/tours" className={buttonClass("secondary", "lg", "mt-6")}>
          {tc("browseTours")}
        </Link>
      </div>
    );
  }

  // HU-B.A5: tours superpuestos sin confirmar → no se paga hasta cambiar uno o confirmar.
  if (pendingConflicts.length) {
    return (
      <div className="pwt-container-narrow py-12">
        <h1 className="mb-6 font-display text-h1 font-medium">{t("beforePaying")}</h1>
        <TripConflictAlert lines={lines} />
        <Link href="/mi-viaje" className="pwt-link mt-4 inline-flex min-h-11 items-center">
          {tc("viewTrip")}
        </Link>
      </div>
    );
  }

  const onPaid = ({ code }: PlaceResult) => {
    safeSessionStorage.removeItem(DRAFT_KEY);
    clearCart();
    // La reserva se lee en el servidor con el token de la cookie httpOnly (BFF).
    router.replace({ pathname: "/reserva/[codigo]", params: { codigo: code } });
  };

  // Se fusiona con los valores por defecto: borradores antiguos pueden no tener campos nuevos.
  const contact = initialContact(draft.contact);

  return (
    <div className="pwt-container py-8 md:py-12">
      {PAYMENTS_MODE === "sandbox" ? (
        <p className="mb-6 rounded-md border border-dashed border-warning bg-warning-soft px-4 py-2 text-sm text-warning">
          {t("sandboxBanner")}
        </p>
      ) : null}
      <h1 className="sr-only">{t("pageTitle")}</h1>

      <div className="grid gap-10 lg:grid-cols-[minmax(0,640px)_380px] lg:justify-between xl:grid-cols-[minmax(0,640px)_400px]">
        <div className="min-w-0">
          <StepIndicator step={step} maxReached={maxReached} onGo={go} />

          {/* Resumen plegable en móvil/tablet */}
          <details className="mb-8 rounded-lg border border-border bg-surface lg:hidden">
            <summary className="flex min-h-12 cursor-pointer items-center justify-between gap-3 px-4 font-medium">
              <span>{t("viewSummary", { total: money.totals(plan.totals, "totalCents") })}</span>
              <ChevronDown aria-hidden size={18} strokeWidth={1.5} />
            </summary>
            <div className="border-t border-border p-2">
              <OrderSummary lines={lines} plan={plan} />
            </div>
          </details>

          <div key={step} className={direction > 0 ? "pwt-step-forward" : "pwt-step-back"}>
            {step === 1 ? (
              <ContactStep
                headingRef={headingRef}
                defaultValues={contact}
                onSubmit={(values) => {
                  const next = { contact: values };
                  setDraft(next);
                  saveDraft(next);
                  go(2);
                }}
              />
            ) : (
              <PaymentStep
                headingRef={headingRef}
                lines={lines}
                contact={contact}
                option={option}
                onOptionChange={setOption}
                onQuote={setQuote}
                cardFeePercent={cardFeePercent}
                onBackToContact={() => go(1)}
                onPaid={onPaid}
              />
            )}
          </div>
        </div>

        <aside className="hidden lg:block" aria-label={t("summaryLabel")}>
          <div className="sticky top-24">
            {step === 2 && quote ? (
              <QuoteSummary quote={quote} option={option}>
                <Link href="/carrito" className="pwt-link mt-4 inline-flex min-h-11 items-center text-sm">
                  {t("editCart")}
                </Link>
              </QuoteSummary>
            ) : (
              <OrderSummary lines={lines} plan={plan} title={tc("yourOrder")} showThumbnails>
                <Link href="/carrito" className="pwt-link mt-4 inline-flex min-h-11 items-center text-sm">
                  {t("editCart")}
                </Link>
              </OrderSummary>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}
