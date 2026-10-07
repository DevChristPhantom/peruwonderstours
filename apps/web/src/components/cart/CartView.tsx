"use client";

import { Pencil, Trash2 } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useId, useMemo, useRef, useState } from "react";

import { describeTravelers, travelerCount, type CartLine, type Travelers } from "@/lib/cart/types";
import { computePaymentPlan } from "@/lib/checkout/payment-plan";
import { addDays, formatDate, formatMoney, todayInLima } from "@/lib/format";
import { useCartHydrated, useCartStore } from "@/stores/cart-store";
import { useUiStore } from "@/stores/ui-store";
import { buttonClass } from "@/components/ui/button-styles";
import { Counter } from "@/components/ui/Counter";
import { formatTotals, lineTotalLabel } from "./cart-helpers";
import { OrderSummary } from "./OrderSummary";

function LineEditor({ line, onDone }: { line: CartLine; onDone: (newId: string | null) => void }) {
  const id = useId();
  const editLine = useCartStore((s) => s.editLine);
  const [date, setDate] = useState(line.date);
  const [travelers, setTravelers] = useState<Travelers>(line.travelers);
  const [minDate] = useState(() => addDays(todayInLima(), 1));
  const set = (k: keyof Travelers) => (v: number) => setTravelers((t) => ({ ...t, [k]: v }));

  return (
    <div className="mt-4 rounded-md border border-border bg-surface-muted p-4">
      <label htmlFor={`${id}-date`} className="block text-sm font-medium">
        Fecha
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
        <Counter label="Adultos" unitName="un adulto" value={travelers.adults} min={1} onChange={set("adults")} />
        <Counter label="Niños" hint="3 a 11 años" unitName="un niño" value={travelers.children} onChange={set("children")} />
        <Counter label="Bebés" hint="0 a 2 años" unitName="un bebé" value={travelers.infants} onChange={set("infants")} />
      </div>
      <div className="mt-3 flex gap-2">
        <button
          type="button"
          className={buttonClass("secondary", "md")}
          disabled={!date || date < minDate}
          onClick={() => onDone(editLine(line.id, { date, travelers }))}
        >
          Guardar cambios
        </button>
        <button type="button" className={buttonClass("ghost", "md")} onClick={() => onDone(null)}>
          Cancelar
        </button>
      </div>
    </div>
  );
}

function CartItem({ line, onRemove }: { line: CartLine; onRemove: (line: CartLine) => void }) {
  const [editing, setEditing] = useState(false);
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
                <Link href={line.path} className="hover:underline">
                  {line.title}
                </Link>
              </h3>
              <p className="mt-1 text-sm text-foreground-muted">
                {formatDate(line.date)} · {describeTravelers(line.travelers)}
              </p>
              {line.destinationLabel ? <p className="text-sm text-foreground-muted">{line.destinationLabel}</p> : null}
            </div>
            <div className="shrink-0 md:text-right">
              <p className="tabular text-h4 font-semibold">{lineTotalLabel(line)}</p>
              {pricing ? (
                <p className="tabular text-sm text-foreground-muted">
                  {line.travelers.adults} × {formatMoney(pricing.adultCents, pricing.currency)}
                  {line.travelers.children
                    ? ` · ${line.travelers.children} × ${formatMoney(pricing.childCents ?? pricing.adultCents, pricing.currency)}`
                    : ""}
                </p>
              ) : (
                <p className="text-sm text-foreground-muted">Te enviaremos el precio</p>
              )}
            </div>
          </div>
          {fullPayment ? (
            <p className="mt-2 inline-block rounded-pill bg-warning-soft px-3 py-1 text-sm text-warning">
              Pago completo requerido: {line.paymentPolicy.fullPaymentReason?.toLowerCase() ?? "incluye boletos de terceros"}
            </p>
          ) : null}
          {travelerCount(line.travelers) < 2 ? (
            <p className="mt-2 text-sm text-foreground-muted">Este tour sale con mínimo 2 viajeros; para 1 viajero confirmaremos el suplemento.</p>
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
              Editar
            </button>
            <button
              type="button"
              className={buttonClass("ghost", "md")}
              aria-label={`Quitar ${line.title} del carrito`}
              onClick={() => onRemove(line)}
            >
              <Trash2 aria-hidden size={16} strokeWidth={1.5} />
              Quitar
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
    announce(`Quitaste ${line.title}. Total actualizado: ${formatTotals(total.totals, "totalCents")}.`);
    showToast({
      message: `Quitaste ${line.title}`,
      duration: 8000,
      action: { label: "Deshacer", onAction: () => restoreLine(removed.line, removed.index) },
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
        <span className="sr-only">Cargando tu carrito…</span>
      </div>
    );
  }

  if (lines.length === 0) {
    return (
      <div className="pwt-container flex flex-col items-center py-20 text-center">
        <h1 ref={headingRef} tabIndex={-1} className="font-display text-h1 font-medium focus:outline-none">
          Tu carrito
        </h1>
        <svg viewBox="0 0 120 60" className="mt-10 h-16 w-32" aria-hidden="true">
          <path d="M4 52 L38 14 L58 36 L78 8 L116 52" fill="none" stroke="var(--pwt-border-strong)" strokeWidth="2" strokeLinejoin="round" />
        </svg>
        <h2 className="mt-6 text-h3 font-medium">Tu carrito está vacío</h2>
        <p className="mt-2 text-foreground-muted">Explora tours en Puno, Cusco y Arequipa.</p>
        <Link href="/es/tours" className={buttonClass("secondary", "lg", "mt-6")}>
          Ver tours
        </Link>
        <ul className="mt-6 flex flex-wrap justify-center gap-4 text-sm">
          <li>
            <Link className="pwt-link" href="/es/destinos/tours-en-puno">
              Puno
            </Link>
          </li>
          <li>
            <Link className="pwt-link" href="/es/destinos/cuzco">
              Cusco
            </Link>
          </li>
          <li>
            <Link className="pwt-link" href="/es/destinos/tours-en-arequipa">
              Arequipa
            </Link>
          </li>
        </ul>
      </div>
    );
  }

  const payToday = plan.totals.length ? formatTotals(plan.totals, "payNowCents") : null;

  return (
    <div className="pwt-container pt-10 pb-32 lg:pb-16">
      <div className="flex items-baseline gap-3">
        <h1 ref={headingRef} tabIndex={-1} className="font-display text-h1 font-medium focus:outline-none">
          Tu carrito
        </h1>
        <p className="text-foreground-muted">
          {lines.length} {lines.length === 1 ? "tour" : "tours"}
        </p>
      </div>

      <div className="mt-8 grid gap-10 lg:grid-cols-[1fr_380px] xl:grid-cols-[1fr_400px]">
        <div>
          <ul ref={listRef} className="divide-y divide-border border-y border-border" aria-label="Tours en tu carrito">
            {lines.map((line) => (
              <CartItem key={line.id} line={line} onRemove={onRemove} />
            ))}
          </ul>
          <Link href="/es/tours" className="pwt-link mt-6 inline-flex min-h-11 items-center">
            Seguir explorando
          </Link>
        </div>

        <div className="lg:sticky lg:top-24 lg:self-start">
          <OrderSummary lines={lines} plan={plan}>
            <Link href="/es/checkout" className={buttonClass("primary", "lg", "mt-5 w-full")}>
              Continuar con la reserva
            </Link>
            <p className="mt-3 text-sm text-foreground-muted">Puedes pagar el 50 % o el total en el siguiente paso.</p>
            <p className="mt-2 text-sm text-foreground-muted">Pago seguro · Comprobante electrónico SUNAT · Libro de Reclamaciones</p>
          </OrderSummary>
        </div>
      </div>

      {/* Barra inferior móvil con total y CTA. */}
      <div className="fixed inset-x-0 bottom-0 z-10 border-t border-border bg-surface px-4 py-3 shadow-sticky lg:hidden" style={{ paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))" }}>
        <div className="flex items-center justify-between gap-4">
          <div className="text-sm">
            <p className="text-foreground-muted">{payToday ? "Hoy pagas desde" : "Total"}</p>
            <p className="tabular font-semibold">{payToday ?? formatTotals(plan.totals, "totalCents")}</p>
          </div>
          <Link href="/es/checkout" className={buttonClass("primary", "lg")} aria-label="Continuar con la reserva">
            Continuar
          </Link>
        </div>
      </div>
    </div>
  );
}
