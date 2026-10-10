import "server-only";

import { apiRequest } from "./client";

/**
 * ADAPTADOR AISLADO del calendario de salidas (W6/F9): `GET /tours/:slug/departures?from&to&currency`
 * → `{ data: [{ id, date, startTime, capacity, available, isClosed, bookable, priceFrom }] }`.
 * Ventana máxima de la API: 180 días. `slug` = clave del tour (slug en español).
 */

export interface DepartureDay {
  id: string;
  date: string;
  startTime: string | null;
  capacity: number | null;
  available: number | null;
  isClosed: boolean;
  bookable: boolean;
  priceFrom: { amount: number; currency: "PEN" | "USD" } | null;
}

interface RawDeparture {
  id: string;
  date: string;
  startTime: string | null;
  capacity: number | null;
  available: number | null;
  isClosed: boolean;
  bookable?: boolean;
  priceFrom?: { amount: number; currency: "PEN" | "USD" } | null;
}

export async function getDepartures(slug: string, from: string, to: string, currency: "PEN" | "USD"): Promise<DepartureDay[] | null> {
  const res = await apiRequest<{ data: RawDeparture[] }>(
    `/tours/${encodeURIComponent(slug)}/departures?from=${from}&to=${to}&currency=${currency}`,
    // Cupos casi en tiempo real: caché corta compartida (la API revalida el cupo al reservar).
    { next: { revalidate: 60, tags: ["departures"] }, nullOn404: true },
  );
  if (!res) return null;
  return res.body.data.map((d) => ({
    id: d.id,
    date: d.date,
    startTime: d.startTime,
    capacity: d.capacity,
    available: d.available,
    isClosed: d.isClosed,
    bookable: d.bookable ?? (!d.isClosed && (d.available === null || d.available > 0)),
    priceFrom: d.priceFrom ?? null,
  }));
}
