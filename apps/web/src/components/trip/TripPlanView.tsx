"use client";

import { CalendarDays, CalendarPlus, Coffee, MapPin, MessageCircle, Mountain, Users } from "lucide-react";
import NextLink from "@/components/ui/IntentLink";
import { useTranslations } from "next-intl";
import { useMemo } from "react";

import { useFormat } from "@/hooks/useFormat";
import { useTravelersText } from "@/hooks/useTravelersText";
import { Link } from "@/i18n/navigation";
import { INTL_LOCALE } from "@/i18n/routing";
import { useWhatsappTools } from "@/hooks/useWhatsappTools";
import { addDays, daysBetween, type Formatter } from "@/lib/format";
import { absoluteUrl } from "@/lib/site";
import { buildIcs, downloadIcs } from "@/lib/trip/ics";
import { buildTripPlan, type AcclimatizationNote } from "@/lib/trip/itinerary";
import { cartHelpMessage, whatsappHref } from "@/lib/whatsapp/messages";
import { useCartHydrated, useCartStore } from "@/stores/cart-store";
import { useUiStore } from "@/stores/ui-store";
import { buttonClass } from "@/components/ui/button-styles";
import { TripConflictAlert } from "./TripConflictAlert";

type Translate = ReturnType<typeof useTranslations<"trip">>;

function acclimatizationText(note: AcclimatizationNote, t: Translate, fmt: Formatter): string {
  /** "3 812" (espacio fino como separador de miles, como en el resto del sitio). */
  const meters = (n: number) => new Intl.NumberFormat(INTL_LOCALE[fmt.locale]).format(n).replace(/,/g, " ");
  const where = t("altitude.where", { region: note.region.label, meters: meters(note.region.altitude) });
  const from = note.arrivingFrom ? ` ${t("altitude.from", { region: note.arrivingFrom.label, meters: meters(note.arrivingFrom.altitude) })}` : "";
  const effort = ` ${note.demanding ? t("altitude.demanding") : t("altitude.easy")}`;
  return `${t("altitude.starts", { date: fmt.date(note.date), title: note.title, where })}${from}${effort}`;
}

/** "Mi viaje" (HU-B.A5): itinerario día a día del carrito con avisos y exportación .ics. */
export function TripPlanView() {
  const t = useTranslations("trip");
  const tc = useTranslations("cart");
  const fmt = useFormat();
  const travelersText = useTravelersText();
  const wa = useWhatsappTools();
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
        <span className="sr-only">{t("loading")}</span>
      </div>
    );
  }

  if (!plan.items.length || !plan.start || !plan.end) {
    return (
      <div className="pwt-container flex flex-col items-center py-20 text-center">
        <h1 className="font-display text-h1 font-medium">{t("title")}</h1>
        <p className="mt-4 max-w-prose text-foreground-muted">{t("empty")}</p>
        <Link href="/tours" className={buttonClass("secondary", "lg", "mt-6")}>
          {tc("browseTours")}
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
        description: [`${travelersText(it.line.travelers)}.`, t("ics.pickup"), t("ics.notConfirmed")].join("\n"),
        url: absoluteUrl(it.line.path),
      })),
      { name: t("ics.calendarName") },
    );
    downloadIcs(ics, t("ics.fileName"));
    announce(t("ics.announce"));
  };

  const help = cartHelpMessage(
    wa,
    plan.items.map((it) => ({ title: it.line.title, date: it.start, travelers: it.line.travelers })),
    { step: t("title") },
  );

  return (
    <div className="pwt-container pt-10 pb-20">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-h1 font-medium">{t("title")}</h1>
          <p className="mt-2 text-foreground-muted">
            {t("range", { from: fmt.date(plan.start), to: fmt.date(plan.end), days: totalDays, tours: plan.items.length })}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" className={buttonClass("outline", "md")} onClick={onDownload}>
            <CalendarPlus aria-hidden size={18} strokeWidth={1.5} />
            {t("download")}
          </button>
          <Link href="/carrito" className={buttonClass("secondary", "md")}>
            {t("backToCart")}
          </Link>
        </div>
      </div>

      <div className="mt-8 grid gap-10 lg:grid-cols-[1fr_340px]">
        <div className="min-w-0">
          <TripConflictAlert lines={lines} className="mb-6" />

          {softOverlaps.map((c) => (
            <p key={c.signature} className="mb-4 rounded-md bg-warning-soft p-4 text-sm text-warning">
              {t("sameDay", { titles: c.items.map((it) => it.line.title).join(t("conflict.and")) })}
            </p>
          ))}

          <ol className="space-y-4" aria-label={t("planLabel")}>
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
                        {day.count === 1 ? t("day", { n: dayNumber }) : t("dayRange", { from: dayNumber, to: dayNumber + day.count - 1 })}
                      </span>{" "}
                      · {day.count === 1 ? fmt.date(day.date) : `${fmt.date(day.date)} – ${fmt.date(day.until)}`} ·{" "}
                      {t("freeDays", { count: day.count })}
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
                    <span className="text-primary">{t("day", { n: dayNumber })}</span>
                    <span className="text-body text-foreground-muted">{fmt.date(day.date)}</span>
                    {clash ? (
                      <span className="rounded-pill bg-danger-soft px-2.5 py-0.5 text-sm text-danger">{t("overlapping")}</span>
                    ) : null}
                  </h2>
                  <ul className="mt-3 space-y-3">
                    {day.entries.map(({ item, dayNumber: tourDay }) => {
                      const note = plan.acclimatization.find((n) => n.lineId === item.line.id && n.date === day.date);
                      return (
                        <li key={item.line.id} className="border-l-2 border-primary pl-4">
                          <p className="font-medium">
                            <NextLink href={item.line.path} className="hover:underline">
                              {item.line.title}
                            </NextLink>
                          </p>
                          <p className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-sm text-foreground-muted">
                            {item.days > 1 ? (
                              <span className="inline-flex items-center gap-1.5">
                                <CalendarDays aria-hidden size={16} strokeWidth={1.5} />
                                {t("tourDay", { n: tourDay, total: item.days })}
                                {tourDay === item.days ? ` · ${t("tourEnd")}` : ""}
                              </span>
                            ) : null}
                            <span className="inline-flex items-center gap-1.5">
                              <MapPin aria-hidden size={16} strokeWidth={1.5} />
                              {item.region?.label ?? item.line.destinationLabel ?? t("severalDestinations")}
                            </span>
                            <span className="inline-flex items-center gap-1.5">
                              <Users aria-hidden size={16} strokeWidth={1.5} />
                              {travelersText(item.line.travelers)}
                            </span>
                          </p>
                          {note && tourDay === 1 ? (
                            <p className="mt-3 flex gap-2 rounded-md bg-warning-soft p-3 text-sm text-warning">
                              <Mountain aria-hidden size={18} strokeWidth={1.5} className="mt-0.5 shrink-0" />
                              <span>
                                {acclimatizationText(note, t, fmt)} {t("altitude.notBlocking")}
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
                {t("tooLong", { date: fmt.date(addDays(plan.start, 120)) })}
              </li>
            ) : null}
          </ol>
        </div>

        <aside className="space-y-6 lg:sticky lg:top-24 lg:self-start" aria-label={t("helpLabel")}>
          {plan.acclimatization.length ? (
            <section aria-labelledby="altura-title" className="rounded-lg bg-warning-soft p-5 text-sm text-warning">
              <h2 id="altura-title" className="flex items-center gap-2 font-medium">
                <Mountain aria-hidden size={18} strokeWidth={1.5} />
                {t("altitude.title")}
              </h2>
              <p className="mt-2">{t("altitude.text")}</p>
            </section>
          ) : null}
          <section aria-labelledby="pickup-title" className="rounded-lg bg-surface-muted p-5 text-sm">
            <h2 id="pickup-title" className="font-medium">
              {t("pickupTitle")}
            </h2>
            <p className="mt-2 text-foreground-muted">{t("pickupText")}</p>
          </section>
          <a
            href={whatsappHref(help)}
            target="_blank"
            rel="noopener noreferrer"
            className="pwt-link inline-flex min-h-11 items-center gap-2 text-sm"
          >
            <MessageCircle aria-hidden size={18} strokeWidth={1.5} />
            {t("whatsapp")}
          </a>
        </aside>
      </div>
    </div>
  );
}
