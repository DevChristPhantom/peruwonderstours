import { getTranslations } from "next-intl/server";

import { FiltersSkeleton, TourCardSkeleton } from "@/components/tours/TourCardSkeleton";

/**
 * Esqueleto del listado (/tours se arma por petición). Solo aquí: en las fichas `[slug]` un loading.tsx
 * haría que `notFound()` y `permanentRedirect()` respondan 200 al haberse enviado ya la página.
 */
export default async function ToursLoading() {
  const t = await getTranslations("explorer");
  return (
    <div className="pwt-container pt-8 pb-20" aria-busy="true">
      <p role="status" className="sr-only">
        {t("loading")}
      </p>
      <div aria-hidden="true" className="h-4 w-40 animate-pulse rounded-md bg-surface-muted motion-reduce:animate-none" />
      <h1 className="mt-4 mb-8 font-display text-h1 font-medium">{t("title")}</h1>
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-[280px_minmax(0,1fr)]">
        <FiltersSkeleton />
        <div>
          <div aria-hidden="true" className="mb-4 h-5 w-32 animate-pulse rounded-md bg-surface-muted motion-reduce:animate-none" />
          <ul aria-hidden="true" className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
            {Array.from({ length: 6 }, (_, i) => (
              <li key={i}>
                <TourCardSkeleton />
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
