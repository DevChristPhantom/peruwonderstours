import type { Metadata } from "next";

import { DestinationsSection } from "@/components/home/DestinationsSection";
import { FeaturedTours, type FeaturedGroup } from "@/components/home/FeaturedTours";
import { Hero } from "@/components/home/Hero";
import { FinalCta, TestimonialsPlaceholder, TrustSection, WhyUsSection } from "@/components/home/HomeSections";
import { SearchBar } from "@/components/search/SearchBar";
import { getAllTours, getDestinations, getFeaturedTours, getNavMedia, getSearchOptions } from "@/lib/catalog";
import { JsonLd, organizationJsonLd } from "@/lib/seo/json-ld";
import { pageMetadata } from "@/lib/seo/metadata";
import { SITE } from "@/lib/site";

export const metadata: Metadata = {
  ...pageMetadata({
    title: `${SITE.name} · Tours y paquetes en el sur del Perú`,
    description: SITE.defaultDescription,
    path: "/es",
  }),
  title: { absolute: `${SITE.name} · Tours y paquetes en el sur del Perú` },
};

export default async function HomePage() {
  const [media, destinations, allTours, featured, searchOptions] = await Promise.all([
    getNavMedia(),
    getDestinations(),
    getAllTours(),
    getFeaturedTours(6),
    getSearchOptions(),
  ]);

  const groups: FeaturedGroup[] = [
    { key: "todos", label: "Todos", tours: featured, emptyText: "Aún no tenemos paquetes destacados." },
    {
      key: "altiplano",
      label: "Altiplano",
      tours: allTours
        .filter((t) => t.destinationSlugs.includes("tours-en-puno") || t.categorySlugs.includes("rutas-del-altiplano"))
        .slice(0, 6),
      emptyText: "Aún no tenemos paquetes en esta categoría.",
    },
    {
      key: "machu-picchu",
      label: "Machu Picchu",
      tours: allTours.filter((t) => t.categorySlugs.includes("tours-a-machu-picchu")).slice(0, 6),
      emptyText: "Aún no tenemos paquetes en esta categoría.",
    },
    {
      key: "multidestino",
      label: "Multidestino",
      tours: allTours
        .filter((t) => t.destinationSlugs.length > 1 || (t.destinationSlugs.length === 0 && (t.durationDays ?? 0) > 1))
        .sort((a, b) => (b.durationDays ?? 0) - (a.durationDays ?? 0))
        .slice(0, 6),
      emptyText: "Aún no tenemos paquetes en esta categoría.",
    },
  ];

  return (
    <>
      <JsonLd data={organizationJsonLd()} />
      <Hero image={media.heroImage} />
      <div className="pwt-container">
        <SearchBar options={searchOptions} />
      </div>
      <DestinationsSection destinations={destinations} />
      <FeaturedTours groups={groups} totalTours={allTours.length} />
      <WhyUsSection tourCount={allTours.length} destinationCount={destinations.length} />
      <TestimonialsPlaceholder />
      <TrustSection />
      <FinalCta />
    </>
  );
}
