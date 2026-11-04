import clsx from "clsx";

const bone = "animate-pulse rounded-md bg-surface-muted motion-reduce:animate-none";

/** Silueta de `TourCard` (mismas proporciones) mientras llega el catálogo. Decorativa: aria-hidden. */
export function TourCardSkeleton() {
  return (
    <div aria-hidden="true" className="flex h-full flex-col overflow-hidden rounded-2xl border border-border bg-surface shadow-sm">
      <div className={clsx(bone, "aspect-[4/3] rounded-none")} />
      <div className="flex flex-1 flex-col gap-3 p-5">
        <div className={clsx(bone, "h-3 w-24")} />
        <div className={clsx(bone, "h-5 w-11/12")} />
        <div className={clsx(bone, "h-5 w-2/3")} />
        <div className="flex gap-4">
          <div className={clsx(bone, "h-4 w-14")} />
          <div className={clsx(bone, "h-4 w-24")} />
        </div>
        <div className={clsx(bone, "h-4 w-full")} />
        <div className="mt-auto flex items-end justify-between gap-3 border-t border-border pt-4">
          <div className="space-y-2">
            <div className={clsx(bone, "h-3 w-12")} />
            <div className={clsx(bone, "h-6 w-24")} />
          </div>
          <div className={clsx(bone, "h-11 w-28 rounded-pill")} />
        </div>
        <div className={clsx(bone, "mt-1 h-11 w-full rounded-lg")} />
      </div>
    </div>
  );
}

/** Columna de filtros de `TourExplorer` en silueta (solo escritorio, como la real). */
export function FiltersSkeleton() {
  return (
    <div aria-hidden="true" className="hidden space-y-6 lg:block">
      {[0, 1, 2, 3].map((i) => (
        <div key={i} className="space-y-2">
          <div className={clsx(bone, "h-4 w-20")} />
          <div className={clsx(bone, "h-12 w-full")} />
        </div>
      ))}
      <div className="flex flex-wrap gap-2">
        {[0, 1, 2].map((i) => (
          <div key={i} className={clsx(bone, "h-11 w-20 rounded-pill")} />
        ))}
      </div>
    </div>
  );
}
