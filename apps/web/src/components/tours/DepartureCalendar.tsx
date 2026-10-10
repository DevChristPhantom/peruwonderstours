"use client";

import { useQuery } from "@tanstack/react-query";
import clsx from "clsx";
import { ChevronLeft, ChevronRight, Loader2 } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useId, useMemo, useRef, useState, type KeyboardEvent } from "react";

import { useFormat } from "@/hooks/useFormat";
import { INTL_LOCALE } from "@/i18n/routing";
import { addDays, DISPLAY_TIME_ZONE, parseIsoDate } from "@/lib/format";

/** Salida tal como la entrega el BFF (`/api/departures/<clave>`). */
export interface CalendarDeparture {
  id: string;
  date: string;
  startTime: string | null;
  capacity: number | null;
  available: number | null;
  isClosed: boolean;
  bookable: boolean;
  priceFrom: { amount: number; currency: "PEN" | "USD" } | null;
}

type DayState = "available" | "few" | "soldOut" | "closed" | "none" | "past";

/** Umbral de "últimos cupos". */
const FEW_SEATS = 4;

const monthStart = (iso: string) => `${iso.slice(0, 7)}-01`;
function monthEnd(iso: string): string {
  const [y, m] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10);
}
function shiftMonth(iso: string, delta: number): string {
  const [y, m] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1 + delta, 1)).toISOString().slice(0, 10);
}
/** 0 = lunes … 6 = domingo. */
function weekdayIndex(iso: string): number {
  const [y, m, d] = iso.split("-").map(Number);
  return (new Date(Date.UTC(y, m - 1, d)).getUTCDay() + 6) % 7;
}

async function fetchDepartures(key: string, from: string, to: string): Promise<CalendarDeparture[] | null> {
  const res = await fetch(`/api/departures/${encodeURIComponent(key)}?from=${from}&to=${to}`, { headers: { accept: "application/json" } });
  if (!res.ok) throw new Error(`departures ${res.status}`);
  return ((await res.json()) as { data: CalendarDeparture[] | null }).data;
}

interface DepartureCalendarProps {
  tourKey: string;
  /** Primera fecha seleccionable (`YYYY-MM-DD`, Lima). */
  minDate: string;
  value: string;
  onChange: (date: string, departure: CalendarDeparture | null) => void;
  /** Viajeros que ocupan cupo (adultos + niños). */
  seatsNeeded: number;
  /** id del texto de error/ayuda para `aria-describedby`. */
  describedBy?: string;
  invalid?: boolean;
  /** Sin calendario en línea (o API caída): se muestra el selector de fecha simple. */
  renderFallback: (reason: "no-calendar" | "error") => React.ReactNode;
}

/**
 * Calendario de salidas accesible (W6/F9, tour-detalle.md · Fecha): cupos reales, días cerrados y
 * precio desde por fecha, desde `GET /tours/:slug/departures`. Patrón de cuadrícula de fechas (APG):
 * flechas ← → ↑ ↓, Inicio/Fin de semana, RePág/AvPág de mes, Intro/Espacio para elegir. El estado de
 * cada día se comunica con texto e ícono además del color (leyenda visible, WCAG 1.4.1).
 */
export function DepartureCalendar({ tourKey, minDate, value, onChange, seatsNeeded, describedBy, invalid, renderFallback }: DepartureCalendarProps) {
  const id = useId();
  const t = useTranslations("calendar");
  const locale = useLocale();
  const f = useFormat();
  const [month, setMonth] = useState(() => monthStart(value || minDate));
  const [focusDate, setFocusDate] = useState(() => value || minDate);
  const gridRef = useRef<HTMLDivElement>(null);

  const from = month < monthStart(minDate) ? minDate : month;
  const to = monthEnd(month);
  const query = useQuery({
    queryKey: ["departures", tourKey, month],
    queryFn: () => fetchDepartures(tourKey, from < minDate ? minDate : from, to),
    staleTime: 60_000,
  });
  // ¿Tiene el tour calendario en línea? Se decide con el primer mes consultado.
  const firstMonth = useQuery({
    queryKey: ["departures", tourKey, "probe"],
    queryFn: () => fetchDepartures(tourKey, minDate, addDays(minDate, 180)),
    staleTime: 5 * 60_000,
  });

  const byDate = useMemo(() => {
    const map = new Map<string, CalendarDeparture[]>();
    for (const d of query.data ?? []) map.set(d.date, [...(map.get(d.date) ?? []), d]);
    return map;
  }, [query.data]);

  const fmtLong = useMemo(
    () => new Intl.DateTimeFormat(INTL_LOCALE[locale], { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: DISPLAY_TIME_ZONE }),
    [locale],
  );
  const fmtMonth = useMemo(() => new Intl.DateTimeFormat(INTL_LOCALE[locale], { month: "long", year: "numeric", timeZone: DISPLAY_TIME_ZONE }), [locale]);
  const weekdays = useMemo(() => {
    const short = new Intl.DateTimeFormat(INTL_LOCALE[locale], { weekday: "short", timeZone: "UTC" });
    const long = new Intl.DateTimeFormat(INTL_LOCALE[locale], { weekday: "long", timeZone: "UTC" });
    // 2026-01-05 es lunes.
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(Date.UTC(2026, 0, 5 + i));
      return { short: short.format(d), long: long.format(d) };
    });
  }, [locale]);

  if (firstMonth.isError && !firstMonth.data) return <>{renderFallback("error")}</>;
  if (firstMonth.data === null) return <>{renderFallback("no-calendar")}</>;
  if (firstMonth.data && firstMonth.data.length === 0) return <>{renderFallback("no-calendar")}</>;

  const pick = (date: string): { state: DayState; dep: CalendarDeparture | null } => {
    if (date < minDate) return { state: "past", dep: null };
    const list = byDate.get(date) ?? [];
    if (!list.length) return { state: "none", dep: null };
    const open = list.filter((d) => d.bookable && !d.isClosed);
    const fits = open.find((d) => d.available === null || d.available >= Math.max(1, seatsNeeded));
    if (fits) return { state: fits.available !== null && fits.available <= FEW_SEATS ? "few" : "available", dep: fits };
    if (open.length) return { state: "few", dep: open[0] };
    return { state: list.every((d) => d.isClosed) ? "closed" : "soldOut", dep: list[0] };
  };

  const selectable = (state: DayState, dep: CalendarDeparture | null) =>
    (state === "available" || state === "few") && !!dep && (dep.available === null || dep.available >= Math.max(1, seatsNeeded));

  const label = (date: string, state: DayState, dep: CalendarDeparture | null) => {
    const base = fmtLong.format(parseIsoDate(date));
    const parts = [base];
    if (state === "available" || state === "few") {
      if (dep?.available != null) parts.push(t("seats", { count: dep.available }));
      if (dep && dep.available !== null && dep.available < seatsNeeded) parts.push(t("notEnough", { count: seatsNeeded }));
      if (dep?.priceFrom) parts.push(t("from", { price: f.money(dep.priceFrom.amount, dep.priceFrom.currency) }));
    } else parts.push(t(`state.${state}`));
    if (date === value) parts.push(t("selected"));
    return parts.join(", ");
  };

  // Celdas del mes (con huecos al inicio para empezar en lunes).
  const first = month;
  const last = monthEnd(month);
  const offset = weekdayIndex(first);
  const days: (string | null)[] = Array.from({ length: offset }, () => null);
  for (let d = first; d <= last; d = addDays(d, 1)) days.push(d);
  while (days.length % 7) days.push(null);
  const weeks = Array.from({ length: days.length / 7 }, (_, i) => days.slice(i * 7, i * 7 + 7));

  const canPrev = month > monthStart(minDate);
  const maxMonth = monthStart(addDays(minDate, 360));
  const canNext = month < maxMonth;
  const activeFocus = focusDate >= first && focusDate <= last ? focusDate : (value >= first && value <= last ? value : first < minDate ? minDate : first);

  const moveFocus = (date: string) => {
    if (date < minDate) date = minDate;
    if (monthStart(date) > maxMonth) return;
    setFocusDate(date);
    if (monthStart(date) !== month) setMonth(monthStart(date));
    requestAnimationFrame(() => gridRef.current?.querySelector<HTMLButtonElement>(`[data-date="${date}"]`)?.focus());
  };

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const current = (e.target as HTMLElement).dataset.date;
    if (!current) return;
    const moves: Record<string, () => string> = {
      ArrowRight: () => addDays(current, 1),
      ArrowLeft: () => addDays(current, -1),
      ArrowDown: () => addDays(current, 7),
      ArrowUp: () => addDays(current, -7),
      Home: () => addDays(current, -weekdayIndex(current)),
      End: () => addDays(current, 6 - weekdayIndex(current)),
      PageDown: () => {
        const next = shiftMonth(current, 1);
        return `${next.slice(0, 8)}${String(Math.min(Number(current.slice(8)), Number(monthEnd(next).slice(8)))).padStart(2, "0")}`;
      },
      PageUp: () => {
        const prev = shiftMonth(current, -1);
        return `${prev.slice(0, 8)}${String(Math.min(Number(current.slice(8)), Number(monthEnd(prev).slice(8)))).padStart(2, "0")}`;
      },
    };
    const move = moves[e.key];
    if (!move) return;
    e.preventDefault();
    moveFocus(move());
  };

  return (
    <div className={clsx("mt-2 rounded-md border p-3", invalid ? "border-danger" : "border-border-strong")}>
      <div className="flex items-center justify-between gap-2">
        <button
          type="button"
          className="inline-flex size-11 items-center justify-center rounded-pill hover:bg-surface-muted disabled:opacity-40"
          onClick={() => setMonth(shiftMonth(month, -1))}
          disabled={!canPrev}
          aria-label={t("prevMonth")}
        >
          <ChevronLeft aria-hidden size={20} strokeWidth={1.5} />
        </button>
        <p id={`${id}-month`} className="font-medium capitalize" aria-live="polite">
          {fmtMonth.format(parseIsoDate(`${month.slice(0, 8)}15`))}
        </p>
        <button
          type="button"
          className="inline-flex size-11 items-center justify-center rounded-pill hover:bg-surface-muted disabled:opacity-40"
          onClick={() => setMonth(shiftMonth(month, 1))}
          disabled={!canNext}
          aria-label={t("nextMonth")}
        >
          <ChevronRight aria-hidden size={20} strokeWidth={1.5} />
        </button>
      </div>

      <div className="relative">
        {query.isFetching ? (
          <p role="status" className="absolute inset-0 z-[1] flex items-center justify-center gap-2 bg-surface/70 text-sm">
            <Loader2 aria-hidden size={16} strokeWidth={1.5} className="animate-spin motion-reduce:animate-none" />
            {t("loading")}
          </p>
        ) : null}
        <div ref={gridRef} role="grid" aria-labelledby={`${id}-month`} aria-describedby={describedBy} className="mt-2" onKeyDown={onKeyDown}>
          <div role="row" className="grid grid-cols-7 text-center text-xs text-foreground-muted">
            {weekdays.map((w) => (
              <span key={w.long} role="columnheader" aria-label={w.long} className="py-1 capitalize">
                {w.short.replace(".", "")}
              </span>
            ))}
          </div>
          {weeks.map((week, wi) => (
            <div role="row" key={wi} className="grid grid-cols-7 gap-1">
              {week.map((date, di) => {
                if (!date) return <span key={`e-${wi}-${di}`} role="gridcell" />;
                const { state, dep } = pick(date);
                const ok = selectable(state, dep);
                const selected = date === value;
                return (
                  <span key={date} role="gridcell" aria-selected={selected}>
                    <button
                      type="button"
                      data-date={date}
                      tabIndex={date === activeFocus ? 0 : -1}
                      aria-disabled={!ok || undefined}
                      aria-label={label(date, state, dep)}
                      onFocus={() => setFocusDate(date)}
                      onClick={() => {
                        if (ok) onChange(date, dep);
                      }}
                      className={clsx(
                        "relative flex min-h-11 w-full flex-col items-center justify-center rounded-md text-sm tabular transition-colors duration-150",
                        selected && "bg-primary text-on-primary",
                        !selected && ok && "border border-primary/40 bg-surface hover:bg-surface-muted",
                        !selected && !ok && "cursor-not-allowed text-foreground-muted",
                        state === "soldOut" && "line-through",
                      )}
                    >
                      <span aria-hidden="true">{Number(date.slice(8))}</span>
                      {/* Marca del estado (forma, no solo color). */}
                      <span aria-hidden="true" className="h-2 text-[10px] leading-none">
                        {state === "available" ? "●" : state === "few" ? "◐" : state === "closed" ? "–" : state === "soldOut" ? "×" : ""}
                      </span>
                    </button>
                  </span>
                );
              })}
            </div>
          ))}
        </div>
      </div>

      <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-foreground-muted" aria-label={t("legend")}>
        <li>
          <span aria-hidden="true">● </span>
          {t("state.available")}
        </li>
        <li>
          <span aria-hidden="true">◐ </span>
          {t("state.few")}
        </li>
        <li>
          <span aria-hidden="true" className="line-through">
            ×{" "}
          </span>
          {t("state.soldOut")}
        </li>
        <li>
          <span aria-hidden="true">– </span>
          {t("state.closed")}
        </li>
        <li>{t("noMark")}</li>
      </ul>
      {query.isError ? (
        <p role="alert" className="mt-2 text-sm text-danger">
          {t("error")}
        </p>
      ) : null}
    </div>
  );
}
