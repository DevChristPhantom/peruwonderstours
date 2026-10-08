"use client";

import { Check, MessageCircle, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";

import { cartLineId, describeTravelers, travelerCount, type Travelers } from "@/lib/cart/types";
import type { CatalogImage, PaymentPolicy, TourPricing } from "@/lib/catalog/types";
import { lineTotalCents, percentOfCentsCeil } from "@/lib/checkout/payment-plan";
import { addDays, daysBetween, formatDate, formatMoney } from "@/lib/format";
import { useLimaToday } from "@/hooks/useClientOnly";
import { tourHelpMessage, whatsappHref } from "@/lib/whatsapp/messages";
import { useCartStore } from "@/stores/cart-store";
import { useUiStore } from "@/stores/ui-store";
import { buttonClass } from "@/components/ui/button-styles";
import { Counter } from "@/components/ui/Counter";

export interface BookableTour {
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
 * Módulo de reserva (tour-detalle.md): fecha, viajeros, desglose, adelanto 50 % y CTA.
 * Sin precio publicado: "Precio a consultar" y se agrega con precio null ("por cotizar").
 * TODO(E7): calendario con disponibilidad/cupos reales (hoy: selector de fecha nativo, sin cupos).
 */
export function BookingPanel({ tour, anchorId = "reservar" }: { tour: BookableTour; anchorId?: string }) {
  const id = useId();
  const router = useRouter();
  const addLine = useCartStore((s) => s.addLine);
  const lines = useCartStore((s) => s.lines);
  const showToast = useUiStore((s) => s.showToast);
  const announce = useUiStore((s) => s.announce);
  const pulseCart = useUiStore((s) => s.pulseCart);
  const dateRef = useRef<HTMLInputElement>(null);

  const [date, setDate] = useState("");
  const [dateError, setDateError] = useState<string | null>(null);
  const [travelers, setTravelers] = useState<Travelers>({ adults: Math.max(tour.minPax, 1), children: 0, infants: 0 });
  const [added, setAdded] = useState(false);
  // Fecha de Lima del visitante (no la del build) para el mínimo del selector.
  const today = useLimaToday();

  useEffect(() => {
    if (!added) return;
    const t = setTimeout(() => setAdded(false), 1500);
    return () => clearTimeout(t);
  }, [added]);

  const minDate = today ? addDays(today, 1) : undefined;
  const total = lineTotalCents(tour.pricing, travelers);
  const fullByPolicy = tour.paymentPolicy.depositPercent >= 100;
  const closeDeparture = !!(date && today && daysBetween(today, date) <= BALANCE_DAYS);
  const percentNow = fullByPolicy || closeDeparture ? 100 : tour.paymentPolicy.depositPercent;
  const deposit = total !== null ? percentOfCentsCeil(total, percentNow) : null;
  const inCart = date ? lines.some((l) => l.id === cartLineId(tour.slug, date)) : false;
  const set = (k: keyof Travelers) => (v: number) => setTravelers((t) => ({ ...t, [k]: v }));
  const count = travelerCount(travelers);

  const validate = (): boolean => {
    if (!date) {
      setDateError("Elige una fecha para continuar.");
      dateRef.current?.focus();
      return false;
    }
    if (minDate && date < minDate) {
      setDateError(`Elige una fecha a partir del ${formatDate(minDate)}.`);
      dateRef.current?.focus();
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
      unitPricing: tour.pricing,
      paymentPolicy: tour.paymentPolicy,
      durationDays: tour.durationDays,
      destinationSlugs: tour.destinationSlugs,
      difficulty: tour.difficulty,
    });
    const n = useCartStore.getState().lines.length;
    pulseCart();
    announce(
      `${replaced ? "Actualizamos" : "Se agregó"} ${tour.title}. Tu carrito tiene ${n} ${n === 1 ? "tour" : "tours"}.`,
    );
    return replaced;
  };

  const onAddToCart = () => {
    if (!validate()) return;
    const replaced = add();
    setAdded(true);
    showToast({
      message: replaced ? "Actualizamos los viajeros de este tour en tu carrito" : "Agregado a tu carrito",
      action: { label: "Ver carrito", href: "/es/carrito" },
    });
  };

  const onBookNow = () => {
    if (!validate()) return;
    add();
    router.push("/es/checkout");
  };

  return (
    <section
      id={anchorId}
      aria-labelledby={`${id}-title`}
      className="scroll-mt-24 rounded-lg border border-border bg-surface p-6 shadow-md"
    >
      <h2 id={`${id}-title`} className="sr-only">
        Reservar este tour
      </h2>

      <div>
        {tour.pricing ? (
          <p className="text-sm text-foreground-muted">
            Desde{" "}
            <span className="tabular block text-price-lg font-semibold text-foreground">
              {formatMoney(tour.pricing.adultCents, tour.pricing.currency)}
            </span>
            por persona
          </p>
        ) : (
          <>
            <p className="text-h3 font-semibold">Precio a consultar</p>
            <p className="mt-1 text-sm text-foreground-muted">
              Agrégalo a tu carrito y te enviaremos el precio exacto antes de cobrar.
            </p>
          </>
        )}
      </div>

      <div className="mt-6">
        <label htmlFor={`${id}-date`} className="block font-medium">
          Elige una fecha
        </label>
        <input
          ref={dateRef}
          id={`${id}-date`}
          type="date"
          min={minDate}
          value={date}
          onChange={(e) => {
            setDate(e.target.value);
            if (dateError) setDateError(null);
          }}
          aria-invalid={!!dateError}
          aria-describedby={dateError ? `${id}-date-error` : `${id}-date-help`}
          className="mt-2 block min-h-12 w-full rounded-md border border-border-strong bg-surface px-3 text-body aria-invalid:border-danger"
        />
        {dateError ? (
          <p id={`${id}-date-error`} className="mt-2 text-sm text-danger" role="alert">
            {dateError}
          </p>
        ) : (
          <p id={`${id}-date-help`} className="mt-2 text-sm text-foreground-muted">
            Confirmaremos la disponibilidad de cupos para tu fecha.
          </p>
        )}
      </div>

      <fieldset className="mt-6">
        <legend className="font-medium">¿Cuántos viajan?</legend>
        <Counter
          label="Adultos"
          hint={tour.pricing ? formatMoney(tour.pricing.adultCents, tour.pricing.currency) : "12 años o más"}
          unitName="un adulto"
          value={travelers.adults}
          min={1}
          max={MAX_TRAVELERS}
          onChange={set("adults")}
        />
        <Counter
          label="Niños"
          hint={
            tour.pricing?.childCents != null
              ? `3 a 11 años · ${formatMoney(tour.pricing.childCents, tour.pricing.currency)}`
              : "3 a 11 años"
          }
          unitName="un niño"
          value={travelers.children}
          max={MAX_TRAVELERS}
          onChange={set("children")}
        />
        <Counter label="Bebés" hint="0 a 2 años · gratis" unitName="un bebé" value={travelers.infants} max={6} onChange={set("infants")} />
        {count < tour.minPax ? (
          <p className="mt-2 text-sm text-foreground-muted">
            Este tour sale con mínimo {tour.minPax} viajeros. Para menos personas confirmaremos el suplemento.
          </p>
        ) : null}
      </fieldset>

      <div className="mt-6 space-y-3 border-t border-border pt-4" aria-live="polite">
        <div className="flex items-baseline justify-between gap-4">
          <span className="text-foreground-muted">Total para {describeTravelers(travelers)}</span>
          <span className="tabular font-semibold">
            {total !== null && tour.pricing ? formatMoney(total, tour.pricing.currency) : "Por cotizar"}
          </span>
        </div>
        <div className="rounded-md bg-success-soft px-4 py-3 text-sm text-success">
          {fullByPolicy ? (
            <p>Este tour requiere el pago completo al reservar porque incluye boletos de terceros.</p>
          ) : closeDeparture ? (
            <p>Sale en menos de {BALANCE_DAYS} días: se paga completo al reservar.</p>
          ) : (
            <p>
              Reserva hoy con el {percentNow} %
              {deposit !== null && tour.pricing ? (
                <>
                  : <strong className="tabular">{formatMoney(deposit, tour.pricing.currency)}</strong>
                </>
              ) : null}
              .{" "}
              {date
                ? `El saldo se paga hasta el ${formatDate(addDays(date, -BALANCE_DAYS))}.`
                : `El saldo se paga hasta ${BALANCE_DAYS} días antes de la salida.`}
            </p>
          )}
        </div>
      </div>

      {inCart ? (
        <p className="mt-4 text-sm text-foreground-muted">
          Ya tienes este tour el {formatDate(date)} en tu carrito ·{" "}
          <Link href="/es/carrito" className="pwt-link">
            Ver carrito
          </Link>
        </p>
      ) : null}

      <div className="mt-5 grid gap-3">
        <button type="button" className={buttonClass("primary", "lg", "w-full")} onClick={onAddToCart}>
          {added ? (
            <>
              <Check aria-hidden size={20} strokeWidth={1.5} />
              Agregado
            </>
          ) : (
            "Agregar al carrito"
          )}
        </button>
        <button type="button" className={buttonClass("outline", "lg", "w-full")} onClick={onBookNow}>
          Reservar ahora
        </button>
      </div>

      <p className="mt-4 flex items-start gap-2 text-sm text-foreground-muted">
        <ShieldCheck aria-hidden size={18} strokeWidth={1.5} className="mt-0.5 shrink-0" />
        Sin cargos ocultos · Pago seguro · Confirmación por correo
      </p>
      <a
        href={whatsappHref(tourHelpMessage({ title: tour.title, date: date || null, travelers: date ? travelers : null }))}
        target="_blank"
        rel="noopener noreferrer"
        className="pwt-link mt-2 inline-flex min-h-11 items-center gap-2 text-sm"
      >
        <MessageCircle aria-hidden size={18} strokeWidth={1.5} />
        ¿Dudas? Escríbenos por WhatsApp
      </a>
    </section>
  );
}

/** Barra inferior sticky en móvil/tablet: lleva al módulo de reserva. */
export function MobileBookingBar({ pricing }: { pricing: TourPricing | null }) {
  return (
    <div
      className="fixed inset-x-0 bottom-0 z-10 border-t border-border bg-surface px-4 py-3 shadow-sticky lg:hidden"
      style={{ paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))" }}
    >
      <div className="flex items-center justify-between gap-4">
        <p className="text-sm">
          {pricing ? (
            <>
              Desde <strong className="tabular">{formatMoney(pricing.adultCents, pricing.currency)}</strong> / persona
            </>
          ) : (
            <strong>Precio a consultar</strong>
          )}
        </p>
        <a
          href="#reservar"
          className={buttonClass("primary", "lg")}
          onClick={() => {
            requestAnimationFrame(() => document.querySelector<HTMLInputElement>("#reservar input[type=date]")?.focus());
          }}
        >
          Ver fechas
        </a>
      </div>
    </div>
  );
}
