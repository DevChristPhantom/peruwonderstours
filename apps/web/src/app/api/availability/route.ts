import { NextResponse } from "next/server";

import { ApiError } from "@/lib/api/client";
import { getDepartures } from "@/lib/api/departures";
import { getAllTours } from "@/lib/catalog";
import { env } from "@/lib/env";
import { addDays, todayInLima } from "@/lib/format";

/**
 * BFF del buscador por fecha (W4): `GET /api/availability?from=YYYY-MM-DD&to=YYYY-MM-DD&pax=N` →
 * `{ keys: string[] }` con las claves de los tours que tienen al menos una salida reservable en el
 * rango con cupo para `pax` viajeros. La API no filtra el listado por fecha: se consulta el calendario
 * de cada tour (caché compartida de 60 s por tour y rango en `getDepartures`).
 * Si la API no responde: 503 y el listado se muestra sin filtrar por fecha (con aviso).
 */
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const CONCURRENCY = 8;

export async function GET(request: Request) {
  const url = new URL(request.url);
  const today = todayInLima();
  const rawFrom = url.searchParams.get("from") ?? "";
  const rawTo = url.searchParams.get("to") ?? rawFrom;
  const pax = Math.min(20, Math.max(1, Number(url.searchParams.get("pax") ?? 1) || 1));
  if (!DATE.test(rawFrom) || !DATE.test(rawTo) || rawTo < rawFrom) {
    return NextResponse.json({ error: "invalid-request" }, { status: 400 });
  }
  const from = rawFrom < today ? today : rawFrom;
  const to = rawTo > addDays(from, 62) ? addDays(from, 62) : rawTo;
  if (to < from) return NextResponse.json({ keys: [] });

  const tours = await getAllTours("es");
  const keys: string[] = [];
  let failures = 0;
  for (let i = 0; i < tours.length; i += CONCURRENCY) {
    const batch = tours.slice(i, i + CONCURRENCY);
    const results = await Promise.all(
      batch.map(async (tour) => {
        try {
          const list = await getDepartures(tour.key, from, to, env.CATALOG_CURRENCY);
          return (list ?? []).some((d) => d.bookable && !d.isClosed && (d.available === null || d.available >= pax)) ? tour.key : null;
        } catch (error) {
          if (error instanceof ApiError && !error.unavailable) return null;
          failures++;
          return null;
        }
      }),
    );
    for (const key of results) if (key) keys.push(key);
  }
  if (failures > 0 && keys.length === 0) return NextResponse.json({ error: "unavailable" }, { status: 503 });
  return NextResponse.json({ keys, from, to, pax }, { headers: { "cache-control": "private, max-age=60" } });
}
