/**
 * Regla única de idioma del contenido público (I3/I6, Sprint 3): se sirve la traducción pedida;
 * si falta, la canónica `es` y la respuesta lo indica con `{ locale: 'es', fallback: true }`.
 * Se aplica igual a tours, destinos, categorías y blog.
 */
export const CONTENT_LOCALES = ['es', 'en'] as const;
export type ContentLocale = (typeof CONTENT_LOCALES)[number];
export const DEFAULT_LOCALE: ContentLocale = 'es';

export interface Localized<T> {
  value: T;
  /** Idioma realmente servido. */
  locale: ContentLocale;
  /** true si no existía la traducción pedida y se sirvió la canónica. */
  fallback: boolean;
}

export function pickTranslation<T extends { locale: ContentLocale }>(translations: readonly T[], requested: ContentLocale): Localized<T> | null {
  const exact = translations.find((t) => t.locale === requested);
  if (exact) return { value: exact, locale: requested, fallback: false };
  const canonical = translations.find((t) => t.locale === DEFAULT_LOCALE) ?? translations[0];
  return canonical ? { value: canonical, locale: canonical.locale, fallback: true } : null;
}

/** Metadatos de idioma que acompañan a cada recurso traducible en las respuestas públicas. */
export function localeMeta<T>(picked: Localized<T>): { locale: ContentLocale; fallback: boolean } {
  return { locale: picked.locale, fallback: picked.fallback };
}

/** Estado de traducción conocido (lo escribe el seed de data/seed/en). */
export const TRANSLATION_STATUSES = ['machine_reviewed_pending_client', 'client_approved', 'staff_written'] as const;
