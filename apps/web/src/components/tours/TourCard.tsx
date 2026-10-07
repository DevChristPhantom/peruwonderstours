import { CalendarDays, MapPin, Users } from "lucide-react";
import Image from "next/image";
import Link from "next/link";

import type { TourSummary } from "@/lib/catalog/types";
import { formatDuration } from "@/lib/catalog/rules";
import { PriceTag } from "./PriceTag";

interface TourCardProps {
  tour: TourSummary;
  headingLevel?: "h2" | "h3";
  sizes?: string;
}

/** Tarjeta de producto (MASTER §7). Toda la tarjeta es clicable vía ::after del enlace del título. */
export function TourCard({ tour, headingLevel = "h3", sizes = "(min-width: 1024px) 400px, (min-width: 768px) 50vw, 100vw" }: TourCardProps) {
  const Heading = headingLevel;
  const places = tour.destinationNames.length ? tour.destinationNames.join(", ") : "Varios destinos";
  return (
    <article className="group relative flex h-full flex-col overflow-hidden rounded-lg border border-border bg-surface shadow-sm transition-shadow duration-300 hover:shadow-lg has-[a:focus-visible]:outline-2 has-[a:focus-visible]:outline-offset-2 has-[a:focus-visible]:outline-ring">
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
            Paquete · {tour.durationLabel}
          </span>
        ) : null}
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
            {formatDuration(tour.durationDays, tour.durationNights)}
          </li>
          <li className="inline-flex items-center gap-1.5">
            <MapPin aria-hidden size={16} strokeWidth={1.5} />
            {places}
          </li>
          <li className="inline-flex items-center gap-1.5">
            <Users aria-hidden size={16} strokeWidth={1.5} />
            Mín. {tour.minPax}
          </li>
        </ul>
        <p className="line-clamp-2 text-sm text-foreground-muted">{tour.excerpt}</p>
        <div className="mt-auto border-t border-border pt-3">
          <PriceTag pricing={tour.pricing} policy={tour.paymentPolicy} />
        </div>
      </div>
    </article>
  );
}
