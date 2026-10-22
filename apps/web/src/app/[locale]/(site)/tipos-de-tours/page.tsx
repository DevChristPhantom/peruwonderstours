import type { Metadata } from "next";
import Image from "next/image";
import Link from "@/components/ui/IntentLink";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { Breadcrumbs } from "@/components/layout/Breadcrumbs";
import { localePath } from "@/i18n/paths";
import type { Locale } from "@/i18n/routing";
import { getCategories } from "@/lib/catalog";
import { alternatesFor, pageMetadata } from "@/lib/seo/metadata";

export async function generateMetadata({ params }: PageProps<"/[locale]/tipos-de-tours">): Promise<Metadata> {
  const locale = (await params).locale as Locale;
  const t = await getTranslations({ locale, namespace: "tourTypes" });
  return pageMetadata({ locale, title: t("title"), description: t("description"), paths: alternatesFor("/tipos-de-tours") });
}

/** Tipos de tours (ruta heredada del sitio viejo): índice de categorías del catálogo. */
export default async function TourTypesPage({ params }: PageProps<"/[locale]/tipos-de-tours">) {
  const locale = (await params).locale as Locale;
  setRequestLocale(locale);
  const [categories, t, tc] = await Promise.all([getCategories(locale), getTranslations("tourTypes"), getTranslations("common")]);

  return (
    <div className="pwt-container pt-8 pb-20">
      <Breadcrumbs
        items={[
          { name: tc("home"), path: localePath(locale, "/") },
          { name: t("title"), path: localePath(locale, "/tipos-de-tours") },
        ]}
      />
      <h1 className="mt-4 font-display text-h1 font-medium">{t("title")}</h1>
      <p className="mt-3 max-w-2xl text-body-lg text-foreground-muted">{t("description")}</p>
      <ul className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3" data-reveal-stagger>
        {categories.map((category) => (
          <li key={category.key}>
            <article className="group relative h-full overflow-hidden rounded-lg border border-border bg-surface shadow-sm transition-shadow duration-300 hover:shadow-lg has-[a:focus-visible]:outline-2 has-[a:focus-visible]:outline-offset-2 has-[a:focus-visible]:outline-ring">
              <div className="relative aspect-[4/3] overflow-hidden bg-surface-muted">
                {category.bannerImage ? (
                  <Image
                    src={category.bannerImage.src}
                    alt={category.bannerImage.alt}
                    fill
                    sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
                    className="object-cover transition-transform duration-[900ms] ease-out group-hover:scale-[1.04] motion-reduce:transition-none"
                  />
                ) : null}
              </div>
              <div className="p-5">
                <h2 className="text-h4 font-medium">
                  <Link href={category.path} className="after:absolute after:inset-0 focus-visible:outline-none">
                    {category.name}
                  </Link>
                </h2>
                <p className="mt-1 text-sm text-foreground-muted">{t("count", { count: category.tourCount })}</p>
              </div>
            </article>
          </li>
        ))}
      </ul>
    </div>
  );
}
