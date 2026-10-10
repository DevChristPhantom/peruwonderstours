import { NextResponse } from "next/server";

import { ApiError } from "@/lib/api/client";
import { getDepartures } from "@/lib/api/departures";
import { env } from "@/lib/env";
import { addDays, todayInLima } from "@/lib/format";

/**
 * BFF del calendario de salidas (W6): el navegador nunca llama a la API directamente.
 * `GET /api/departures/<clave-del-tour>?from=YYYY-MM-DD&to=YYYY-MM-DD` (máx. 180 días).
 * Respuesta: `{ data: DepartureDay[] | null }` (null = el tour no tiene calendario en línea).
 */
const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const DATE = /^\d{4}-\d{2}-\d{2}$/;

export async function GET(request: Request, ctx: RouteContext<"/api/departures/[slug]">) {
  const { slug } = await ctx.params;
  const url = new URL(request.url);
  const today = todayInLima();
  const from = url.searchParams.get("from") ?? today;
  const to = url.searchParams.get("to") ?? addDays(from, 62);
  if (!SLUG.test(slug) || slug.length > 160 || !DATE.test(from) || !DATE.test(to) || to < from) {
    return NextResponse.json({ error: "invalid-request" }, { status: 400 });
  }
  const clampedTo = to > addDays(from, 180) ? addDays(from, 180) : to;
  try {
    const data = await getDepartures(slug, from < today ? today : from, clampedTo, env.CATALOG_CURRENCY);
    return NextResponse.json({ data }, { headers: { "cache-control": "private, max-age=60" } });
  } catch (error) {
    if (error instanceof ApiError && !error.unavailable) return NextResponse.json({ data: null });
    return NextResponse.json({ error: "unavailable" }, { status: 503 });
  }
}
