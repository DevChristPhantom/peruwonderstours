import { Check, X } from "lucide-react";
import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";

import { CompareFromStore, CompareRemoveButton } from "@/components/compare/CompareControls";
import { COMPARE_PARAM } from "@/components/compare/compare-href";
import { Breadcrumbs } from "@/components/layout/Breadcrumbs";
import { PriceTag } from "@/components/tours/PriceTag";
import { buttonClass } from "@/components/ui/button-styles";
import { FavoriteButton } from "@/components/wishlist/FavoriteButton";
import { getTour, type Tour } from "@/lib/catalog";
import { formatDuration } from "@/lib/catalog/rules";
import { parseSharedSlugs } from "@/lib/wishlist/share";

export const metadata: Metadata = {
  title: "Comparar tours",
  description: "Compara hasta 3 tours lado a lado: duración, destinos, dificultad, qué incluye y precio desde.",
  alternates: { canonical: "/es/comparar" },
  robots: { index: false, follow: true },
};

/** Muestra hasta este número de ítems de "incluye"; el resto, con un enlace a la ficha. */
const LIST_LIMIT = 8;

function ItemList({ items, icon, empty }: { items: string[]; icon: "check" | "x"; empty: string }) {
  if (!items.length) return <p className="text-foreground-muted">{empty}</p>;
  const shown = items.slice(0, LIST_LIMIT);
  return (
    <ul className="space-y-1.5">
      {shown.map((item) => (
        <li key={item} className="flex gap-2">
          {icon === "check" ? (
            <Check aria-hidden size={16} strokeWidth={1.5} className="mt-1 shrink-0 text-success" />
          ) : (
            <X aria-hidden size={16} strokeWidth={1.5} className="mt-1 shrink-0 text-foreground-muted" />
          )}
          <span>{item}</span>
        </li>
      ))}
      {items.length > LIST_LIMIT ? <li className="text-foreground-muted">y {items.length - LIST_LIMIT} más</li> : null}
    </ul>
  );
}

/**
 * Comparador (HU-B.A8). La selección viaja en la URL (`?tours=a,b,c`): compartible y sin datos
 * personales. SSR para leer el catálogo actualizado (precios desde, incluye).
 * TODO(HU-B.A1/A3): filas de altitud, esfuerzo, cancelación y salidas cuando existan esos datos.
 */
export default async function ComparePage({ searchParams }: PageProps<"/es/comparar">) {
  const params = await searchParams;
  const raw = params[COMPARE_PARAM];
  const slugs = parseSharedSlugs(Array.isArray(raw) ? raw[0] : raw).slice(0, 3);
  const found = await Promise.all(slugs.map(async (slug) => ({ slug, tour: await getTour(slug) })));
  const tours = found.filter((f): f is { slug: string; tour: Tour } => f.tour !== null);
  const missing = found.filter((f) => f.tour === null).map((f) => f.slug);

  const rows: { label: string; render: (t: Tour) => ReactNode }[] = [
    { label: "Precio desde", render: (t) => <PriceTag pricing={t.pricing} policy={t.paymentPolicy} /> },
    { label: "Duración", render: (t) => formatDuration(t.durationDays, t.durationNights) },
    { label: "Destinos", render: (t) => (t.destinationNames.length ? t.destinationNames.join(", ") : "Varios destinos") },
    { label: "Dificultad", render: (t) => t.difficulty ?? "Por confirmar" },
    { label: "Mínimo de viajeros", render: (t) => t.minPax },
    { label: "Incluye", render: (t) => <ItemList items={t.includes} icon="check" empty="Por confirmar" /> },
    { label: "No incluye", render: (t) => <ItemList items={t.notIncludes} icon="x" empty="Por confirmar" /> },
  ];

  return (
    <div className="pwt-container pt-8 pb-20">
      <Breadcrumbs
        items={[
          { name: "Inicio", path: "/es" },
          { name: "Tours", path: "/es/tours" },
          { name: "Comparar", path: "/es/comparar" },
        ]}
      />
      <h1 className="mt-4 font-display text-h1 font-medium">Comparar tours</h1>
      <CompareFromStore hasSelection={slugs.length > 0} />

      {missing.length ? (
        <p className="mt-6 rounded-md bg-warning-soft p-4 text-sm text-warning" role="status">
          {missing.length === 1 ? "Un tour de esta comparación ya no está disponible." : `${missing.length} tours de esta comparación ya no están disponibles.`}
        </p>
      ) : null}

      {tours.length === 0 ? (
        <div className="mt-8 rounded-lg border border-dashed border-border-strong p-8">
          <h2 className="text-h3 font-medium">Elige 2 o 3 tours para comparar</h2>
          <p className="mt-2 text-foreground-muted">Marca “Comparar” en las tarjetas de los tours que te interesen.</p>
          <Link href="/es/tours" className={buttonClass("secondary", "lg", "mt-6")}>
            Ver tours
          </Link>
        </div>
      ) : (
        <>
          {tours.length === 1 ? (
            <p className="mt-4 text-foreground-muted">
              Agrega al menos otro tour para comparar.{" "}
              <Link href="/es/tours" className="pwt-link">
                Ver tours
              </Link>
            </p>
          ) : null}
          {/* Región desplazable con teclado en móvil (tabIndex + etiqueta). */}
          <div
            className="mt-8 overflow-x-auto rounded-lg border border-border bg-surface"
            tabIndex={0}
            role="region"
            aria-label="Tabla comparativa, desplázate horizontalmente para ver todos los tours"
          >
            <table className="w-full min-w-[720px] table-fixed border-collapse text-left text-sm">
              <caption className="sr-only">Comparación de {tours.map((t) => t.tour.shortTitle).join(", ")}</caption>
              <thead>
                <tr>
                  <td className="w-40 border-b border-border p-4" />
                  {tours.map(({ tour }) => (
                    <th key={tour.slug} scope="col" className="border-b border-l border-border p-4 align-top font-normal">
                      <div className="relative aspect-[4/3] w-full overflow-hidden rounded-md bg-surface-muted">
                        {tour.image ? <Image src={tour.image.src} alt="" fill sizes="320px" className="object-cover" /> : null}
                      </div>
                      <p className="mt-3 text-h4 font-medium">
                        <Link href={tour.path} className="hover:underline">
                          {tour.shortTitle}
                        </Link>
                      </p>
                      <div className="mt-3 flex flex-wrap gap-2">
                        <FavoriteButton slug={tour.slug} title={tour.shortTitle} destinationSlugs={tour.destinationSlugs} />
                        <CompareRemoveButton slug={tour.slug} title={tour.shortTitle} remaining={tours.map((t) => t.slug)} />
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((row, i) => (
                  <tr key={row.label} className={i % 2 ? "bg-surface-muted" : undefined}>
                    <th scope="row" className="p-4 align-top font-medium">
                      {row.label}
                    </th>
                    {tours.map(({ tour }) => (
                      <td key={tour.slug} className="border-l border-border p-4 align-top">
                        {row.render(tour)}
                      </td>
                    ))}
                  </tr>
                ))}
                <tr>
                  <th scope="row" className="p-4 align-top font-medium">
                    <span className="sr-only">Acciones</span>
                  </th>
                  {tours.map(({ tour }) => (
                    <td key={tour.slug} className="border-l border-border p-4">
                      <Link href={`${tour.path}#reservar`} className={buttonClass("secondary", "md", "w-full")}>
                        Ver fechas
                      </Link>
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>
          <p className="mt-4 text-sm text-foreground-muted">
            Altitud, esfuerzo, política de cancelación y salidas se agregarán a la comparación cuando estén publicados
            para cada tour.
          </p>
        </>
      )}
    </div>
  );
}
