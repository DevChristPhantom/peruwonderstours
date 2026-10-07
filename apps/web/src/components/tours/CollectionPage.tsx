import { ArrowRight } from "lucide-react";
import Image from "next/image";
import Link from "next/link";

import type { CatalogImage, TourSummary } from "@/lib/catalog/types";
import { Breadcrumbs } from "@/components/layout/Breadcrumbs";
import type { Crumb } from "@/lib/seo/json-ld";
import { itemListJsonLd, JsonLd } from "@/lib/seo/json-ld";
import { TourCard } from "./TourCard";

interface CollectionPageProps {
  eyebrow: string;
  title: string;
  description: string | null;
  banner: CatalogImage | null;
  tours: TourSummary[];
  crumbs: Crumb[];
  filterHref: string;
}

/** Página de destino o categoría (HU-1.4): banner, descripción y tours. */
export function CollectionPage({ eyebrow, title, description, banner, tours, crumbs, filterHref }: CollectionPageProps) {
  return (
    <>
      <JsonLd data={itemListJsonLd(title, tours)} />
      <section className="relative isolate overflow-hidden bg-hero-ink text-white">
        {banner ? (
          <Image src={banner.src} alt={banner.alt} fill preload sizes="100vw" className="-z-20 object-cover" />
        ) : null}
        <div className="absolute inset-0 -z-10 bg-[linear-gradient(to_top,rgba(6,9,11,.85),rgba(6,9,11,.35)_60%,rgba(6,9,11,.5))]" aria-hidden="true" />
        <div className="pwt-container flex min-h-[340px] flex-col justify-end pt-24 pb-10 md:min-h-[420px]">
          <p className="text-label font-medium tracking-[0.08em] text-hero-soft uppercase">{eyebrow}</p>
          <h1 className="mt-2 font-display text-display-xl font-normal">{title}</h1>
          <p className="mt-2 text-hero-soft">
            {tours.length} {tours.length === 1 ? "tour disponible" : "tours disponibles"}
          </p>
        </div>
      </section>
      <div className="pwt-container pt-6 pb-20">
        <Breadcrumbs items={crumbs} />
        {description ? <p className="mt-6 max-w-3xl text-body-lg text-foreground-muted">{description}</p> : null}
        <div className="mt-8 mb-6 flex items-center justify-between gap-4">
          <h2 className="text-h3 font-medium">Tours</h2>
          <Link href={filterHref} className="pwt-link inline-flex min-h-11 items-center gap-1.5">
            Filtrar por duración
            <ArrowRight aria-hidden size={16} strokeWidth={1.5} />
          </Link>
        </div>
        {tours.length ? (
          <ul className="grid gap-6 md:grid-cols-2 lg:grid-cols-3" data-reveal-stagger>
            {tours.map((t) => (
              <li key={t.slug}>
                <TourCard tour={t} />
              </li>
            ))}
          </ul>
        ) : (
          <p className="rounded-lg border border-dashed border-border-strong p-6 text-foreground-muted">
            Aún no hay tours publicados aquí.{" "}
            <Link href="/es/tours" className="pwt-link">
              Ver todos los tours
            </Link>
          </p>
        )}
      </div>
    </>
  );
}
