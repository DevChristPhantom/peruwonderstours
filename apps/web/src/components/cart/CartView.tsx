"use client";

import { CalendarRange, MessageCircle, Pencil, Trash2 } from "lucide-react";
import Image from "next/image";
import NextLink from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { useId, useMemo, useRef, useState } from "react";

import { useFormat } from "@/hooks/useFormat";
import { useTravelersText } from "@/hooks/useTravelersText";
import { Link } from "@/i18n/navigation";
import { useWhatsappTools } from "@/hooks/useWhatsappTools";
import { travelerCount, type CartLine, type Travelers } from "@/lib/cart/types";
import { computePaymentPlan } from "@/lib/checkout/payment-plan";
import { addDays, todayInLima } from "@/lib/format";
import { cartHelpMessage, whatsappHref } from "@/lib/whatsapp/messages";
import { useCartHydrated, useCartStore } from "@/stores/cart-store";
import { useTripGate } from "@/stores/trip-store";
import { useUiStore } from "@/stores/ui-store";
import { TripConflictAlert } from "@/components/trip/TripConflictAlert";
import { buttonClass } from "@/components/ui/button-styles";
import { Counter } from "@/components/ui/Counter";
import { useCartMoney } from "./cart-helpers";
import { OrderSummary } from "./OrderSummary";

/** Slug de cada destino por idioma (data/seed/en/_slug-map.json), sin el salto 308 entre idiomas. */
const EMPTY_DESTINATIONS = [
  { label: "Puno", slug: { es: "tours-en-puno", en: "puno" } },
  { label: "Cusco", slug: { es: "cuzco", en: "cusco" } },
  { label: "Arequipa", slug: { es: "tours-en-arequipa", en: "arequipa" } },
] as const;

function LineEditor({ line, onDone }: { line: CartLine; onDone: (newId: string | null) => void }) {
  const id = useId();
  const t = useTranslations("cart");
  const tt = useTranslations("travelersPicker");
  const editLine = useCartStore((s) => s.editLine);
  const [date, setDate] = useState(line.date);
  const [travelers, setTravelers] = useState<Travelers>(line.travelers);
  const [minDate] = useState(() => addDays(todayInLima(), 1));
  const set = (k: keyof Travelers) => (v: number) => setTravelers((t) => ({ ...t, [k]: v }));

  return (
    <div className="mt-4 rounded-md border border-border bg-surface-muted p-4">
      <label htmlFor={`${id}-date`} className="block text-sm font-medium">
        {t("date")}
      </label>
      <input
        id={`${id}-date`}
        type="date"
        min={minDate}
        value={date}
        onChange={(e) => setDate(e.target.value)}
        className="mt-1 block min-h-12 w-full rounded-md border border-border-strong bg-surface px-3 text-body sm:max-w-xs"
      />
      <div className="mt-3">
        <Counter label={tt("adults")} hint={tt("adultsHint")} unitName={tt("adultUnit")} value={travelers.adults} min={1} onChange={set("adults")} />
        <Counter label={tt("children")} hint={tt("childrenHint")} unitName={tt("childUnit")} value={travelers.children} onChange={set("children")} />
        <Counter label={tt("infants")} hint={tt("infantsHint")} unitName={tt("infantUnit")} value={travelers.infants} onChange={set("infants")} />
      </div>
      <div className="mt-3 flex gap-2">
        <button
          type="button"
          className={buttonClass("secondary", "md")}
          disabled={!date || date < minDate}
          onClick={() => onDone(editLine(line.id, { date, travelers }))}
        >
          {t("saveChanges")}
        </button>
        <button type="button" className={buttonClass("ghost", "md")} onClick={() => onDone(null)}>
          {t("cancel")}
        </button>
      </div>
    </div>
  );
}

function CartItem({ line, onRemove }: { line: CartLine; onRemove: (line: CartLine) => void }) {
  const [editing, setEditing] = useState(false);
  const t = useTranslations("cart");
  const fmt = useFormat();
  const money = useCartMoney();
  const travelersText = useTravelersText();
  const editRef = useRef<HTMLButtonElement>(null);
  const pricing = line.unitPricing;
  const fullPayment = line.paymentPolicy.depositPercent >= 100;

  return (
    <li className="py-6" data-line-id={line.id}>
      <article className="flex gap-4">
        <div className="relative h-[66px] w-[88px] shrink-0 overflow-hidden rounded-md bg-surface-muted md:h-[90px] md:w-[120px]">
          {line.image ? <Image src={line.image.src} alt="" fill sizes="120px" className="object-cover" /> : null}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-col gap-1 md:flex-row md:items-start md:justify-between md:gap-6">
            <div className="min-w-0">
              <h3 className="text-h4 font-medium">
                <NextLink href={line.path} className="hover:underline">
                  {line.title}
                </NextLink>
              </h3>
              <p className="mt-1 text-sm text-foreground-muted">
                {fmt.date(line.date)} · {travelersText(line.travelers)}
              </p>
              {line.destinationLabel ? <p className="text-sm text-foreground-muted">{line.destinationLabel}</p> : null}
            </div>
            <div className="shrink-0 md:text-right">
              <p className="tabular text-h4 font-semibold">{money.lineTotal(line)}</p>
              {pricing ? (
                <p className="tabular text-sm text-foreground-muted">
                  {line.travelers.adults} × {fmt.money(pricing.adultCents, pricing.currency)}
                  {line.travelers.children
                    ? ` · ${line.travelers.children} × ${fmt.money(pricing.childCents ?? pricing.adultCents, pricing.currency)}`
                    : ""}
                </p>
              ) : (
                <p className="text-sm text-foreground-muted">{t("priceToFollow")}</p>
              )}
            </div>
          </div>
          {fullPayment ? (
            <p className="mt-2 inline-block rounded-pill bg-warning-soft px-3 py-1 text-sm text-warning">
              {t("fullPaymentRequired", { reason: line.paymentPolicy.fullPaymentReason?.toLowerCase() ?? t("thirdPartyTickets") })}
            </p>
          ) : null}
          {travelerCount(line.travelers) < 2 ? (
            <p className="mt-2 text-sm text-foreground-muted">{t("minTwoTravelers")}</p>
          ) : null}
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              ref={editRef}
              type="button"
              className={buttonClass("ghost", "md")}
              aria-expanded={editing}
              onClick={() => setEditing((v) => !v)}
            >
              <Pencil aria-hidden size={16} strokeWidth={1.5} />
              {t("edit")}
            </button>
            <button
              type="button"
              className={buttonClass("ghost", "md")}
              aria-label={t("removeLabel", { title: line.title })}
              onClick={() => onRemove(line)}
            >
              <Trash2 aria-hidden size={16} strokeWidth={1.5} />
              {t("remove")}
            </button>
          </div>
          {editing ? (
            <LineEditor
              line={line}
              onDone={() => {
                setEditing(false);
                editRef.current?.focus();
              }}
            />
          ) : null}
        </div>
      </article>
    </li>
  );
}

export function CartView() {
  const locale = useLocale();
  const t = useTranslations("cart");
  const money = useCartMoney();
  const wa = useWhatsappTools();
  const hydrated = useCartHydrated();
  const lines = useCartStore((s) => s.lines);
  const removeLine = useCartStore((s) => s.removeLine);
  const restoreLine = useCartStore((s) => s.restoreLine);
  const showToast = useUiStore((s) => s.showToast);
  const announce = useUiStore((s) => s.announce);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  // El carrito solo se pinta tras hidratar (cliente), así que la fecha de Lima es la del visitante.
  const plan = useMemo(() => computePaymentPlan(lines, "deposit", todayInLima()), [lines]);
  // HU-B.A5: con tours superpuestos no se continúa sin cambiar uno o confirmar.
  const { pending: pendingConflicts } = useTripGate(lines);
  const blocked = pendingConflicts.length > 0;

  const onRemove = (line: CartLine) => {
    const removed = removeLine(line.id);
    if (!removed) return;
    const remaining = useCartStore.getState().lines;
    const nextLine = remaining[removed.index] ?? remaining[removed.index - 1];
    requestAnimationFrame(() => {
      const target = nextLine
        ? listRef.current?.querySelector<HTMLElement>(`[data-line-id="${CSS.escape(nextLine.id)}"] a`)
        : headingRef.current;
      target?.focus();
    });
    const total = computePaymentPlan(remaining, "deposit", todayInLima());
    announce(t("removedAnnounce", { title: line.title, total: money.totals(total.totals, "totalCents") }));
    showToast({
      message: t("removedToast", { title: line.title }),
      duration: 8000,
      action: { label: t("undo"), onAction: () => restoreLine(removed.line, removed.index) },
    });
  };

  if (!hydrated) {
    return (
      <div className="pwt-container py-12" aria-busy="true">
        <div className="h-10 w-48 animate-pulse rounded-md bg-surface-muted motion-reduce:animate-none" />
        <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_380px]">
          <div className="space-y-4">
            <div className="h-28 animate-pulse rounded-lg bg-surface-muted motion-reduce:animate-none" />
            <div className="h-28 animate-pulse rounded-lg bg-surface-muted motion-reduce:animate-none" />
          </div>
          <div className="h-64 animate-pulse rounded-lg bg-surface-muted motion-reduce:animate-none" />
        </div>
        <span className="sr-only">{t("loading")}</span>
      </div>
    );
  }

  if (lines.length === 0) {
    return (
      <div className="pwt-container flex flex-col items-center py-20 text-center">
        <h1 ref={headingRef} tabIndex={-1} className="font-display text-h1 font-medium focus:outline-none">
          {t("title")}
        </h1>
        <svg viewBox="0 0 120 60" className="mt-10 h-16 w-32" aria-hidden="true">
          <path d="M4 52 L38 14 L58 36 L78 8 L116 52" fill="none" stroke="var(--pwt-border-strong)" strokeWidth="2" strokeLinejoin="round" />
        </svg>
        <h2 className="mt-6 text-h3 font-medium">{t("emptyTitle")}</h2>
        <p className="mt-2 text-foreground-muted">{t("emptyDrawerText")}</p>
        <Link href="/tours" className={buttonClass("secondary", "lg", "mt-6")}>
          {t("browseTours")}
        </Link>
        <ul className="mt-6 flex flex-wrap justify-center gap-4 text-sm">
          {EMPTY_DESTINATIONS.map((d) => (
            <li key={d.label}>
              <Link className="pwt-link" href={{ pathname: "/destinos/[slug]", params: { slug: d.slug[locale] } }}>
                {d.label}
              </Link>
            </li>
          ))}
        </ul>
      </div>
    );
  }

  const payToday = plan.totals.length ? money.totals(plan.totals, "payNowCents") : null;

  return (
    <div className="pwt-container pt-10 pb-32 lg:pb-16">
      <div className="flex items-baseline gap-3">
        <h1 ref={headingRef} tabIndex={-1} className="font-display text-h1 font-medium focus:outline-none">
          {t("title")}
        </h1>
        <p className="text-foreground-muted">{t("tourCount", { count: lines.length })}</p>
      </div>

      <div className="mt-8 grid gap-10 lg:grid-cols-[1fr_380px] xl:grid-cols-[1fr_400px]">
        <div>
          <TripConflictAlert lines={lines} editHref={null} className="mb-6" />
          <ul ref={listRef} className="divide-y divide-border border-y border-border" aria-label={t("listLabel")}>
            {lines.map((line) => (
              <CartItem key={line.id} line={line} onRemove={onRemove} />
            ))}
          </ul>
          <div className="mt-6 flex flex-wrap items-center gap-x-6 gap-y-2">
            <Link href="/mi-viaje" className={buttonClass("outline", "md")}>
              <CalendarRange aria-hidden size={18} strokeWidth={1.5} />
              {t("viewTrip")}
            </Link>
            <Link href="/tours" className="pwt-link inline-flex min-h-11 items-center">
              {t("keepExploring")}
            </Link>
            <a
              href={whatsappHref(cartHelpMessage(wa, lines.map((l) => ({ title: l.title, date: l.date, travelers: l.travelers })), { step: t("whatsappStep") }))}
              target="_blank"
              rel="noopener noreferrer"
              className="pwt-link inline-flex min-h-11 items-center gap-2"
            >
              <MessageCircle aria-hidden size={18} strokeWidth={1.5} />
              {t("whatsappHelp")}
            </a>
          </div>
        </div>

        <div className="lg:sticky lg:top-24 lg:self-start">
          <OrderSummary lines={lines} plan={plan}>
            {blocked ? (
              <>
                <button type="button" className={buttonClass("primary", "lg", "mt-5 w-full")} disabled aria-describedby="cart-blocked-help">
                  {t("continue")}
                </button>
                <p id="cart-blocked-help" className="mt-2 text-sm text-danger">
                  {t("blockedHelp")}
                </p>
              </>
            ) : (
              <Link href="/checkout" className={buttonClass("primary", "lg", "mt-5 w-full")}>
                {t("continue")}
              </Link>
            )}
            <p className="mt-3 text-sm text-foreground-muted">{t("payOptionsHint")}</p>
            <p className="mt-2 text-sm text-foreground-muted">{t("trustLine")}</p>
          </OrderSummary>
        </div>
      </div>

      {/* Barra inferior móvil con total y CTA. */}
      <div className="fixed inset-x-0 bottom-0 z-10 max-w-[100vw] border-t border-border bg-surface px-4 py-3 shadow-sticky lg:hidden" style={{ paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))" }}>
        <div className="flex items-center justify-between gap-4">
          <div className="text-sm">
            <p className="text-foreground-muted">{payToday ? t("payTodayFrom") : t("total")}</p>
            <p className="tabular font-semibold">{payToday ?? money.totals(plan.totals, "totalCents")}</p>
          </div>
          {blocked ? (
            <a href="#trip-conflict-title" className={buttonClass("outline", "lg")}>
              {t("reviewDates")}
            </a>
          ) : (
            <Link href="/checkout" className={buttonClass("primary", "lg")} aria-label={t("continue")}>
              {t("continueShort")}
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
