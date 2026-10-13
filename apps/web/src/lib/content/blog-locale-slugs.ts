interface BlogSlugSource {
  slug: string;
  locale?: "es" | "en";
  fallback?: boolean;
  alternateLocales?: { locale: "es" | "en"; slug: string }[];
}

/** Published API translations take precedence over the legacy seed's slug map. */
export function blogLocaleSlugs(
  card: BlogSlugSource,
  locale: "es" | "en",
  spanishSlug?: string,
  legacyEnglishSlug?: string,
) {
  const es = card.alternateLocales?.find((item) => item.locale === "es")?.slug ?? spanishSlug ?? card.slug;
  const fallback = card.fallback ?? (card.locale !== undefined && card.locale !== locale);
  const en = card.alternateLocales?.find((item) => item.locale === "en")?.slug
    ?? (locale === "en" && !fallback ? card.slug : legacyEnglishSlug ?? es);
  return { es, en };
}
