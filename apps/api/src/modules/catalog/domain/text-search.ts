/**
 * Búsqueda tolerante en memoria (modo demo/seed y tests). En PostgreSQL la hacen
 * `pg_trgm` + FTS `es_unaccent` (ver modelo-de-datos.md); aquí se replica el
 * comportamiento esencial: sin tildes, sin mayúsculas, sinónimos regionales y typos.
 */

const SYNONYMS: Record<string, string> = {
  cuzco: 'cusco',
  titikaka: 'titicaca',
  machupicchu: 'machu picchu',
  machupichu: 'machu picchu',
  'machu pichu': 'machu picchu',
};

export function normalizeText(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9ñ]+/g, ' ')
    .trim();
}

function applySynonyms(text: string): string {
  let result = ` ${text} `;
  for (const [from, to] of Object.entries(SYNONYMS)) {
    result = result.replaceAll(` ${from} `, ` ${to} `);
  }
  return result.trim();
}

export function trigrams(word: string): Set<string> {
  const padded = `  ${word} `;
  const set = new Set<string>();
  for (let i = 0; i < padded.length - 2; i += 1) set.add(padded.slice(i, i + 3));
  return set;
}

/** Similaridad tipo pg_trgm: |A ∩ B| / |A ∪ B|. */
export function trigramSimilarity(a: string, b: string): number {
  const ta = trigrams(a);
  const tb = trigrams(b);
  let shared = 0;
  for (const t of ta) if (tb.has(t)) shared += 1;
  const union = ta.size + tb.size - shared;
  return union === 0 ? 0 : shared / union;
}

export const SIMILARITY_THRESHOLD = 0.45;

/**
 * Puntaje de relevancia (0 = no coincide). Cada término de la consulta debe coincidir
 * exacto, como prefijo o por similitud trigram con una palabra (o dos palabras unidas).
 */
export function relevanceScore(query: string, document: string): number {
  const q = applySynonyms(normalizeText(query));
  if (!q) return 1;
  const doc = applySynonyms(normalizeText(document));
  const words = doc.split(' ');
  const candidates = new Set(words);
  for (let i = 0; i < words.length - 1; i += 1) candidates.add(`${words[i]}${words[i + 1]}`);

  let score = 0;
  for (const term of q.split(' ')) {
    if (candidates.has(term)) {
      score += 1;
      continue;
    }
    if (term.length >= 3 && [...candidates].some((w) => w.startsWith(term))) {
      score += 0.8;
      continue;
    }
    let best = 0;
    for (const w of candidates) best = Math.max(best, trigramSimilarity(term, w));
    if (best < SIMILARITY_THRESHOLD) return 0;
    score += best;
  }
  return score;
}
