import type { Metadata } from "next";
import { connection } from "next/server";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { Breadcrumbs } from "@/components/layout/Breadcrumbs";
import { TourCard } from "@/components/tours/TourCard";
import { TourExplorer, type ExplorerTour } from "@/components/tours/TourExplorer";
import { localePath } from "@/i18n/paths";
import type { Locale } from "@/i18n/routing";
import { getAllTours, getCategories, getDestinations } from "@/lib/catalog";
import { itemListJsonLd, JsonLd } from "@/lib/seo/json-ld";
import { alternatesFor, pageMetadata } from "@/lib/seo/metadata";

export async function generateMetadata({ params }: PageProps<"/[locale]/tours">): Promise<Metadata> {
  const locale = (await params).locale as Locale;
  const t = await getTranslations({ locale, namespace: "explorer" });
  return pageMetadata({ locale, title: t("metaTitle"), description: t("metaDescription"), paths: alternatesFor("/tours") });
}

/** Listado por petición: filtros compartibles en la URL y datos del catálogo con su caché explícita. */
export default async function ToursPage({ params }: PageProps<"/[locale]/tours">) {
  // URL filters need request-time rendering; async cards are passed to one explorer tree.
  await connection();
  const locale = (await params).locale as Locale;
  setRequestLocale(locale);
  const [tours, destinations, categories, t, tc] = await Promise.all([
    getAllTours(locale),
    getDestinations(locale),
    getCategories(locale),
    getTranslations("explorer"),
    getTranslations("common"),
  ]);

  const cards = Object.fromEntries(tours.map((tour) => [tour.key, <TourCard key={tour.key} tour={tour} />]));
  const explorerTours: ExplorerTour[] = tours.map((tour) => ({
    slug: tour.key,
    destinationSlugs: tour.destinationSlugs,
    categorySlugs: tour.categorySlugs,
    durationBucket: tour.durationBucket,
    minPax: tour.minPax,
    searchText: `${tour.title} ${tour.excerpt} ${tour.destinationNames.join(" ")}`,
  }));

  return (
    <div className="pwt-container pt-8 pb-20">
      <JsonLd data={itemListJsonLd(t("itemListName"), tours)} />
      <Breadcrumbs
        items={[
          { name: tc("home"), path: localePath(locale, "/") },
          { name: tc("tours"), path: localePath(locale, "/tours") },
        ]}
      />
      <h1 className="mt-4 mb-8 font-display text-h1 font-medium">{t("title")}</h1>
      <TourExplorer
        tours={explorerTours}
        cards={cards}
        destinations={destinations.map((d) => ({ value: d.key, label: d.name }))}
        categories={categories.map((c) => ({ value: c.key, label: c.name }))}
        suggestions={tours.slice(0, 3).map((tour) => tour.key)}
      />
    </div>
  );
}
