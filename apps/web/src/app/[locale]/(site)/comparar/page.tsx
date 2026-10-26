import { Check, X } from "lucide-react";
import type { Metadata } from "next";
import Image from "next/image";
import Link from "@/components/ui/IntentLink";
import { getTranslations, setRequestLocale } from "next-intl/server";
import type { ReactNode } from "react";

import { CompareFromStore, CompareRemoveButton } from "@/components/compare/CompareControls";
import { COMPARE_PARAM } from "@/components/compare/compare-href";
import { Breadcrumbs } from "@/components/layout/Breadcrumbs";
import { PriceTag } from "@/components/tours/PriceTag";
import { buttonClass } from "@/components/ui/button-styles";
import { FavoriteButton } from "@/components/wishlist/FavoriteButton";
import { localePath } from "@/i18n/paths";
import type { Locale } from "@/i18n/routing";
import { getTour, type Tour } from "@/lib/catalog";
import { isDifficultyLevel } from "@/lib/catalog/difficulty";
import { durationText } from "@/lib/i18n/units";
import { alternatesFor, pageMetadata } from "@/lib/seo/metadata";
import { parseSharedSlugs } from "@/lib/wishlist/share";

export async function generateMetadata({ params }: PageProps<"/[locale]/comparar">): Promise<Metadata> {
  const locale = (await params).locale as Locale;
  const t = await getTranslations({ locale, namespace: "comparePage" });
  return pageMetadata({ locale, title: t("title"), description: t("description"), paths: alternatesFor("/comparar"), index: false });
}

/** Muestra hasta este número de ítems de "incluye"; el resto, con un enlace a la ficha. */
const LIST_LIMIT = 8;

function ItemList({ items, icon, empty, more }: { items: string[]; icon: "check" | "x"; empty: string; more: (count: number) => string }) {
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
      {items.length > LIST_LIMIT ? <li className="text-foreground-muted">{more(items.length - LIST_LIMIT)}</li> : null}
    </ul>
  );
}

/**
 * Comparador (HU-B.A8). La selección viaja en la URL (`?tours=a,b,c`, claves de tour): compartible y
 * sin datos personales. SSR para leer el catálogo actualizado (precios desde, incluye).
 * TODO(HU-B.A1/A3): filas de altitud, esfuerzo, cancelación y salidas cuando existan esos datos.
 */
export default async function ComparePage({ params, searchParams }: PageProps<"/[locale]/comparar">) {
  const locale = (await params).locale as Locale;
  setRequestLocale(locale);
  const query = await searchParams;
  const raw = query[COMPARE_PARAM];
  const slugs = parseSharedSlugs(Array.isArray(raw) ? raw[0] : raw).slice(0, 3);
  const [found, t, tu, tc] = await Promise.all([
    Promise.all(slugs.map(async (slug) => ({ slug, tour: await getTour(slug, locale) }))),
    getTranslations("comparePage"),
    getTranslations("units"),
    getTranslations("common"),
  ]);
  const tours = found.filter((f): f is { slug: string; tour: Tour } => f.tour !== null);
  const missing = found.filter((f) => f.tour === null).map((f) => f.slug);
  const pending = t("pending");
  const more = (count: number) => t("more", { count });
  const toursHref = localePath(locale, "/tours");

  const rows: { label: string; render: (tour: Tour) => ReactNode }[] = [
    { label: t("rows.price"), render: (tour) => <PriceTag pricing={tour.pricing} policy={tour.paymentPolicy} /> },
    { label: t("rows.duration"), render: (tour) => durationText(tu, tour.durationDays, tour.durationNights) },
    { label: t("rows.destinations"), render: (tour) => (tour.destinationNames.length ? tour.destinationNames.join(", ") : tc("severalDestinations")) },
    { label: t("rows.difficulty"), render: (tour) => (isDifficultyLevel(tour.difficulty) ? tc(`difficultyLevels.${tour.difficulty}`) : (tour.difficulty ?? pending)) },
    { label: t("rows.minPax"), render: (tour) => tour.minPax },
    { label: t("rows.includes"), render: (tour) => <ItemList items={tour.includes} icon="check" empty={pending} more={more} /> },
    { label: t("rows.notIncludes"), render: (tour) => <ItemList items={tour.notIncludes} icon="x" empty={pending} more={more} /> },
  ];

  return (
    <div className="pwt-container pt-8 pb-20">
      <Breadcrumbs
        items={[
          { name: tc("home"), path: localePath(locale, "/") },
          { name: tc("tours"), path: toursHref },
          { name: t("title"), path: localePath(locale, "/comparar") },
        ]}
      />
      <h1 className="mt-4 font-display text-h1 font-medium">{t("title")}</h1>
      <CompareFromStore hasSelection={slugs.length > 0} />

      {missing.length ? (
        <p className="mt-6 rounded-md bg-warning-soft p-4 text-sm text-warning" role="status">
          {t("missing", { count: missing.length })}
        </p>
      ) : null}

      {tours.length === 0 ? (
        <div className="mt-8 rounded-lg border border-dashed border-border-strong p-8">
          <h2 className="text-h3 font-medium">{t("emptyTitle")}</h2>
          <p className="mt-2 text-foreground-muted">{t("emptyText")}</p>
          <Link href={toursHref} className={buttonClass("secondary", "lg", "mt-6")}>
            {t("viewTours")}
          </Link>
        </div>
      ) : (
        <>
          {tours.length === 1 ? (
            <p className="mt-4 text-foreground-muted">
              {t("addAnother")}{" "}
              <Link href={toursHref} className="pwt-link">
                {t("viewTours")}
              </Link>
            </p>
          ) : null}
          {/* Región desplazable con teclado en móvil (tabIndex + etiqueta). */}
          <div className="mt-8 overflow-x-auto rounded-lg border border-border bg-surface" tabIndex={0} role="region" aria-label={t("tableLabel")}>
            <table className="w-full min-w-[720px] table-fixed border-collapse text-left text-sm">
              <caption className="sr-only">{t("caption", { titles: tours.map((f) => f.tour.shortTitle).join(", ") })}</caption>
              <thead>
                <tr>
                  <td className="w-40 border-b border-border p-4" />
                  {tours.map(({ tour }) => (
                    <th key={tour.key} scope="col" className="border-b border-l border-border p-4 align-top font-normal">
                      <div className="relative aspect-[4/3] w-full overflow-hidden rounded-md bg-surface-muted">
                        {tour.image ? <Image src={tour.image.src} alt="" fill sizes="320px" className="object-cover" /> : null}
                      </div>
                      <p lang={tour.fallback ? "es-PE" : undefined} className="mt-3 text-h4 font-medium">
                        <Link href={tour.path} className="hover:underline">
                          {tour.shortTitle}
                        </Link>
                      </p>
                      <div className="mt-3 flex flex-wrap gap-2">
                        <FavoriteButton slug={tour.key} title={tour.shortTitle} destinationSlugs={tour.destinationSlugs} />
                        <CompareRemoveButton slug={tour.key} title={tour.shortTitle} remaining={tours.map((f) => f.tour.key)} />
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
                      <td key={tour.key} className="border-l border-border p-4 align-top">
                        {row.render(tour)}
                      </td>
                    ))}
                  </tr>
                ))}
                <tr>
                  <th scope="row" className="p-4 align-top font-medium">
                    <span className="sr-only">{t("actions")}</span>
                  </th>
                  {tours.map(({ tour }) => (
                    <td key={tour.key} className="border-l border-border p-4">
                      <Link href={`${tour.path}#reservar`} className={buttonClass("secondary", "md", "w-full")}>
                        {t("seeDates")}
                      </Link>
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>
          <p className="mt-4 text-sm text-foreground-muted">{t("footnote")}</p>
        </>
      )}
    </div>
  );
}
