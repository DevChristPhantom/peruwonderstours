"use client";

import clsx from "clsx";
import { Check, ChevronDown } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";

import { computePaymentPlan, type PaymentOption } from "@/lib/checkout/payment-plan";
import type { CheckoutQuote, PlaceResult } from "@/lib/checkout/api-checkout";
import type { ContactValues, TravelersValues } from "@/lib/checkout/schemas";
import { todayInLima } from "@/lib/format";
import { PAYMENTS_MODE } from "@/lib/payments/types";
import { useCartHydrated, useCartStore } from "@/stores/cart-store";
import { useIsClient } from "@/hooks/useClientOnly";
import { safeSessionStorage } from "@/stores/safe-storage";
import { useUiStore } from "@/stores/ui-store";
import { formatTotals } from "@/components/cart/cart-helpers";
import { OrderSummary } from "@/components/cart/OrderSummary";
import { buttonClass } from "@/components/ui/button-styles";
import { ContactStep, EMPTY_CONTACT } from "./ContactStep";
import { PaymentStep } from "./PaymentStep";
import { QuoteSummary } from "./QuoteSummary";
import { buildTravelerDefaults, TravelersStep } from "./TravelersStep";

type Step = 1 | 2 | 3;
const STEPS: { n: Step; label: string }[] = [
  { n: 1, label: "Tus datos" },
  { n: 2, label: "Viajeros" },
  { n: 3, label: "Pago" },
];

const DRAFT_KEY = "pwt-checkout-draft";

interface Draft {
  contact: ContactValues | null;
  /** Sin números de documento (minimización de datos). */
  travelers: TravelersValues | null;
}

function loadDraft(): Draft {
  try {
    const raw = safeSessionStorage.getItem(DRAFT_KEY);
    if (typeof raw === "string") return JSON.parse(raw) as Draft;
  } catch {
    /* borrador corrupto: se ignora */
  }
  return { contact: null, travelers: null };
}

function saveDraft(draft: Draft) {
  const safe: Draft = {
    contact: draft.contact,
    travelers: draft.travelers
      ? {
          ...draft.travelers,
          lines: draft.travelers.lines.map((l) => ({
            ...l,
            travelers: l.travelers.map((t) => ({ ...t, docNumber: "" })),
          })),
        }
      : null,
  };
  safeSessionStorage.setItem(DRAFT_KEY, JSON.stringify(safe));
}

function StepIndicator({ step, maxReached, onGo }: { step: Step; maxReached: Step; onGo: (s: Step) => void }) {
  return (
    <nav aria-label="Pasos del pago" className="mb-8">
      <p className="mb-2 text-sm text-foreground-muted md:hidden">
        Paso {step} de 3 · {STEPS[step - 1].label}
      </p>
      <div className="h-1 overflow-hidden rounded-pill bg-surface-muted md:hidden" aria-hidden="true">
        <div className="h-full bg-primary transition-[width] duration-500" style={{ width: `${(step / 3) * 100}%` }} />
      </div>
      <ol className="hidden items-center gap-3 md:flex">
        {STEPS.map(({ n, label }, i) => {
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
                {done ? <span className="sr-only"> (completado)</span> : null}
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
    typeof window === "undefined" ? { contact: null, travelers: null } : loadDraft(),
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
    announce(`Paso ${step} de 3: ${STEPS[step - 1].label}.`);
  }, [step, announce]);

  const today = useMemo(() => todayInLima(), []);
  const plan = useMemo(() => computePaymentPlan(lines, option, today), [lines, option, today]);

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
        <span className="sr-only">Cargando el pago…</span>
      </div>
    );
  }

  if (lines.length === 0) {
    return (
      <div className="pwt-container-narrow py-20 text-center">
        <h1 className="font-display text-h1 font-medium">No hay tours para pagar</h1>
        <p className="mt-3 text-foreground-muted">Tu carrito está vacío. Elige un tour para continuar.</p>
        <Link href="/es/tours" className={buttonClass("secondary", "lg", "mt-6")}>
          Ver tours
        </Link>
      </div>
    );
  }

  const onPaid = ({ code }: PlaceResult) => {
    safeSessionStorage.removeItem(DRAFT_KEY);
    clearCart();
    // La reserva se lee en el servidor con el token de la cookie httpOnly (BFF).
    router.replace(`/es/reserva/${encodeURIComponent(code)}`);
  };

  // Se fusiona con los valores por defecto: borradores antiguos pueden no tener campos nuevos.
  const contact: ContactValues = { ...EMPTY_CONTACT, ...draft.contact };

  return (
    <div className="pwt-container py-8 md:py-12">
      {PAYMENTS_MODE === "sandbox" ? (
        <p className="mb-6 rounded-md border border-dashed border-warning bg-warning-soft px-4 py-2 text-sm text-warning">
          Entorno de pruebas (sandbox): los pagos son simulados; las reservas y cupos se registran en el sistema de pruebas.
        </p>
      ) : null}
      <h1 className="sr-only">Pago de tu reserva</h1>

      <div className="grid gap-10 lg:grid-cols-[minmax(0,640px)_380px] lg:justify-between xl:grid-cols-[minmax(0,640px)_400px]">
        <div className="min-w-0">
          <StepIndicator step={step} maxReached={maxReached} onGo={go} />

          {/* Resumen plegable en móvil/tablet */}
          <details className="mb-8 rounded-lg border border-border bg-surface lg:hidden">
            <summary className="flex min-h-12 cursor-pointer items-center justify-between gap-3 px-4 font-medium">
              <span>Ver resumen · {formatTotals(plan.totals, "totalCents")}</span>
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
                  const next = { ...draft, contact: values };
                  setDraft(next);
                  saveDraft(next);
                  go(2);
                }}
              />
            ) : step === 2 ? (
              <TravelersStep
                headingRef={headingRef}
                lines={lines}
                contact={contact}
                defaultValues={buildTravelerDefaults(lines, contact, draft.travelers)}
                onBack={() => go(1)}
                onSubmit={(values) => {
                  const next = { ...draft, travelers: values };
                  setDraft(next);
                  saveDraft(next);
                  go(3);
                }}
              />
            ) : (
              <PaymentStep
                headingRef={headingRef}
                lines={lines}
                contact={contact}
                travelers={draft.travelers}
                option={option}
                onOptionChange={setOption}
                onQuote={setQuote}
                cardFeePercent={cardFeePercent}
                onBackToContact={() => go(1)}
                onBackToTravelers={() => go(2)}
                onPaid={onPaid}
              />
            )}
          </div>
        </div>

        <aside className="hidden lg:block" aria-label="Resumen del pedido">
          <div className="sticky top-24">
            {step === 3 && quote ? (
              <QuoteSummary quote={quote} option={option}>
                <Link href="/es/carrito" className="pwt-link mt-4 inline-flex min-h-11 items-center text-sm">
                  Editar carrito
                </Link>
              </QuoteSummary>
            ) : (
              <OrderSummary lines={lines} plan={plan} title="Tu pedido" showThumbnails>
                <Link href="/es/carrito" className="pwt-link mt-4 inline-flex min-h-11 items-center text-sm">
                  Editar carrito
                </Link>
              </OrderSummary>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}
