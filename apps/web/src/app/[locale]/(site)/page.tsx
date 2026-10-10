import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { ComplaintsBookNotice } from "@/components/complaints/ComplaintsBookNotice";
import { DestinationsSection } from "@/components/home/DestinationsSection";
import { FeaturedTours, type FeaturedGroup } from "@/components/home/FeaturedTours";
import { Hero } from "@/components/home/Hero";
import { FinalCta, TestimonialsSection, WhyUsSection } from "@/components/home/HomeSections";
import { SearchBar } from "@/components/search/SearchBar";
import type { Locale } from "@/i18n/routing";
import { getAllTours, getDestinations, getFeaturedTours, getNavMedia, getSearchOptions } from "@/lib/catalog";
import { getTestimonials } from "@/lib/content/testimonials";
import { JsonLd, organizationJsonLd } from "@/lib/seo/json-ld";
import { alternatesFor, pageMetadata } from "@/lib/seo/metadata";
import { SITE } from "@/lib/site";

export async function generateMetadata({ params }: PageProps<"/[locale]">): Promise<Metadata> {
  const locale = (await params).locale as Locale;
  const [t, ts] = await Promise.all([getTranslations({ locale, namespace: "home" }), getTranslations({ locale, namespace: "site" })]);
  const title = `${SITE.name} · ${t("metaTitle")}`;
  return { ...pageMetadata({ locale, title, description: ts("description"), paths: alternatesFor("/") }), title: { absolute: title } };
}

export default async function HomePage({ params }: PageProps<"/[locale]">) {
  const locale = (await params).locale as Locale;
  setRequestLocale(locale);
  const [media, destinations, allTours, featured, searchOptions, testimonials, t] = await Promise.all([
    getNavMedia(locale),
    getDestinations(locale),
    getAllTours(locale),
    getFeaturedTours(locale, 6),
    getSearchOptions(locale),
    getTestimonials(locale),
    getTranslations("home.featured"),
  ]);

  const groups: FeaturedGroup[] = [
    { key: "todos", label: t("groups.all"), tours: featured, emptyText: t("emptyFeatured") },
    {
      key: "altiplano",
      label: t("groups.altiplano"),
      tours: allTours
        .filter((tour) => tour.destinationSlugs.includes("tours-en-puno") || tour.categorySlugs.includes("rutas-del-altiplano"))
        .slice(0, 6),
      emptyText: t("emptyGroup"),
    },
    {
      key: "machu-picchu",
      label: t("groups.machuPicchu"),
      tours: allTours.filter((tour) => tour.categorySlugs.includes("tours-a-machu-picchu")).slice(0, 6),
      emptyText: t("emptyGroup"),
    },
    {
      key: "multidestino",
      label: t("groups.multi"),
      tours: allTours
        .filter((tour) => tour.destinationSlugs.length > 1 || (tour.destinationSlugs.length === 0 && (tour.durationDays ?? 0) > 1))
        .sort((a, b) => (b.durationDays ?? 0) - (a.durationDays ?? 0))
        .slice(0, 6),
      emptyText: t("emptyGroup"),
    },
  ];

  return (
    <>
      <JsonLd data={organizationJsonLd()} />
      <Hero image={media.heroImage} />
      <div className="pwt-container">
        <SearchBar options={searchOptions} />
      </div>
      <ComplaintsBookNotice />
      <DestinationsSection destinations={destinations} locale={locale} />
      <FeaturedTours groups={groups} totalTours={allTours.length} locale={locale} />
      <WhyUsSection tourCount={allTours.length} destinationCount={destinations.length} />
      <TestimonialsSection testimonials={testimonials} locale={locale} />
      <FinalCta />
    </>
  );
}
