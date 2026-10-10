import type { Metadata } from "next";
import { notFound, permanentRedirect } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { LocaleAlternates } from "@/components/layout/LanguageSwitcher";
import { CollectionPage } from "@/components/tours/CollectionPage";
import { localePath, toursSearchPath } from "@/i18n/paths";
import { routing, type Locale } from "@/i18n/routing";
import { getDestination, getDestinations, getToursBySlugs } from "@/lib/catalog";
import { pageMetadata } from "@/lib/seo/metadata";

// Slugs nuevos publicados en la API se generan bajo demanda (ISR); los desconocidos dan 404.
export const dynamicParams = true;
export const revalidate = 3600;

export async function generateStaticParams() {
  const all = await Promise.all(routing.locales.map(async (locale) => (await getDestinations(locale)).map((d) => ({ locale, slug: d.slug }))));
  return all.flat();
}

export async function generateMetadata({ params }: PageProps<"/[locale]/destinos/[slug]">): Promise<Metadata> {
  const { slug, locale: raw } = await params;
  const locale = raw as Locale;
  const destination = await getDestination(decodeURIComponent(slug), locale);
  if (!destination) return {};
  const t = await getTranslations({ locale, namespace: "collection" });
  return pageMetadata({
    locale,
    title: t("destinationTitle", { name: destination.name }),
    description: destination.description ?? t("destinationDescription", { name: destination.name }),
    paths: destination.alternates,
    image: destination.bannerImage?.src,
  });
}

export default async function DestinationPage({ params }: PageProps<"/[locale]/destinos/[slug]">) {
  const { slug: rawSlug, locale: raw } = await params;
  const locale = raw as Locale;
  setRequestLocale(locale);
  const slug = decodeURIComponent(rawSlug);
  const destination = await getDestination(slug, locale);
  if (!destination) notFound();
  // Slug de otro idioma o la clave en español: se redirige a la URL canónica de este idioma.
  if (destination.slug !== slug) permanentRedirect(destination.path);
  const [tours, t, tc] = await Promise.all([
    getToursBySlugs(destination.tourSlugs, locale),
    getTranslations("collection"),
    getTranslations("common"),
  ]);
  return (
    <>
      <LocaleAlternates value={destination.alternates} />
      <CollectionPage
        eyebrow={t("destinationEyebrow")}
        title={destination.name}
        description={destination.description}
        banner={destination.bannerImage}
        tours={tours}
        fallback={destination.fallback}
        filterHref={toursSearchPath(locale, { destino: destination.key })}
        allToursHref={localePath(locale, "/tours")}
        crumbs={[
          { name: tc("home"), path: localePath(locale, "/") },
          { name: tc("destinations"), path: localePath(locale, "/destinos") },
          { name: destination.name, path: destination.path },
        ]}
      />
    </>
  );
}
