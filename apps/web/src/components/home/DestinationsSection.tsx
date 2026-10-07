import Image from "next/image";
import Link from "next/link";

import type { Destination } from "@/lib/catalog/types";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { DestinationRail } from "./DestinationRail";

export function DestinationCard({ destination, featured = false }: { destination: Destination; featured?: boolean }) {
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
            className="object-cover transition-[transform,filter] duration-[900ms] ease-out group-hover:scale-105 group-hover:brightness-[1.08]"
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
        <p className="text-sm text-hero-soft">
          {destination.tourCount} {destination.tourCount === 1 ? "tour" : "tours"}
        </p>
      </div>
    </article>
  );
}

export function DestinationsSection({ destinations }: { destinations: Destination[] }) {
  return (
    <section className="pwt-section" aria-labelledby="destinos-title">
      <div className="pwt-container">
        <SectionHeading
          id="destinos-title"
          title="Destinos que conocemos de memoria"
          link={{ href: "/es/destinos", label: "Ver todos los destinos" }}
        />
        <DestinationRail label="Destinos">
          {destinations.map((d, i) => (
            <li key={d.slug} className={`w-[82%] shrink-0 snap-start md:w-auto ${i === 0 ? "lg:row-span-2 xl:row-span-1" : ""}`}>
              <DestinationCard destination={d} featured={i === 0} />
            </li>
          ))}
        </DestinationRail>
      </div>
    </section>
  );
}
