import type { Locale, PublicationStatus } from './tour.js';

export interface LocalizedName {
  locale: Locale;
  name: string;
  description: string | null;
  /** Slug del idioma (null/ausente = slug canónico de la entidad). */
  slug?: string | null;
  /** Metadato del panel (no se publica). */
  translationStatus?: string | null;
}

export interface Destination {
  id: string;
  slug: string;
  parentId: string | null;
  status: PublicationStatus;
  sortOrder: number;
  coverStorageKey?: string | null;
  translations: LocalizedName[];
}

export interface Category {
  id: string;
  slug: string;
  sortOrder: number;
  coverStorageKey?: string | null;
  translations: LocalizedName[];
}

export function localizedName(
  entity: { slug: string; translations: LocalizedName[] },
  locale: Locale,
): LocalizedName {
  return (
    entity.translations.find((t) => t.locale === locale) ??
    entity.translations.find((t) => t.locale === 'es') ?? { locale, name: entity.slug, description: null }
  );
}

/** Igual que localizedName pero indicando si hubo fallback a `es` (I6). */
export function resolveLocalizedName(entity: { slug: string; translations: LocalizedName[] }, locale: Locale): { value: LocalizedName; locale: Locale; fallback: boolean; slug: string } {
  const exact = entity.translations.find((t) => t.locale === locale);
  const value = exact ?? localizedName(entity, locale);
  const served = exact ? locale : value.locale;
  return { value, locale: served, fallback: !exact, slug: value.slug ?? entity.slug };
}

/** Slug público de la entidad en un idioma (el propio de la traducción o el canónico). */
export function slugFor(entity: { slug: string; translations: LocalizedName[] }, locale: Locale): string {
  return entity.translations.find((t) => t.locale === locale)?.slug ?? entity.slug;
}
