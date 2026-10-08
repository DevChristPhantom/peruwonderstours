"use client";

import { CalendarDays, CalendarPlus, Coffee, MapPin, MessageCircle, Mountain, Users } from "lucide-react";
import Link from "next/link";
import { useMemo } from "react";

import { describeTravelers } from "@/lib/cart/types";
import { addDays, daysBetween, formatDate } from "@/lib/format";
import { absoluteUrl } from "@/lib/site";
import { buildIcs, downloadIcs, PICKUP_PENDING } from "@/lib/trip/ics";
import { buildTripPlan, type AcclimatizationNote } from "@/lib/trip/itinerary";
import { cartHelpMessage, whatsappHref } from "@/lib/whatsapp/messages";
import { useCartHydrated, useCartStore } from "@/stores/cart-store";
import { useUiStore } from "@/stores/ui-store";
import { buttonClass } from "@/components/ui/button-styles";
import { TripConflictAlert } from "./TripConflictAlert";

/** "3 812" (espacio fino como separador de miles, como en el resto del sitio). */
const meters = (n: number) => new Intl.NumberFormat("es-PE").format(n).replace(/,/g, " ");

function acclimatizationText(note: AcclimatizationNote): string {
  const where = `${note.region.label} (${meters(note.region.altitude)} m s. n. m.)`;
  const from = note.arrivingFrom
    ? ` Vienes de ${note.arrivingFrom.label}, a ${meters(note.arrivingFrom.altitude)} m: el cambio de altura es grande.`
    : "";
  const effort = note.demanding
    ? " Es un tour exigente para la altura: te recomendamos llegar al menos un día antes y descansar."
    : " Si llegas ese mismo día, te recomendamos descansar unas horas y moverte con calma.";
  return `${formatDate(note.date)}: ${note.title} empieza en ${where}.${from}${effort}`;
}

/** "Mi viaje" (HU-B.A5): itinerario día a día del carrito con avisos y exportación .ics. */
export function TripPlanView() {
  const hydrated = useCartHydrated();
  const lines = useCartStore((s) => s.lines);
  const announce = useUiStore((s) => s.announce);
  const plan = useMemo(() => buildTripPlan(lines), [lines]);

  if (!hydrated) {
    return (
      <div className="pwt-container py-12" aria-busy="true">
        <div className="h-10 w-48 animate-pulse rounded-md bg-surface-muted motion-reduce:animate-none" />
        <div className="mt-8 space-y-4">
          <div className="h-24 animate-pulse rounded-lg bg-surface-muted motion-reduce:animate-none" />
          <div className="h-24 animate-pulse rounded-lg bg-surface-muted motion-reduce:animate-none" />
        </div>
        <span className="sr-only">Cargando tu viaje…</span>
      </div>
    );
  }

  if (!plan.items.length || !plan.start || !plan.end) {
    return (
      <div className="pwt-container flex flex-col items-center py-20 text-center">
        <h1 className="font-display text-h1 font-medium">Mi viaje</h1>
        <p className="mt-4 max-w-prose text-foreground-muted">
          Cuando agregues tours a tu carrito verás aquí tu plan día a día, con avisos de fechas que se cruzan y de
          aclimatación a la altura.
        </p>
        <Link href="/es/tours" className={buttonClass("secondary", "lg", "mt-6")}>
          Ver tours
        </Link>
      </div>
    );
  }

  const totalDays = daysBetween(plan.start, plan.end) + 1;
  const softOverlaps = plan.conflicts.filter((c) => !c.blocking);

  const onDownload = () => {
    const ics = buildIcs(
      plan.items.map((it) => ({
        uid: `${it.line.id}@peruwonderstours.com`,
        title: it.line.title,
        date: it.start,
        days: it.days,
        location: it.region?.label ?? it.line.destinationLabel,
        description: [`${describeTravelers(it.line.travelers)}.`, PICKUP_PENDING, "Reserva pendiente de pago: este calendario no confirma cupos."].join("\n"),
        url: absoluteUrl(it.line.path),
      })),
      { name: "Mi viaje · Peru Wonders Tours" },
    );
    downloadIcs(ics, "mi-viaje-peru-wonders-tours.ics");
    announce("Descargamos tu calendario de viaje.");
  };

  const help = cartHelpMessage(
    plan.items.map((it) => ({ title: it.line.title, date: it.start, travelers: it.line.travelers })),
    { step: "Mi viaje" },
  );

  return (
    <div className="pwt-container pt-10 pb-20">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-h1 font-medium">Mi viaje</h1>
          <p className="mt-2 text-foreground-muted">
            Del {formatDate(plan.start)} al {formatDate(plan.end)} · {totalDays} {totalDays === 1 ? "día" : "días"} ·{" "}
            {plan.items.length} {plan.items.length === 1 ? "tour" : "tours"}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" className={buttonClass("outline", "md")} onClick={onDownload}>
            <CalendarPlus aria-hidden size={18} strokeWidth={1.5} />
            Descargar calendario (.ics)
          </button>
          <Link href="/es/carrito" className={buttonClass("secondary", "md")}>
            Volver al carrito
          </Link>
        </div>
      </div>

      <div className="mt-8 grid gap-10 lg:grid-cols-[1fr_340px]">
        <div className="min-w-0">
          <TripConflictAlert lines={lines} className="mb-6" />

          {softOverlaps.map((c) => (
            <p key={c.signature} className="mb-4 rounded-md bg-warning-soft p-4 text-sm text-warning">
              {c.items.map((it) => it.line.title).join(" y ")} son el mismo día en la misma ciudad. Confirmaremos que los
              horarios no se crucen.
            </p>
          ))}

          <ol className="space-y-4" aria-label="Plan día a día">
            {plan.days.map((day, i) => {
              const dayNumber = daysBetween(plan.start!, day.date) + 1;
              if (day.kind === "free") {
                return (
                  <li
                    key={day.date}
                    className="pwt-stagger-in flex items-center gap-3 rounded-lg border border-dashed border-border-strong px-5 py-4 text-foreground-muted"
                    style={{ ["--i" as string]: i }}
                  >
                    <Coffee aria-hidden size={20} strokeWidth={1.5} className="shrink-0" />
                    <p>
                      <span className="font-medium text-foreground">
                        {day.count === 1 ? `Día ${dayNumber}` : `Días ${dayNumber} al ${dayNumber + day.count - 1}`}
                      </span>{" "}
                      · {day.count === 1 ? formatDate(day.date) : `${formatDate(day.date)} – ${formatDate(day.until)}`} ·{" "}
                      {day.count === 1 ? "Día libre o traslado" : "Días libres o de traslado"}
                    </p>
                  </li>
                );
              }
              const clash = plan.conflicts.some((c) => c.blocking && c.dates.includes(day.date));
              return (
                <li
                  key={day.date}
                  className="pwt-stagger-in rounded-lg border border-border bg-surface p-5 shadow-xs"
                  style={{ ["--i" as string]: i }}
                >
                  <h2 className="flex flex-wrap items-baseline gap-x-3 text-h4 font-medium">
                    <span className="text-primary">Día {dayNumber}</span>
                    <span className="text-body text-foreground-muted">{formatDate(day.date)}</span>
                    {clash ? (
                      <span className="rounded-pill bg-danger-soft px-2.5 py-0.5 text-sm text-danger">Fechas superpuestas</span>
                    ) : null}
                  </h2>
                  <ul className="mt-3 space-y-3">
                    {day.entries.map(({ item, dayNumber: tourDay }) => {
                      const note = plan.acclimatization.find((n) => n.lineId === item.line.id && n.date === day.date);
                      return (
                        <li key={item.line.id} className="border-l-2 border-primary pl-4">
                          <p className="font-medium">
                            <Link href={item.line.path} className="hover:underline">
                              {item.line.title}
                            </Link>
                          </p>
                          <p className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-sm text-foreground-muted">
                            {item.days > 1 ? (
                              <span className="inline-flex items-center gap-1.5">
                                <CalendarDays aria-hidden size={16} strokeWidth={1.5} />
                                Día {tourDay} de {item.days}
                                {tourDay === item.days ? " · fin del tour" : ""}
                              </span>
                            ) : null}
                            <span className="inline-flex items-center gap-1.5">
                              <MapPin aria-hidden size={16} strokeWidth={1.5} />
                              {item.region?.label ?? item.line.destinationLabel ?? "Varios destinos"}
                            </span>
                            <span className="inline-flex items-center gap-1.5">
                              <Users aria-hidden size={16} strokeWidth={1.5} />
                              {describeTravelers(item.line.travelers)}
                            </span>
                          </p>
                          {note && tourDay === 1 ? (
                            <p className="mt-3 flex gap-2 rounded-md bg-warning-soft p-3 text-sm text-warning">
                              <Mountain aria-hidden size={18} strokeWidth={1.5} className="mt-0.5 shrink-0" />
                              <span>
                                {acclimatizationText(note)} (Recomendación, no bloquea tu reserva.)
                              </span>
                            </p>
                          ) : null}
                        </li>
                      );
                    })}
                  </ul>
                </li>
              );
            })}
            {daysBetween(plan.start, plan.end) > 120 ? (
              <li className="text-sm text-foreground-muted">
                Tu viaje dura más de 4 meses; mostramos hasta el {formatDate(addDays(plan.start, 120))}.
              </li>
            ) : null}
          </ol>
        </div>

        <aside className="space-y-6 lg:sticky lg:top-24 lg:self-start" aria-label="Ayuda para tu viaje">
          {plan.acclimatization.length ? (
            <section aria-labelledby="altura-title" className="rounded-lg bg-warning-soft p-5 text-sm text-warning">
              <h2 id="altura-title" className="flex items-center gap-2 font-medium">
                <Mountain aria-hidden size={18} strokeWidth={1.5} />
                Aclimatación a la altura
              </h2>
              <p className="mt-2">
                Puno, Cusco y el Colca están sobre los 3 400 m. Llegar un día antes, hidratarte y comer ligero reduce el
                mal de altura (soroche).
              </p>
            </section>
          ) : null}
          <section aria-labelledby="pickup-title" className="rounded-lg bg-surface-muted p-5 text-sm">
            <h2 id="pickup-title" className="font-medium">
              Horarios y recojo
            </h2>
            <p className="mt-2 text-foreground-muted">
              Las horas de recojo se confirman al reservar, en hora de Lima. El calendario las incluirá cuando estén
              confirmadas.
            </p>
          </section>
          <a
            href={whatsappHref(help)}
            target="_blank"
            rel="noopener noreferrer"
            className="pwt-link inline-flex min-h-11 items-center gap-2 text-sm"
          >
            <MessageCircle aria-hidden size={18} strokeWidth={1.5} />
            ¿Dudas con tu plan? Escríbenos por WhatsApp
          </a>
        </aside>
      </div>
    </div>
  );
}
