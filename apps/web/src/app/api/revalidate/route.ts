import { createHash, timingSafeEqual } from "node:crypto";

import { revalidateTag } from "next/cache";
import { NextResponse } from "next/server";

import { env } from "@/lib/env";

/**
 * Refresco inmediato de la caché pública cuando el panel guarda un cambio (portadas, tours,
 * precios, blog, testimonios, banners). Lo llama solo el BFF del panel, servidor a servidor.
 * `POST /api/revalidate` con `x-revalidate-secret` y `{ "tags": ["catalog", …] }`.
 *
 * - Sin `REVALIDATE_SECRET` configurado el endpoint no existe (404).
 * - Secreto comparado en tiempo constante; solo se aceptan los tags conocidos.
 * - `expire: 0`: la siguiente visita trae datos nuevos (sin servir la copia vieja).
 */
const ALLOWED_TAGS = new Set(["catalog", "departures", "content", "testimonials", "hero-banners"]);

function sameSecret(given: string, expected: string): boolean {
  const a = createHash("sha256").update(given).digest();
  const b = createHash("sha256").update(expected).digest();
  return timingSafeEqual(a, b);
}

export async function POST(request: Request) {
  const secret = env.REVALIDATE_SECRET;
  if (!secret) return NextResponse.json({ error: "not-found" }, { status: 404 });
  if (!sameSecret(request.headers.get("x-revalidate-secret") ?? "", secret)) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  let tags: unknown;
  try {
    tags = ((await request.json()) as { tags?: unknown }).tags;
  } catch {
    return NextResponse.json({ error: "invalid-request" }, { status: 400 });
  }
  if (!Array.isArray(tags) || !tags.length || tags.length > ALLOWED_TAGS.size || !tags.every((t) => typeof t === "string" && ALLOWED_TAGS.has(t))) {
    return NextResponse.json({ error: "invalid-request" }, { status: 400 });
  }
  for (const tag of new Set(tags as string[])) revalidateTag(tag, { expire: 0 });
  return NextResponse.json({ revalidated: tags }, { headers: { "cache-control": "no-store" } });
}
