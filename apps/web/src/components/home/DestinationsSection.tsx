import Image from "next/image";
import Link from "next/link";
import { getTranslations } from "next-intl/server";

import type { Destination } from "@/lib/catalog/types";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { localePath } from "@/i18n/paths";
import type { Locale } from "@/i18n/routing";
import { DestinationRail } from "./DestinationRail";

export async function DestinationCard({ destination, featured = false }: { destination: Destination; featured?: boolean }) {
  const t = await getTranslations("home.destinations");
  return (
    <article
      className={
        "group relative isolate flex aspect-[4/5] h-full items-end overflow-hidden rounded-lg bg-hero-ink p-5 text-white " +
        "has-[a:focus-visible]:outline-2 has-[a:focus-visible]:outline-offset-2 has-[a:focus-visible]:outline-ring " +
        (featured ? "lg:aspect-auto xl:aspect-[4/5]" : "")
      }
    >
      {destination.cardImage ? (
        <div className="absolute inset-0 -z-20" data-reveal-clip>
          <Image
            src={destination.cardImage.src}
            alt={destination.cardImage.alt}
            fill
            sizes="(min-width: 1440px) 280px, (min-width: 1024px) 33vw, (min-width: 768px) 50vw, 82vw"
            className="object-cover transition-transform duration-500 ease-out [@media(hover:hover)_and_(pointer:fine)_and_(prefers-reduced-motion:no-preference)]:group-hover:scale-[1.04] motion-reduce:transition-none"
          />
        </div>
      ) : null}
      <div className="absolute inset-0 -z-10 bg-[linear-gradient(to_top,rgba(6,9,11,.8),transparent_60%)]" aria-hidden="true" />
      <div>
        <h3 className="font-display text-h3 font-medium">
          <Link href={destination.path} className="pwt-card-link focus-visible:outline-none">
            {destination.name}
          </Link>
        </h3>
        <p className="text-sm text-hero-soft">{t("tourCount", { count: destination.tourCount })}</p>
      </div>
    </article>
  );
}

export async function DestinationsSection({ destinations, locale }: { destinations: Destination[]; locale: Locale }) {
  const t = await getTranslations("home.destinations");
  return (
    <section className="pwt-section" aria-labelledby="destinos-title">
      <div className="pwt-container">
        <SectionHeading id="destinos-title" title={t("title")} link={{ href: localePath(locale, "/destinos"), label: t("viewAll") }} />
        <DestinationRail label={t("railLabel")} previousLabel={t("previous")} nextLabel={t("next")}>
          {destinations.map((d, i) => (
            <li key={d.key} className={`w-[82%] shrink-0 snap-start md:w-auto ${i === 0 ? "lg:row-span-2 xl:row-span-1" : ""}`}>
              <DestinationCard destination={d} featured={i === 0} />
            </li>
          ))}
        </DestinationRail>
      </div>
    </section>
  );
}
