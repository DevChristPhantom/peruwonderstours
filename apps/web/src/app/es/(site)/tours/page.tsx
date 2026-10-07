import type { Metadata } from "next";
import { Suspense } from "react";

import { Breadcrumbs } from "@/components/layout/Breadcrumbs";
import { TourCard } from "@/components/tours/TourCard";
import { TourExplorer, type ExplorerTour } from "@/components/tours/TourExplorer";
import { getAllTours, getCategories, getDestinations } from "@/lib/catalog";
import { itemListJsonLd, JsonLd } from "@/lib/seo/json-ld";
import { pageMetadata } from "@/lib/seo/metadata";

export const metadata: Metadata = pageMetadata({
  title: "Tours y paquetes en el Perú",
  description:
    "Todos nuestros tours y paquetes: lago Titicaca, Machu Picchu, Cusco, Arequipa y el Colca. Filtra por destino, categoría y duración.",
  path: "/es/tours",
});

/** Listado estático (SSG); los filtros se aplican en el cliente y se reflejan en la URL. */
export default async function ToursPage() {
  const [tours, destinations, categories] = await Promise.all([getAllTours(), getDestinations(), getCategories()]);

  const cards = Object.fromEntries(tours.map((t) => [t.slug, <TourCard key={t.slug} tour={t} />]));
  const explorerTours: ExplorerTour[] = tours.map((t) => ({
    slug: t.slug,
    destinationSlugs: t.destinationSlugs,
    categorySlugs: t.categorySlugs,
    durationBucket: t.durationBucket,
    searchText: `${t.title} ${t.excerpt} ${t.destinationNames.join(" ")}`,
  }));

  const fallback = (
    <ul className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
      {tours.map((t) => (
        <li key={t.slug}>{cards[t.slug]}</li>
      ))}
    </ul>
  );

  return (
    <div className="pwt-container pt-8 pb-20">
      <JsonLd data={itemListJsonLd("Tours de Peru Wonders Tours", tours)} />
      <Breadcrumbs
        items={[
          { name: "Inicio", path: "/es" },
          { name: "Tours", path: "/es/tours" },
        ]}
      />
      <h1 className="mt-4 mb-8 font-display text-h1 font-medium">Tours y paquetes</h1>
      <Suspense fallback={fallback}>
        <TourExplorer
          tours={explorerTours}
          cards={cards}
          destinations={destinations.map((d) => ({ value: d.slug, label: d.name }))}
          categories={categories.map((c) => ({ value: c.slug, label: c.name }))}
          suggestions={tours.slice(0, 3).map((t) => t.slug)}
        />
      </Suspense>
    </div>
  );
}
