import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Suspense } from "react";

import { Breadcrumbs } from "@/components/layout/Breadcrumbs";
import { TourCard } from "@/components/tours/TourCard";
import { FavoritesView, type FavoriteCatalogEntry } from "@/components/wishlist/FavoritesView";
import { localePath } from "@/i18n/paths";
import type { Locale } from "@/i18n/routing";
import { getAllTours } from "@/lib/catalog";
import { alternatesFor, pageMetadata } from "@/lib/seo/metadata";

export async function generateMetadata({ params }: PageProps<"/[locale]/favoritos">): Promise<Metadata> {
  const locale = (await params).locale as Locale;
  const t = await getTranslations({ locale, namespace: "favorites" });
  return pageMetadata({ locale, title: t("title"), description: t("metaDescription"), paths: alternatesFor("/favoritos"), index: false });
}

/**
 * Favoritos (HU-B.A4). Página estática (ISR del layout): las tarjetas se renderizan en el servidor y
 * el cliente muestra las guardadas en el navegador o las de un enlace compartido (`?tours=`).
 * Las tarjetas se indexan por la CLAVE estable del tour (slug en español), igual que el almacén local.
 */
export default async function FavoritesPage({ params }: PageProps<"/[locale]/favoritos">) {
  const locale = (await params).locale as Locale;
  setRequestLocale(locale);
  const [tours, t, tc] = await Promise.all([getAllTours(locale), getTranslations("favorites"), getTranslations("common")]);
  const cards = Object.fromEntries(tours.map((tour) => [tour.key, <TourCard key={tour.key} tour={tour} />]));
  const catalog: FavoriteCatalogEntry[] = tours.map((tour) => ({
    slug: tour.key,
    title: tour.shortTitle,
    destinationSlugs: tour.destinationSlugs,
    categorySlugs: tour.categorySlugs,
    featured: tour.featured,
  }));

  return (
    <div className="pwt-container pt-8 pb-20">
      <Breadcrumbs
        items={[
          { name: tc("home"), path: localePath(locale, "/") },
          { name: t("title"), path: localePath(locale, "/favoritos") },
        ]}
      />
      <Suspense
        fallback={
          <div aria-busy="true" className="mt-6">
            <div className="h-10 w-56 animate-pulse rounded-md bg-surface-muted motion-reduce:animate-none" />
          </div>
        }
      >
        <FavoritesView catalog={catalog} cards={cards} />
      </Suspense>
    </div>
  );
}
