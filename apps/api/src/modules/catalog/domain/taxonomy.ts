import type { Locale, PublicationStatus } from './tour.js';

export interface LocalizedName {
  locale: Locale;
  name: string;
  description: string | null;
}

export interface Destination {
  id: string;
  slug: string;
  parentId: string | null;
  status: PublicationStatus;
  sortOrder: number;
  translations: LocalizedName[];
}

export interface Category {
  id: string;
  slug: string;
  sortOrder: number;
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
