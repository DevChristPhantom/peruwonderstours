import { durationBucketOf, normalizeSearchText } from "@/lib/catalog/rules";
import type { DurationBucket } from "@/lib/catalog/types";

/**
 * Búsqueda por frase basada en reglas, sin IA (HU-B.A9).
 * "titicaca julio 4 personas" → destino Puno · mes julio · 4 viajeros.
 *
 * Reglas:
 * - Todo lo entendido se devuelve para mostrarse como chips editables: nunca hay filtros ocultos.
 * - Lo que no se entiende queda como texto libre (`text`) y se busca como siempre.
 * - Si no se reconoce nada, el texto completo se busca tal cual.
 * Módulo puro: sirve en servidor y cliente y se puede probar aislado.
 */

export interface PhraseMatch {
  slug: string;
  label: string;
}

export interface ParsedPhrase {
  destination: PhraseMatch | null;
  category: PhraseMatch | null;
  /** `YYYY-MM` (siguiente ocurrencia del mes según `today`). */
  month: string | null;
  adults: number | null;
  children: number | null;
  duration: DurationBucket | null;
  /** Texto que no se interpretó (se busca como texto normal). */
  text: string;
  /** true si se reconoció al menos un filtro. */
  understood: boolean;
}

/**
 * Alias → destino. `keep: true` = atractivo concreto: además de fijar el destino, se conserva como
 * texto para no ampliar la búsqueda a todo el destino ("uros" ≠ todo Puno).
 */
const DESTINATIONS: { alias: string; slug: string; label: string; keep?: boolean }[] = [
  { alias: "lago titicaca", slug: "tours-en-puno", label: "Puno" },
  { alias: "titicaca", slug: "tours-en-puno", label: "Puno" },
  { alias: "puno", slug: "tours-en-puno", label: "Puno" },
  { alias: "juliaca", slug: "tours-en-puno", label: "Puno" },
  { alias: "uros", slug: "tours-en-puno", label: "Puno", keep: true },
  { alias: "taquile", slug: "tours-en-puno", label: "Puno", keep: true },
  { alias: "amantani", slug: "tours-en-puno", label: "Puno", keep: true },
  { alias: "sillustani", slug: "tours-en-puno", label: "Puno", keep: true },
  { alias: "llachon", slug: "tours-en-puno", label: "Puno", keep: true },
  { alias: "cusco", slug: "cuzco", label: "Cusco" },
  { alias: "machu picchu", slug: "cuzco", label: "Cusco", keep: true },
  { alias: "valle sagrado", slug: "cuzco", label: "Cusco", keep: true },
  { alias: "vinicunca", slug: "cuzco", label: "Cusco", keep: true },
  { alias: "humantay", slug: "cuzco", label: "Cusco", keep: true },
  { alias: "maras", slug: "cuzco", label: "Cusco", keep: true },
  { alias: "moray", slug: "cuzco", label: "Cusco", keep: true },
  { alias: "arequipa", slug: "tours-en-arequipa", label: "Arequipa" },
  { alias: "ciudad blanca", slug: "tours-en-arequipa", label: "Arequipa" },
  { alias: "colca", slug: "tours-en-arequipa", label: "Arequipa", keep: true },
  { alias: "paracas", slug: "tours-en-ica-paracas", label: "Ica - Paracas" },
  { alias: "ica", slug: "tours-en-ica-paracas", label: "Ica - Paracas" },
  { alias: "huacachina", slug: "tours-en-ica-paracas", label: "Ica - Paracas", keep: true },
  { alias: "ballestas", slug: "tours-en-ica-paracas", label: "Ica - Paracas", keep: true },
  { alias: "lima", slug: "tours-en-lima", label: "Lima" },
];

const CATEGORIES: { alias: string; slug: string; label: string }[] = [
  { alias: "full days", slug: "full-days", label: "Full Days" },
  { alias: "full day", slug: "full-days", label: "Full Days" },
  { alias: "paquetes", slug: "paquetes-turisticos-en-peru", label: "Paquetes turísticos" },
  { alias: "paquete", slug: "paquetes-turisticos-en-peru", label: "Paquetes turísticos" },
  { alias: "excursiones", slug: "excursiones", label: "Excursiones" },
  { alias: "excursion", slug: "excursiones", label: "Excursiones" },
  { alias: "altiplano", slug: "rutas-del-altiplano", label: "Rutas del Altiplano" },
];

const MONTHS: [string, number][] = [
  ["enero", 1],
  ["febrero", 2],
  ["marzo", 3],
  ["abril", 4],
  ["mayo", 5],
  ["junio", 6],
  ["julio", 7],
  ["agosto", 8],
  ["septiembre", 9],
  ["setiembre", 9],
  ["octubre", 10],
  ["noviembre", 11],
  ["diciembre", 12],
  // Abreviaturas sin ambigüedad ("mar" y "set" se omiten: son palabras comunes).
  ["ene", 1],
  ["feb", 2],
  ["abr", 4],
  ["jun", 6],
  ["jul", 7],
  ["ago", 8],
  ["sep", 9],
  ["sept", 9],
  ["oct", 10],
  ["nov", 11],
  ["dic", 12],
];

export const MONTH_NAMES = [
  "enero",
  "febrero",
  "marzo",
  "abril",
  "mayo",
  "junio",
  "julio",
  "agosto",
  "septiembre",
  "octubre",
  "noviembre",
  "diciembre",
];

const NUMBER_WORDS: Record<string, number> = {
  un: 1,
  uno: 1,
  una: 1,
  dos: 2,
  tres: 3,
  cuatro: 4,
  cinco: 5,
  seis: 6,
  siete: 7,
  ocho: 8,
  nueve: 9,
  diez: 10,
};

const STOPWORDS = new Set([
  "a", "al", "en", "el", "la", "los", "las", "de", "del", "para", "por", "con", "y", "e", "o", "un", "una",
  "tour", "tours", "viaje", "viajes", "quiero", "queremos", "ir", "somos", "mes", "fecha", "busco", "buscamos",
  "peru", "conocer", "visitar",
]);

const NUM = `(\\d{1,2}|${Object.keys(NUMBER_WORDS).join("|")})`;
const toNumber = (raw: string) => (/^\d+$/.test(raw) ? Number(raw) : (NUMBER_WORDS[raw] ?? NaN));
const clampPax = (n: number) => (Number.isFinite(n) && n >= 1 && n <= 20 ? n : null);

function escapeRe(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Quita la primera aparición de `alias` como palabra(s) completa(s). */
function take(text: string, alias: string): { found: boolean; rest: string } {
  const re = new RegExp(`(^|\\s)${escapeRe(alias)}(?=\\s|$)`);
  if (!re.test(text)) return { found: false, rest: text };
  return { found: true, rest: text.replace(re, " ").replace(/\s+/g, " ").trim() };
}

/** Siguiente ocurrencia del mes (este año si aún no pasó; si no, el próximo). */
export function resolveMonth(month: number, today: string, year?: number): string {
  const [ty, tm] = today.split("-").map(Number);
  const y = year ?? (month >= tm ? ty : ty + 1);
  return `${y}-${String(month).padStart(2, "0")}`;
}

export function monthLabel(value: string): string | null {
  const m = /^(\d{4})-(\d{2})$/.exec(value);
  if (!m) return null;
  const name = MONTH_NAMES[Number(m[2]) - 1];
  return name ? `${name} ${m[1]}` : null;
}

export function isMonthValue(value: string | null | undefined): value is string {
  return !!value && monthLabel(value) !== null;
}

export function parsePhrase(input: string, today: string): ParsedPhrase {
  let text = normalizeSearchText(input);
  const result: ParsedPhrase = {
    destination: null,
    category: null,
    month: null,
    adults: null,
    children: null,
    duration: null,
    text: "",
    understood: false,
  };
  const kept: string[] = [];

  // Viajeros: "4 personas", "para 4", "somos cuatro", "2 adultos y 1 nino", "pareja".
  const kids = new RegExp(`(?:^|\\s)${NUM}\\s+(?:ninos|nino|ninas|nina|hijos|hijo|menores)(?=\\s|$)`).exec(text);
  if (kids) {
    result.children = clampPax(toNumber(kids[1]));
    text = text.replace(kids[0], " ");
  }
  const pax =
    new RegExp(`(?:^|\\s)${NUM}\\s+(?:personas|persona|pax|viajeros|viajero|adultos|adulto|gente)(?=\\s|$)`).exec(text) ??
    new RegExp(`(?:^|\\s)(?:para|somos)\\s+${NUM}(?=\\s|$)`).exec(text);
  if (pax) {
    result.adults = clampPax(toNumber(pax[1]));
    text = text.replace(pax[0], " ");
  } else if (/(^|\s)(en\s+)?pareja(\s|$)/.test(text)) {
    result.adults = 2;
    text = text.replace(/(^|\s)(en\s+)?pareja(?=\s|$)/, " ");
  }

  // Duración: "3 dias", "full day" se trata como categoría.
  const days = new RegExp(`(?:^|\\s)${NUM}\\s+(?:dias|dia)(?=\\s|$)`).exec(text);
  if (days) {
    result.duration = durationBucketOf(toNumber(days[1]));
    text = text.replace(days[0], " ");
  }

  // Mes (y año opcional): "julio", "en julio 2027", "jul".
  for (const [name, number] of MONTHS) {
    const re = new RegExp(`(?:^|\\s)${name}(?:\\s+(?:de\\s+)?(20\\d{2}))?(?=\\s|$)`);
    const m = re.exec(text);
    if (!m) continue;
    const year = m[1] ? Number(m[1]) : undefined;
    result.month = resolveMonth(number, today, year);
    text = text.replace(m[0], " ");
    break;
  }
  text = text.replace(/\s+/g, " ").trim();

  // Destino: el alias más largo primero ("lago titicaca" antes que "titicaca").
  for (const d of [...DESTINATIONS].sort((a, b) => b.alias.length - a.alias.length)) {
    const { found, rest } = take(text, d.alias);
    if (!found) continue;
    result.destination = { slug: d.slug, label: d.label };
    text = rest;
    if (d.keep) kept.push(d.alias);
    break;
  }

  for (const c of CATEGORIES) {
    const { found, rest } = take(text, c.alias);
    if (!found) continue;
    result.category = { slug: c.slug, label: c.label };
    text = rest;
    break;
  }

  const leftover = text
    .split(" ")
    .filter((w) => w && !STOPWORDS.has(w))
    .join(" ");
  result.understood = !!(
    result.destination ||
    result.category ||
    result.month ||
    result.adults ||
    result.children ||
    result.duration
  );
  result.text = result.understood ? [...kept, leftover].filter(Boolean).join(" ") : input.trim();
  return result;
}

/** Aplica la frase a parámetros de URL de /es/tours (destino, categoria, mes, adultos, ninos, duracion, q). */
export function applyPhraseToParams(parsed: ParsedPhrase, params: URLSearchParams): URLSearchParams {
  const next = new URLSearchParams(params.toString());
  if (parsed.destination) next.set("destino", parsed.destination.slug);
  if (parsed.category) next.set("categoria", parsed.category.slug);
  if (parsed.month) next.set("mes", parsed.month);
  if (parsed.adults) next.set("adultos", String(parsed.adults));
  if (parsed.children) next.set("ninos", String(parsed.children));
  if (parsed.duration) next.set("duracion", parsed.duration);
  if (parsed.text) next.set("q", parsed.text);
  else next.delete("q");
  return next;
}
