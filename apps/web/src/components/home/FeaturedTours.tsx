import { getTranslations } from "next-intl/server";

import type { TourSummary } from "@/lib/catalog/types";
import { TourCard } from "@/components/tours/TourCard";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { Tabs } from "@/components/ui/Tabs";
import { Link } from "@/i18n/navigation";
import { localePath } from "@/i18n/paths";
import type { Locale } from "@/i18n/routing";
import s from './EditorialMotion.module.css';

export interface FeaturedGroup {
  key: string;
  label: string;
  tours: TourSummary[];
  emptyText: string;
}

async function Grid({ group }: { group: FeaturedGroup }) {
  const t = await getTranslations("home.featured");
  if (!group.tours.length) {
    return (
      <p className="rounded-lg border border-dashed border-border-strong p-6 text-foreground-muted">
        {group.emptyText}{" "}
        <Link href={{ pathname: "/categorias/[slug]", params: { slug: "full-days" } }} className="pwt-link">
          {t("oneDayLink")}
        </Link>
      </p>
    );
  }
  return (
    <ul className={`${s.tourGrid} grid gap-6 md:grid-cols-2 lg:grid-cols-3`} data-reveal-stagger>
      {group.tours.map((tour) => (
        <li key={tour.key}>
          <TourCard tour={tour} />
        </li>
      ))}
    </ul>
  );
}

export async function FeaturedTours({ groups, totalTours, locale }: { groups: FeaturedGroup[]; totalTours: number; locale: Locale }) {
  const t = await getTranslations("home.featured");
  return (
    <section className="pwt-section" aria-labelledby="paquetes-title">
      <div className="pwt-container">
        <SectionHeading
          id="paquetes-title"
          title={t("title")}
          eyebrow={t("eyebrow")}
          description={t("intro")}
          link={{ href: localePath(locale, "/tours"), label: t("viewAll", { count: totalTours }) }}
        />
        <Tabs wrap label={t("tabsLabel")} items={groups.map((g) => ({ key: g.key, label: g.label, content: <Grid group={g} /> }))} />
      </div>
    </section>
  );
}
