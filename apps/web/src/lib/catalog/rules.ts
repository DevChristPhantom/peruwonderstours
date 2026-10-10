import type { DurationBucket, PaymentPolicy } from "./types";

/**
 * Reglas de catálogo que el seed no trae y que luego vendrán del backoffice/API.
 * Módulo puro (sin server-only): lo usan tanto el servidor como los filtros del cliente.
 */

export const DEFAULT_DEPOSIT_PERCENT = 50;

/**
 * RN-14 (supuesto pendiente del cliente): los tours de la categoría Machu Picchu incluyen boletos
 * de tren/ingreso no reembolsables → se cobran al 100 %. En la API será `depositPercentOverride`.
 */
const FULL_PAYMENT_CATEGORIES = new Set(["tours-a-machu-picchu"]);

export function derivePaymentPolicy(categorySlugs: readonly string[]): PaymentPolicy {
  const requiresFull = categorySlugs.some((slug) => FULL_PAYMENT_CATEGORIES.has(slug));
  return requiresFull
    ? { depositPercent: 100, fullPaymentReason: "third-party-tickets" }
    : { depositPercent: DEFAULT_DEPOSIT_PERCENT, fullPaymentReason: null };
}

/** Rangos de duración del filtro. La etiqueta se traduce con `filters.duration.<valor>`. */
export const DURATION_BUCKETS: { value: DurationBucket }[] = [{ value: "1" }, { value: "2-3" }, { value: "4-6" }, { value: "7+" }];

export function durationBucketOf(days: number | null): DurationBucket | null {
  if (days === null || days < 1) return null;
  if (days === 1) return "1";
  if (days <= 3) return "2-3";
  if (days <= 6) return "4-6";
  return "7+";
}

export function isDurationBucket(value: string | null | undefined): value is DurationBucket {
  return DURATION_BUCKETS.some((b) => b.value === value);
}


const SYNONYMS: [RegExp, string][] = [
  [/\bcuzco\b/g, "cusco"],
  [/\bmachu\s?pi(c)?chu\b/g, "machu picchu"],
  [/\bmachupichu\b/g, "machu picchu"],
  [/\btiti(k|c)aka\b/g, "titicaca"],
];

/** Normaliza para búsqueda tolerante a tildes, mayúsculas y variantes comunes (HU-1.2). */
export function normalizeSearchText(value: string): string {
  let text = value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9ñ\s-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  for (const [pattern, replacement] of SYNONYMS) text = text.replace(pattern, replacement);
  return text;
}

/** true si todos los términos de la consulta aparecen en el texto (ambos normalizados). */
export function matchesQuery(haystack: string, query: string): boolean {
  const q = normalizeSearchText(query);
  if (!q) return true;
  const h = normalizeSearchText(haystack);
  return q.split(" ").every((term) => h.includes(term));
}
