import type { Metadata } from "next";
import { Suspense } from "react";

import { Breadcrumbs } from "@/components/layout/Breadcrumbs";
import { TourCard } from "@/components/tours/TourCard";
import { FavoritesView, type FavoriteCatalogEntry } from "@/components/wishlist/FavoritesView";
import { getAllTours } from "@/lib/catalog";

export const metadata: Metadata = {
  title: "Mis favoritos",
  description: "Los tours que guardaste en este navegador. Compártelos con quien viaja contigo.",
  alternates: { canonical: "/es/favoritos" },
  robots: { index: false, follow: true },
};

/**
 * Favoritos (HU-B.A4). Página estática (ISR del layout): las tarjetas se renderizan en el servidor y
 * el cliente muestra las guardadas en el navegador o las de un enlace compartido (`?tours=`).
 */
export default async function FavoritesPage() {
  const tours = await getAllTours();
  const cards = Object.fromEntries(tours.map((t) => [t.slug, <TourCard key={t.slug} tour={t} />]));
  const catalog: FavoriteCatalogEntry[] = tours.map((t) => ({
    slug: t.slug,
    title: t.shortTitle,
    destinationSlugs: t.destinationSlugs,
    categorySlugs: t.categorySlugs,
    featured: t.featured,
  }));

  return (
    <div className="pwt-container pt-8 pb-20">
      <Breadcrumbs
        items={[
          { name: "Inicio", path: "/es" },
          { name: "Favoritos", path: "/es/favoritos" },
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
