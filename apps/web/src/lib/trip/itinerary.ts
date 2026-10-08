import type { CartLine } from "@/lib/cart/types";
import { addDays, daysBetween } from "@/lib/format";

import { isDemanding, regionOf, type TripRegion } from "./regions";

/**
 * "Mi viaje" (HU-B.A5): el carrito como itinerario día a día, con choques de fechas y avisos de
 * aclimatación. Lógica pura (sin React) para poder probarla y reutilizarla en carrito y checkout.
 */

export interface TripItem {
  line: CartLine;
  /** Primer y último día del tour (`YYYY-MM-DD`, calendario de Lima). */
  start: string;
  end: string;
  days: number;
  region: TripRegion | null;
}

export type TripDay =
  | { kind: "tour"; date: string; entries: { item: TripItem; dayNumber: number }[] }
  /** Uno o varios días seguidos sin tours ("Día libre o traslado"). */
  | { kind: "free"; date: string; until: string; count: number };

export interface TripConflict {
  /** Firma estable: cambia si cambian los tours o sus fechas (invalida la confirmación). */
  signature: string;
  dates: string[];
  items: TripItem[];
  /** true: ciudades distintas o tours de varios días → hay que cambiar uno o confirmar. */
  blocking: boolean;
}

export interface AcclimatizationNote {
  lineId: string;
  date: string;
  title: string;
  region: TripRegion;
  demanding: boolean;
  /** Región más baja de la que llega (tour que termina el mismo día o el día previo, p. ej. Lima). */
  arrivingFrom: TripRegion | null;
}

export interface TripPlan {
  items: TripItem[];
  days: TripDay[];
  conflicts: TripConflict[];
  acclimatization: AcclimatizationNote[];
  start: string | null;
  end: string | null;
}

/** Más de esto en días libres seguidos se muestra como un solo bloque. */
const MAX_DAYS_SPAN = 120;

/** Días del tour: dato del catálogo o, para ítems antiguos, deducido de la etiqueta ("3 días / 2 noches"). */
export function lineDays(line: CartLine): number {
  if (line.durationDays && line.durationDays > 0) return Math.min(line.durationDays, 30);
  const match = /(\d{1,2})\s*(?:d[ií]as?\b|d\b|D\b)/.exec(line.durationLabel);
  const n = match ? Number(match[1]) : 1;
  return n > 0 ? Math.min(n, 30) : 1;
}

export function toTripItem(line: CartLine): TripItem {
  const days = lineDays(line);
  return {
    line,
    start: line.date,
    end: addDays(line.date, days - 1),
    days,
    region: regionOf(line.tourSlug, line.destinationSlugs),
  };
}

function overlaps(a: TripItem, b: TripItem): boolean {
  return a.start <= b.end && b.start <= a.end;
}

/** Dos tours de 1 día en la misma ciudad pueden caber (mañana/tarde): se avisa sin bloquear. */
function isSoftOverlap(a: TripItem, b: TripItem): boolean {
  return a.days === 1 && b.days === 1 && !!a.region && !!b.region && a.region.key === b.region.key;
}

function findConflicts(items: TripItem[]): TripConflict[] {
  // Componentes conexos de tours que se superponen.
  const parent = items.map((_, i) => i);
  const find = (i: number): number => (parent[i] === i ? i : (parent[i] = find(parent[i])));
  const pairs: [number, number][] = [];
  for (let i = 0; i < items.length; i++) {
    for (let j = i + 1; j < items.length; j++) {
      if (overlaps(items[i], items[j])) {
        pairs.push([i, j]);
        parent[find(i)] = find(j);
      }
    }
  }
  const groups = new Map<number, number[]>();
  items.forEach((_, i) => {
    if (!pairs.some(([a, b]) => a === i || b === i)) return;
    const root = find(i);
    groups.set(root, [...(groups.get(root) ?? []), i]);
  });

  return [...groups.values()].map((indexes) => {
    const group = indexes.map((i) => items[i]);
    const blocking = pairs
      .filter(([a]) => indexes.includes(a))
      .some(([a, b]) => !isSoftOverlap(items[a], items[b]));
    const dates = new Set<string>();
    for (const [a, b] of pairs.filter(([x]) => indexes.includes(x))) {
      const from = items[a].start > items[b].start ? items[a].start : items[b].start;
      const to = items[a].end < items[b].end ? items[a].end : items[b].end;
      for (let d = from; d <= to; d = addDays(d, 1)) dates.add(d);
    }
    const signature = group
      .map((it) => `${it.line.tourSlug}@${it.start}+${it.days}`)
      .sort()
      .join("|");
    return { signature, dates: [...dates].sort(), items: group, blocking };
  });
}

function findAcclimatization(items: TripItem[]): AcclimatizationNote[] {
  const notes: AcclimatizationNote[] = [];
  const sorted = [...items].sort((a, b) => (a.start === b.start ? a.days - b.days : a.start < b.start ? -1 : 1));
  for (const item of sorted) {
    const region = item.region;
    if (!region?.high) continue;
    // Tour inmediatamente anterior: si fue en altura (o es un paquete multidestino, que ya planifica
    // la aclimatación) y terminó hace ≤ 3 días, el viajero ya está aclimatado.
    const dayBefore = addDays(item.start, -1);
    const previous = sorted
      .filter((other) => other !== item && other.start < item.start)
      .reduce<TripItem | null>((best, other) => (!best || other.end > best.end ? other : best), null);
    const acclimatized =
      !!previous && (previous.region === null || previous.region.high) && daysBetween(previous.end, item.start) <= 3;
    if (acclimatized) continue;
    // Si ya hay un aviso para otro tour del mismo día y ciudad, basta uno.
    if (notes.some((n) => n.date === item.start && n.region.key === region.key)) continue;
    const fromLow = sorted.find(
      (other) => other !== item && other.region && !other.region.high && (other.end === item.start || other.end === dayBefore),
    );
    notes.push({
      lineId: item.line.id,
      date: item.start,
      title: item.line.title,
      region,
      demanding: isDemanding(item.line.tourSlug, item.line.difficulty),
      arrivingFrom: fromLow?.region ?? null,
    });
  }
  return notes;
}

function buildDays(items: TripItem[], start: string, end: string): TripDay[] {
  const days: TripDay[] = [];
  let date = start;
  let guard = 0;
  while (date <= end && guard++ < 400) {
    const entries = items
      .filter((it) => it.start <= date && date <= it.end)
      .map((item) => ({ item, dayNumber: daysBetween(item.start, date) + 1 }));
    if (entries.length) {
      days.push({ kind: "tour", date, entries });
      date = addDays(date, 1);
      continue;
    }
    // Agrupa los días libres seguidos hasta el próximo tour.
    const next = items.map((it) => it.start).filter((s) => s > date).sort()[0] ?? addDays(end, 1);
    const until = addDays(next, -1);
    days.push({ kind: "free", date, until, count: daysBetween(date, until) + 1 });
    date = next;
  }
  return days;
}

export function buildTripPlan(lines: readonly CartLine[]): TripPlan {
  const items = lines.map(toTripItem).sort((a, b) => (a.start < b.start ? -1 : a.start > b.start ? 1 : 0));
  if (!items.length) return { items, days: [], conflicts: [], acclimatization: [], start: null, end: null };
  const start = items[0].start;
  const end = items.reduce((max, it) => (it.end > max ? it.end : max), items[0].end);
  // Fechas muy separadas: se listan igual, con los días libres agrupados (buildDays).
  const span = Math.min(daysBetween(start, end), MAX_DAYS_SPAN);
  return {
    items,
    days: buildDays(items, start, addDays(start, span)),
    conflicts: findConflicts(items),
    acclimatization: findAcclimatization(items),
    start,
    end,
  };
}

/** Firmas de los choques que exigen cambiar un tour o confirmar (gate del pago). */
export function blockingSignatures(lines: readonly CartLine[]): string[] {
  return buildTripPlan(lines)
    .conflicts.filter((c) => c.blocking)
    .map((c) => c.signature);
}
