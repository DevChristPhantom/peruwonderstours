import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";

import styles from "@/components/home/DestinationCard.module.css";
import { DestinationCard } from "@/components/home/DestinationsSection";
import { Breadcrumbs } from "@/components/layout/Breadcrumbs";
import { localePath } from "@/i18n/paths";
import type { Locale } from "@/i18n/routing";
import { getDestinations } from "@/lib/catalog";
import { alternatesFor, pageMetadata } from "@/lib/seo/metadata";

export async function generateMetadata({ params }: PageProps<"/[locale]/destinos">): Promise<Metadata> {
  const locale = (await params).locale as Locale;
  const t = await getTranslations({ locale, namespace: "destinationsPage" });
  return pageMetadata({ locale, title: t("title"), description: t("description"), paths: alternatesFor("/destinos") });
}

export default async function DestinationsPage({ params }: PageProps<"/[locale]/destinos">) {
  const locale = (await params).locale as Locale;
  setRequestLocale(locale);
  const [destinations, t, tc] = await Promise.all([getDestinations(locale), getTranslations("destinationsPage"), getTranslations("common")]);
  return (
    <div className="pwt-container pt-8 pb-20">
      <Breadcrumbs
        items={[
          { name: tc("home"), path: localePath(locale, "/") },
          { name: t("title"), path: localePath(locale, "/destinos") },
        ]}
      />
      <h1 className="mt-4 mb-8 font-display text-h1 font-medium">{t("title")}</h1>
      <ul className={`${styles.rail} grid gap-6 sm:grid-cols-2 lg:grid-cols-3`} data-reveal-stagger>
        {destinations.map((d) => (
          <li key={d.key}>
            <DestinationCard destination={d} />
          </li>
        ))}
      </ul>
    </div>
  );
}
