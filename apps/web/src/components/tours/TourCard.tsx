import { CalendarDays, MapPin, Users } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { getTranslations } from "next-intl/server";

import type { TourSummary } from "@/lib/catalog/types";
import { durationText } from "@/lib/i18n/units";
import { CompareToggle } from "@/components/compare/CompareToggle";
import { FavoriteButton } from "@/components/wishlist/FavoriteButton";
import { PriceTag } from "./PriceTag";

interface TourCardProps {
  tour: TourSummary;
  headingLevel?: "h2" | "h3";
  sizes?: string;
  /** Oculta "Comparar" (p. ej. en el propio comparador). */
  showCompare?: boolean;
}

/**
 * Tarjeta de producto (MASTER §7). Toda la tarjeta es clicable vía ::after del enlace del título.
 * Favoritos, comparador y carrito usan `tour.key` (slug en español): no cambian con el idioma.
 */
export async function TourCard({
  tour,
  headingLevel = "h3",
  sizes = "(min-width: 1024px) 400px, (min-width: 768px) 50vw, 100vw",
  showCompare = true,
}: TourCardProps) {
  const [t, tu, tc] = await Promise.all([getTranslations("tourCard"), getTranslations("units"), getTranslations("common")]);
  const Heading = headingLevel;
  const places = tour.destinationNames.length ? tour.destinationNames.join(", ") : tc("severalDestinations");
  return (
    <article
      lang={tour.fallback ? "es-PE" : undefined}
      className="group relative flex h-full flex-col overflow-hidden rounded-lg border border-border bg-surface shadow-sm transition-shadow duration-300 hover:shadow-lg has-[a:focus-visible]:outline-2 has-[a:focus-visible]:outline-offset-2 has-[a:focus-visible]:outline-ring"
    >
      <div className="relative aspect-[4/3] overflow-hidden bg-surface-muted">
        {tour.image ? (
          <Image
            src={tour.image.src}
            alt={tour.image.alt}
            fill
            sizes={sizes}
            className="object-cover transition-transform duration-[900ms] ease-out group-hover:scale-[1.04]"
          />
        ) : null}
        {tour.durationDays && tour.durationDays > 1 ? (
          <span className="absolute top-3 left-3 rounded-pill bg-surface/95 px-3 py-1 text-xs font-medium text-foreground shadow-xs">
            {t("package", { duration: tour.durationLabel })}
          </span>
        ) : null}
        {/* z-[2]: por encima del ::after del enlace que cubre la tarjeta. */}
        <div className="absolute top-3 right-3 z-[2]">
          <FavoriteButton slug={tour.key} title={tour.shortTitle} destinationSlugs={tour.destinationSlugs} />
        </div>
      </div>
      <div className="flex flex-1 flex-col gap-3 p-5">
        <Heading className="text-h4 font-medium text-foreground">
          <Link href={tour.path} className="pwt-card-link line-clamp-2 focus-visible:outline-none">
            {tour.shortTitle}
          </Link>
        </Heading>
        <ul className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-foreground-muted">
          <li className="inline-flex items-center gap-1.5">
            <CalendarDays aria-hidden size={16} strokeWidth={1.5} />
            {durationText(tu, tour.durationDays, tour.durationNights)}
          </li>
          <li className="inline-flex items-center gap-1.5">
            <MapPin aria-hidden size={16} strokeWidth={1.5} />
            {places}
          </li>
          <li className="inline-flex items-center gap-1.5">
            <Users aria-hidden size={16} strokeWidth={1.5} />
            {t("minPax", { count: tour.minPax })}
          </li>
        </ul>
        <p className="line-clamp-2 text-sm text-foreground-muted">{tour.excerpt}</p>
        {tour.fallback ? (
          <p lang="en-US" className="text-xs text-foreground-muted italic">
            {tc("fallbackNotice")}
          </p>
        ) : null}
        <div className="mt-auto flex items-end justify-between gap-3 border-t border-border pt-3">
          <PriceTag pricing={tour.pricing} policy={tour.paymentPolicy} />
          {showCompare ? <CompareToggle slug={tour.key} title={tour.shortTitle} className="shrink-0" /> : null}
        </div>
      </div>
    </article>
  );
}
