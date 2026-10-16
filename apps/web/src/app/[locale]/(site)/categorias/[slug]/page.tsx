import type { Metadata } from "next";
import { notFound, permanentRedirect } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { LocaleAlternates } from "@/components/layout/LanguageSwitcher";
import { CollectionPage } from "@/components/tours/CollectionPage";
import { localePath, toursSearchPath } from "@/i18n/paths";
import { routing, type Locale } from "@/i18n/routing";
import { getCategories, getCategory, getToursBySlugs } from "@/lib/catalog";
import { pageMetadata } from "@/lib/seo/metadata";

// Slugs nuevos publicados en la API se generan bajo demanda (ISR); los desconocidos dan 404.
export const dynamicParams = true;
export const revalidate = 3600;

export async function generateStaticParams() {
  const all = await Promise.all(routing.locales.map(async (locale) => (await getCategories(locale)).map((c) => ({ locale, slug: c.slug }))));
  return all.flat();
}

export async function generateMetadata({ params }: PageProps<"/[locale]/categorias/[slug]">): Promise<Metadata> {
  const { slug, locale: raw } = await params;
  const locale = raw as Locale;
  const category = await getCategory(decodeURIComponent(slug), locale);
  if (!category) return {};
  const t = await getTranslations({ locale, namespace: "collection" });
  return pageMetadata({
    locale,
    title: category.name,
    // PENDIENTE(contenido): varias categorías no tienen descripción en el sitio viejo.
    description: category.description ?? t("categoryDescription", { name: category.name }),
    paths: category.alternates,
    image: category.bannerImage?.src,
    // Sin traducción propia se muestra el texto en español: noindex para no duplicar el original.
    index: !category.fallback,
  });
}

export default async function CategoryPage({ params }: PageProps<"/[locale]/categorias/[slug]">) {
  const { slug: rawSlug, locale: raw } = await params;
  const locale = raw as Locale;
  setRequestLocale(locale);
  const slug = decodeURIComponent(rawSlug);
  const category = await getCategory(slug, locale);
  if (!category) notFound();
  if (category.slug !== slug) permanentRedirect(category.path);
  const [tours, t, tc] = await Promise.all([getToursBySlugs(category.tourSlugs, locale), getTranslations("collection"), getTranslations("common")]);
  return (
    <>
      <LocaleAlternates value={category.alternates} />
      <CollectionPage
        eyebrow={t("categoryEyebrow")}
        title={category.name}
        description={category.description}
        banner={category.bannerImage}
        tours={tours}
        fallback={category.fallback}
        filterHref={toursSearchPath(locale, { categoria: category.key })}
        allToursHref={localePath(locale, "/tours")}
        crumbs={[
          { name: tc("home"), path: localePath(locale, "/") },
          { name: tc("tours"), path: localePath(locale, "/tours") },
          { name: category.name, path: category.path },
        ]}
      />
    </>
  );
}
