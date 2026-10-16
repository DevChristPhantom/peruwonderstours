import type { Metadata } from "next";
import Link from "next/link";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { Breadcrumbs } from "@/components/layout/Breadcrumbs";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { buttonClass } from "@/components/ui/button-styles";
import { localePath } from "@/i18n/paths";
import type { Locale } from "@/i18n/routing";
import { getDestinations } from "@/lib/catalog";
import { alternatesFor, pageMetadata } from "@/lib/seo/metadata";
import { SITE } from "@/lib/site";

export async function generateMetadata({ params }: PageProps<"/[locale]/nosotros">): Promise<Metadata> {
  const locale = (await params).locale as Locale;
  const t = await getTranslations({ locale, namespace: "about" });
  return pageMetadata({ locale, title: t("title"), description: t("description", { name: SITE.name }), paths: alternatesFor("/nosotros") });
}

export default async function AboutPage({ params }: PageProps<"/[locale]/nosotros">) {
  const locale = (await params).locale as Locale;
  setRequestLocale(locale);
  const [t, tc, destinations] = await Promise.all([getTranslations("about"), getTranslations("common"), getDestinations(locale)]);
  const steps = [
    { key: "explore", path: "/tours" },
    { key: "compare", path: "/comparar" },
    { key: "consult", path: "/contactenos" },
  ] as const;
  return (
    <div className="pwt-container py-8 md:py-12">
      <Breadcrumbs items={[
        { name: tc("home"), path: localePath(locale, "/") },
        { name: t("title"), path: localePath(locale, "/nosotros") },
      ]} />
      <section className="mt-8" aria-labelledby="about-title">
        <SectionHeading id="about-title" as="h1" title={t("title")} eyebrow={SITE.name} description={t("body", { name: SITE.name })} />
      </section>
      <section className="mt-12 md:mt-16" aria-labelledby="about-destinations">
        <SectionHeading id="about-destinations" title={t("destinationsTitle")} description={t("destinationsDescription")} />
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3" data-reveal-stagger>
          {destinations.map((destination) => (
            <li key={destination.key} lang={destination.fallback ? "es-PE" : undefined}>
              <Link href={destination.path} className="block rounded-lg border border-border bg-surface p-6 hover:border-border-strong focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring">
                <h3 className="font-display text-h3 font-medium">{destination.name}</h3>
                <p className="mt-2 text-sm text-foreground-muted">{t("tourCount", { count: destination.tourCount })}</p>
                <span className="pwt-link mt-4 inline-flex min-h-11 items-center">{t("exploreDestination")}</span>
              </Link>
            </li>
          ))}
        </ul>
      </section>
      <section className="mt-12 md:mt-16" aria-labelledby="about-planning">
        <SectionHeading id="about-planning" title={t("planningTitle")} description={t("planningDescription")} />
        <ol className="grid gap-6 md:grid-cols-3" data-reveal-stagger>
          {steps.map(({ key, path }, index) => (
            <li key={key} className="rounded-lg border border-border bg-surface p-6">
              <span className="text-label font-medium text-foreground-muted" aria-hidden="true">0{index + 1}</span>
              <h3 className="mt-3 font-display text-h3 font-medium">{t(`steps.${key}.title`)}</h3>
              <p className="mt-3 text-foreground-muted">{t(`steps.${key}.body`)}</p>
              <Link href={localePath(locale, path)} className="pwt-link mt-4 inline-flex min-h-11 items-center">{t(`steps.${key}.link`)}</Link>
            </li>
          ))}
        </ol>
      </section>
      <section className="mt-12 rounded-lg border border-border bg-surface-muted p-6 md:mt-16 md:p-8" aria-labelledby="about-next" data-reveal>
        <h2 id="about-next" className="font-display text-h2 font-medium">{t("ctaTitle")}</h2>
        <p className="mt-3 max-w-2xl text-foreground-muted">{t("ctaBody")}</p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link href={localePath(locale, "/tours")} className={buttonClass("primary")}>{t("viewTours")}</Link>
          <Link href={localePath(locale, "/contactenos")} className={buttonClass("outline")}>{t("contact")}</Link>
        </div>
      </section>
    </div>
  );
}
