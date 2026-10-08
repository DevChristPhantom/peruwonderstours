/**
 * Regiones del viaje y altitud de referencia (HU-B.A5, aviso de aclimatación).
 * Módulo puro, compartido por servidor y cliente.
 *
 * TODO(cliente, HU-B.A3): reemplazar las heurísticas por los atributos por tour (altitud máxima y
 * nivel de esfuerzo) cuando el backoffice los tenga. Hoy el seed solo trae "Fácil"/"Medio".
 */

export interface TripRegion {
  /** Ciudad base para comparar choques ("puno", "cusco"…). */
  key: string;
  label: string;
  /** Altitud de referencia en m s. n. m. */
  altitude: number;
  /** ≥ 2 500 m: conviene aclimatarse antes de un tour exigente. */
  high: boolean;
}

const BY_DESTINATION: Record<string, TripRegion> = {
  "tours-en-puno": { key: "puno", label: "Puno", altitude: 3812, high: true },
  cuzco: { key: "cusco", label: "Cusco", altitude: 3400, high: true },
  "tours-en-arequipa": { key: "arequipa", label: "Arequipa", altitude: 2335, high: false },
  "tours-en-ica-paracas": { key: "ica", label: "Ica y Paracas", altitude: 400, high: false },
  "tours-en-lima": { key: "lima", label: "Lima", altitude: 150, high: false },
};

/** Tours de Arequipa que suben a la puna (Chivay 3 635 m, Salinas 4 300 m). */
const HIGH_AREQUIPA = /colca|salinas|aguada-blanca/;

/** Heurística de esfuerzo mientras no exista el atributo (A3): caminatas largas y pasos de altura. */
const DEMANDING = /vinicunca|arcoiris|humantay|trekking|lagunas|amantani|colca|salinas/;

/**
 * Región del tour. `null` si no tiene destino o tiene varios (paquete multidestino: el operador
 * ya planifica la aclimatación y no se compara por ciudad).
 */
export function regionOf(tourSlug: string, destinationSlugs: readonly string[] | undefined): TripRegion | null {
  if (!destinationSlugs || destinationSlugs.length !== 1) return null;
  const base = BY_DESTINATION[destinationSlugs[0]];
  if (!base) return null;
  if (base.key === "arequipa" && HIGH_AREQUIPA.test(tourSlug)) {
    return { key: "arequipa", label: "Colca", altitude: 3635, high: true };
  }
  return base;
}

export function isDemanding(tourSlug: string, difficulty: string | null | undefined): boolean {
  if (difficulty && !/^f[aá]cil$/i.test(difficulty.trim())) return true;
  return DEMANDING.test(tourSlug);
}

/** Etiqueta de ciudad por destino (para textos y .ics). */
export function destinationLabel(slug: string): string | null {
  return BY_DESTINATION[slug]?.label ?? null;
}
