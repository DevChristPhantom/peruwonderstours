"use client";

import { Check, MessageCircle, ShieldCheck } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useId, useRef, useState } from "react";

import { useFormat } from "@/hooks/useFormat";
import { useLimaToday } from "@/hooks/useClientOnly";
import { useWhatsappTools } from "@/hooks/useWhatsappTools";
import { Link, useRouter } from "@/i18n/navigation";
import { localePath } from "@/i18n/paths";
import { cartLineId, travelerCount, type Travelers } from "@/lib/cart/types";
import type { CatalogImage, PaymentPolicy, TourPricing } from "@/lib/catalog/types";
import { lineTotalCents, percentOfCentsCeil } from "@/lib/checkout/payment-plan";
import { addDays, daysBetween } from "@/lib/format";
import { describeTravelers } from "@/lib/i18n/units";
import { tourHelpMessage, whatsappHref } from "@/lib/whatsapp/messages";
import { useCartStore } from "@/stores/cart-store";
import { useUiStore } from "@/stores/ui-store";
import { buttonClass } from "@/components/ui/button-styles";
import { Counter } from "@/components/ui/Counter";

import { DepartureCalendar, type CalendarDeparture } from "./DepartureCalendar";

export interface BookableTour {
  /** Clave estable (slug en español): carrito, API y calendario. */
  slug: string;
  title: string;
  path: string;
  image: CatalogImage | null;
  destinationLabel: string;
  durationLabel: string;
  minPax: number;
  pricing: TourPricing | null;
  paymentPolicy: PaymentPolicy;
  durationDays: number | null;
  destinationSlugs: string[];
  difficulty: string | null;
}

const BALANCE_DAYS = 7;
const MAX_TRAVELERS = 20;

/**
 * Módulo de reserva (tour-detalle.md): calendario de salidas reales con cupos y precio por fecha
 * (W6/F9), viajeros, desglose, adelanto 50 % y CTA. Sin calendario en línea, se muestra el selector de
 * fecha simple y se confirma la disponibilidad. Sin precio publicado: "Precio a consultar".
 */
export function BookingPanel({ tour, anchorId = "reservar" }: { tour: BookableTour; anchorId?: string }) {
  const id = useId();
  const t = useTranslations("booking");
  const tp = useTranslations("price");
  const tt = useTranslations("travelersPicker");
  const tu = useTranslations("units");
  const tc = useTranslations("calendar");
  const locale = useLocale();
  const f = useFormat();
  const wa = useWhatsappTools();
  const router = useRouter();
  const addLine = useCartStore((s) => s.addLine);
  const lines = useCartStore((s) => s.lines);
  const showToast = useUiStore((s) => s.showToast);
  const announce = useUiStore((s) => s.announce);
  const pulseCart = useUiStore((s) => s.pulseCart);
  const dateRef = useRef<HTMLInputElement>(null);
  const calendarWrapRef = useRef<HTMLDivElement>(null);

  const [date, setDate] = useState("");
  const [departure, setDeparture] = useState<CalendarDeparture | null>(null);
  const [dateError, setDateError] = useState<string | null>(null);
  const [travelers, setTravelers] = useState<Travelers>({ adults: Math.max(tour.minPax, 1), children: 0, infants: 0 });
  const [added, setAdded] = useState(false);
  // Fecha de Lima del visitante (no la del build) para el mínimo del selector.
  const today = useLimaToday();

  useEffect(() => {
    if (!added) return;
    const timer = setTimeout(() => setAdded(false), 1500);
    return () => clearTimeout(timer);
  }, [added]);

  const minDate = today ? addDays(today, 1) : undefined;
  // Precio por fecha del calendario cuando existe (misma moneda); si no, el "desde" del catálogo.
  const pricing: TourPricing | null =
    departure?.priceFrom && tour.pricing && departure.priceFrom.currency === tour.pricing.currency
      ? { ...tour.pricing, adultCents: departure.priceFrom.amount }
      : tour.pricing;
  const total = lineTotalCents(pricing, travelers);
  const fullByPolicy = tour.paymentPolicy.depositPercent >= 100;
  const closeDeparture = !!(date && today && daysBetween(today, date) <= BALANCE_DAYS);
  const percentNow = fullByPolicy || closeDeparture ? 100 : tour.paymentPolicy.depositPercent;
  const deposit = total !== null ? percentOfCentsCeil(total, percentNow) : null;
  const inCart = date ? lines.some((l) => l.id === cartLineId(tour.slug, date)) : false;
  const set = (k: keyof Travelers) => (v: number) => setTravelers((cur) => ({ ...cur, [k]: v }));
  const count = travelerCount(travelers);
  const seatsNeeded = travelers.adults + travelers.children;
  const notEnoughSeats = !!(departure && departure.available !== null && departure.available < seatsNeeded);

  const focusDate = () => {
    if (dateRef.current) dateRef.current.focus();
    else calendarWrapRef.current?.querySelector<HTMLButtonElement>('[role="grid"] button[tabindex="0"]')?.focus();
  };

  const validate = (): boolean => {
    if (!date) {
      setDateError(t("chooseDateError"));
      focusDate();
      return false;
    }
    if (minDate && date < minDate) {
      setDateError(t("minDateError", { date: f.date(minDate) }));
      focusDate();
      return false;
    }
    if (notEnoughSeats) {
      setDateError(t("notEnoughSeats", { count: departure!.available ?? 0 }));
      focusDate();
      return false;
    }
    setDateError(null);
    return true;
  };

  const add = () => {
    const { replaced } = addLine({
      tourSlug: tour.slug,
      title: tour.title,
      path: tour.path,
      image: tour.image,
      destinationLabel: tour.destinationLabel,
      durationLabel: tour.durationLabel,
      date,
      travelers,
      unitPricing: pricing,
      paymentPolicy: tour.paymentPolicy,
      durationDays: tour.durationDays,
      destinationSlugs: tour.destinationSlugs,
      difficulty: tour.difficulty,
    });
    const n = useCartStore.getState().lines.length;
    pulseCart();
    announce(t(replaced ? "announceUpdated" : "announceAdded", { title: tour.title, count: n }));
    return replaced;
  };

  const onAddToCart = () => {
    if (!validate()) return;
    const replaced = add();
    setAdded(true);
    showToast({
      message: replaced ? t("toastUpdated") : t("toastAdded"),
      action: { label: t("viewCart"), href: localePath(locale, "/carrito") },
    });
  };

  const onBookNow = () => {
    if (!validate()) return;
    add();
    router.push("/checkout");
  };

  const dateField = (reason: "no-calendar" | "error") => (
    <>
      <input
        ref={dateRef}
        id={`${id}-date`}
        type="date"
        min={minDate}
        value={date}
        onChange={(e) => {
          setDate(e.target.value);
          setDeparture(null);
          if (dateError) setDateError(null);
        }}
        aria-invalid={!!dateError}
        aria-describedby={dateError ? `${id}-date-error` : `${id}-date-help`}
        className="mt-2 block min-h-12 w-full rounded-md border border-border-strong bg-surface px-3 text-body aria-invalid:border-danger"
      />
      <p className="mt-2 text-sm text-foreground-muted">{reason === "error" ? tc("fallbackError") : tc("fallbackNoCalendar")}</p>
    </>
  );

  return (
    <section id={anchorId} aria-labelledby={`${id}-title`} className="scroll-mt-24 rounded-lg border border-border bg-surface p-6 shadow-md">
      <h2 id={`${id}-title`} className="sr-only">
        {t("title")}
      </h2>

      <div>
        {pricing ? (
          <p className="text-sm text-foreground-muted">
            {t.rich("fromBlock", {
              amount: () => <span className="tabular block text-price-lg font-semibold text-foreground">{f.money(pricing.adultCents, pricing.currency)}</span>,
            })}
          </p>
        ) : (
          <>
            <p className="text-h3 font-semibold">{tp("onRequest")}</p>
            <p className="mt-1 text-sm text-foreground-muted">{t("onRequestHelp")}</p>
          </>
        )}
      </div>

      <div className="mt-6" ref={calendarWrapRef}>
        <p id={`${id}-date-label`} className="block font-medium">
          <label htmlFor={`${id}-date`}>{t("chooseDate")}</label>
        </p>
        {minDate ? (
          <DepartureCalendar
            tourKey={tour.slug}
            minDate={minDate}
            value={date}
            seatsNeeded={seatsNeeded}
            invalid={!!dateError}
            describedBy={dateError ? `${id}-date-error` : `${id}-date-help`}
            onChange={(d, dep) => {
              setDate(d);
              setDeparture(dep);
              if (dateError) setDateError(null);
              announce(tc("chosen", { date: f.date(d) }));
            }}
            renderFallback={dateField}
          />
        ) : (
          <div className="mt-2 h-72 animate-pulse rounded-md bg-surface-muted motion-reduce:animate-none" aria-hidden="true" />
        )}
        {dateError ? (
          <p id={`${id}-date-error`} className="mt-2 text-sm text-danger" role="alert">
            {dateError}
          </p>
        ) : (
          <p id={`${id}-date-help`} className="mt-2 text-sm text-foreground-muted" aria-live="polite">
            {date ? (
              <>
                {tc("chosen", { date: f.date(date) })}
                {departure?.available != null ? ` · ${tc("chosenSeats", { count: departure.available })}` : ""}
                {departure?.startTime ? ` · ${tc("startTime", { time: departure.startTime })}` : ""}
              </>
            ) : (
              t("dateHelp")
            )}
          </p>
        )}
      </div>

      <fieldset className="mt-6">
        <legend className="font-medium">{tt("legend")}</legend>
        <Counter
          label={tt("adults")}
          hint={pricing ? f.money(pricing.adultCents, pricing.currency) : tt("adultsHint")}
          unitName={tt("adultUnit")}
          value={travelers.adults}
          min={1}
          max={MAX_TRAVELERS}
          onChange={set("adults")}
        />
        <Counter
          label={tt("children")}
          hint={pricing?.childCents != null ? `${tt("childrenHint")} · ${f.money(pricing.childCents, pricing.currency)}` : tt("childrenHint")}
          unitName={tt("childUnit")}
          value={travelers.children}
          max={MAX_TRAVELERS}
          onChange={set("children")}
        />
        <Counter label={tt("infants")} hint={tt("infantsFreeHint")} unitName={tt("infantUnit")} value={travelers.infants} max={6} onChange={set("infants")} />
        {count < tour.minPax ? <p className="mt-2 text-sm text-foreground-muted">{t("minPax", { count: tour.minPax })}</p> : null}
      </fieldset>

      <div className="mt-6 space-y-3 border-t border-border pt-4" aria-live="polite">
        <div className="flex items-baseline justify-between gap-4">
          <span className="text-foreground-muted">{t("totalFor", { travelers: describeTravelers(tu, travelers) })}</span>
          <span className="tabular font-semibold">{total !== null && pricing ? f.money(total, pricing.currency) : tp("toQuote")}</span>
        </div>
        <div className="rounded-md bg-success-soft px-4 py-3 text-sm text-success">
          {fullByPolicy ? (
            <p>{t("fullPolicy")}</p>
          ) : closeDeparture ? (
            <p>{t("closeDeparture", { days: BALANCE_DAYS })}</p>
          ) : (
            <p>
              {deposit !== null && pricing
                ? t.rich("depositToday", {
                    percent: percentNow,
                    amount: () => <strong className="tabular">{f.money(deposit, pricing.currency)}</strong>,
                  })
                : t("depositTodayNoAmount", { percent: percentNow })}{" "}
              {date ? t("balanceUntil", { date: f.date(addDays(date, -BALANCE_DAYS)) }) : t("balanceBefore", { days: BALANCE_DAYS })}
            </p>
          )}
        </div>
      </div>

      {inCart ? (
        <p className="mt-4 text-sm text-foreground-muted">
          {t("inCart", { date: f.date(date) })} ·{" "}
          <Link href="/carrito" className="pwt-link">
            {t("viewCart")}
          </Link>
        </p>
      ) : null}

      <div className="mt-5 grid gap-3">
        <button type="button" className={buttonClass("primary", "lg", "w-full")} onClick={onAddToCart}>
          {added ? (
            <>
              <Check aria-hidden size={20} strokeWidth={1.5} />
              {t("added")}
            </>
          ) : (
            t("addToCart")
          )}
        </button>
        <button type="button" className={buttonClass("outline", "lg", "w-full")} onClick={onBookNow}>
          {t("bookNow")}
        </button>
      </div>

      <p className="mt-4 flex items-start gap-2 text-sm text-foreground-muted">
        <ShieldCheck aria-hidden size={18} strokeWidth={1.5} className="mt-0.5 shrink-0" />
        {t("trust")}
      </p>
      <a
        href={whatsappHref(tourHelpMessage(wa, { title: tour.title, date: date || null, travelers: date ? travelers : null }))}
        target="_blank"
        rel="noopener noreferrer"
        className="pwt-link mt-2 inline-flex min-h-11 items-center gap-2 text-sm"
      >
        <MessageCircle aria-hidden size={18} strokeWidth={1.5} />
        {t("questions")}
      </a>
    </section>
  );
}

/** Barra inferior sticky en móvil/tablet: lleva al módulo de reserva. */
export function MobileBookingBar({ pricing }: { pricing: TourPricing | null }) {
  const t = useTranslations("booking");
  const tp = useTranslations("price");
  const f = useFormat();
  return (
    <div className="fixed inset-x-0 bottom-0 z-10 border-t border-border bg-surface px-4 py-3 shadow-sticky lg:hidden" style={{ paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))" }}>
      <div className="flex items-center justify-between gap-4">
        <p className="text-sm">
          {pricing ? (
            tp.rich("fromShort", { amount: () => <strong className="tabular">{f.money(pricing.adultCents, pricing.currency)}</strong> })
          ) : (
            <strong>{tp("onRequest")}</strong>
          )}
        </p>
        <a
          href="#reservar"
          className={buttonClass("primary", "lg")}
          onClick={() => {
            requestAnimationFrame(() =>
              document.querySelector<HTMLElement>('#reservar [role="grid"] button[tabindex="0"], #reservar input[type=date]')?.focus(),
            );
          }}
        >
          {t("seeDates")}
        </a>
      </div>
    </div>
  );
}
