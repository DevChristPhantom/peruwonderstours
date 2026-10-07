"use client";

import { SlidersHorizontal, X } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useId, useMemo, useState, type ReactNode } from "react";

import { DURATION_BUCKETS, isDurationBucket, matchesQuery } from "@/lib/catalog/rules";
import type { DurationBucket } from "@/lib/catalog/types";
import { formatDate } from "@/lib/format";
import { buttonClass } from "@/components/ui/button-styles";

export interface ExplorerTour {
  slug: string;
  destinationSlugs: string[];
  categorySlugs: string[];
  durationBucket: DurationBucket | null;
  searchText: string;
}

export interface FilterOption {
  value: string;
  label: string;
}

interface TourExplorerProps {
  tours: ExplorerTour[];
  /** Tarjetas renderizadas en el servidor, por slug. */
  cards: Record<string, ReactNode>;
  destinations: FilterOption[];
  categories: FilterOption[];
  /** Slugs sugeridos cuando no hay resultados. */
  suggestions: string[];
}

const selectCls =
  "mt-1 block min-h-12 w-full rounded-md border border-border-strong bg-surface px-3 text-body text-foreground";

/**
 * Listado con filtros (HU-1.1): destino, categoría, duración y texto. Los filtros viven en la URL
 * (compartible y rastreable). Filtrado en el cliente sobre el catálogo estático (41 tours).
 */
export function TourExplorer({ tours, cards, destinations, categories, suggestions }: TourExplorerProps) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const id = useId();
  const [filtersOpen, setFiltersOpen] = useState(false);

  const destination = params.get("destino") ?? "";
  const category = params.get("categoria") ?? "";
  const durationParam = params.get("duracion");
  const duration = isDurationBucket(durationParam) ? durationParam : "";
  const q = params.get("q") ?? "";
  const date = params.get("fecha");
  const adults = Number(params.get("adultos") ?? 0);

  const [qDraft, setQDraft] = useState(q);
  const [syncedQ, setSyncedQ] = useState(q);
  if (syncedQ !== q) {
    // La URL cambió desde fuera (header, buscador): sincroniza el campo.
    setSyncedQ(q);
    setQDraft(q);
  }

  const results = useMemo(
    () =>
      tours.filter(
        (t) =>
          (!destination || t.destinationSlugs.includes(destination)) &&
          (!category || t.categorySlugs.includes(category)) &&
          (!duration || t.durationBucket === duration) &&
          (!q || matchesQuery(t.searchText, q)),
      ),
    [tours, destination, category, duration, q],
  );

  const update = (key: string, value: string) => {
    const next = new URLSearchParams(params.toString());
    if (value) next.set(key, value);
    else next.delete(key);
    const qs = next.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  };

  const clearAll = () => {
    setQDraft("");
    const next = new URLSearchParams();
    for (const key of ["fecha", "adultos", "ninos", "bebes"]) {
      const v = params.get(key);
      if (v) next.set(key, v);
    }
    const qs = next.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  };

  const activeCount = [destination, category, duration, q].filter(Boolean).length;
  const validDate = date && /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : null;

  return (
    <div className="grid gap-8 lg:grid-cols-[280px_1fr]">
      <div>
        <button
          type="button"
          className={buttonClass("outline", "md", "w-full lg:hidden")}
          aria-expanded={filtersOpen}
          aria-controls={`${id}-filters`}
          onClick={() => setFiltersOpen((v) => !v)}
        >
          <SlidersHorizontal aria-hidden size={18} strokeWidth={1.5} />
          Filtros{activeCount ? ` (${activeCount})` : ""}
        </button>
        <form
          id={`${id}-filters`}
          role="search"
          aria-label="Filtrar tours"
          className={`${filtersOpen ? "mt-4 block" : "hidden"} space-y-5 rounded-lg border border-border bg-surface p-5 lg:sticky lg:top-24 lg:mt-0 lg:block`}
          onSubmit={(e) => {
            e.preventDefault();
            update("q", qDraft.trim());
          }}
        >
          <div>
            <label htmlFor={`${id}-q`} className="block text-sm font-medium">
              Buscar
            </label>
            <div className="mt-1 flex gap-2">
              <input
                id={`${id}-q`}
                type="search"
                value={qDraft}
                onChange={(e) => setQDraft(e.target.value)}
                placeholder="Uros, Colca, Machu Picchu…"
                className="block min-h-12 w-full min-w-0 rounded-md border border-border-strong bg-surface px-3 text-body"
              />
              <button type="submit" className={buttonClass("secondary", "md", "min-h-12")}>
                Buscar
              </button>
            </div>
          </div>
          <div>
            <label htmlFor={`${id}-dest`} className="block text-sm font-medium">
              Destino
            </label>
            <select id={`${id}-dest`} className={selectCls} value={destination} onChange={(e) => update("destino", e.target.value)}>
              <option value="">Todos los destinos</option>
              {destinations.map((d) => (
                <option key={d.value} value={d.value}>
                  {d.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor={`${id}-cat`} className="block text-sm font-medium">
              Categoría
            </label>
            <select id={`${id}-cat`} className={selectCls} value={category} onChange={(e) => update("categoria", e.target.value)}>
              <option value="">Todas las categorías</option>
              {categories.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </select>
          </div>
          <fieldset>
            <legend className="text-sm font-medium">Duración</legend>
            <div className="mt-2 flex flex-wrap gap-2">
              {[{ value: "", label: "Cualquiera" }, ...DURATION_BUCKETS].map((b) => (
                <label
                  key={b.value || "all"}
                  className="inline-flex min-h-11 cursor-pointer items-center rounded-pill border border-border-strong px-4 text-sm has-[:checked]:border-primary has-[:checked]:bg-primary has-[:checked]:text-on-primary has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-ring"
                >
                  <input
                    type="radio"
                    name="duracion"
                    value={b.value}
                    checked={duration === b.value}
                    onChange={() => update("duracion", b.value)}
                    className="sr-only"
                  />
                  {b.label}
                </label>
              ))}
            </div>
          </fieldset>
          {activeCount ? (
            <button type="button" className={buttonClass("ghost", "md", "w-full")} onClick={clearAll}>
              <X aria-hidden size={16} strokeWidth={1.5} />
              Limpiar filtros
            </button>
          ) : null}
        </form>
      </div>

      <div>
        <p role="status" aria-live="polite" className="mb-4 text-foreground-muted">
          {results.length} {results.length === 1 ? "tour encontrado" : "tours encontrados"}
        </p>
        {validDate || adults > 0 ? (
          <p className="mb-6 rounded-md bg-surface-muted px-4 py-3 text-sm text-foreground-muted">
            Buscaste
            {validDate ? ` para el ${formatDate(validDate)}` : ""}
            {adults > 0 ? ` · ${adults} ${adults === 1 ? "adulto" : "adultos"}` : ""}. La disponibilidad por fecha se
            confirma al elegir el tour.
          </p>
        ) : null}

        {results.length ? (
          <ul className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
            {results.map((t) => (
              <li key={t.slug}>{cards[t.slug]}</li>
            ))}
          </ul>
        ) : (
          <div className="rounded-lg border border-dashed border-border-strong p-8">
            <h2 className="text-h3 font-medium">No encontramos tours con esos filtros</h2>
            <p className="mt-2 text-foreground-muted">Prueba con otro destino o duración.</p>
            <button type="button" className={buttonClass("secondary", "md", "mt-4")} onClick={clearAll}>
              Limpiar filtros
            </button>
            <h3 className="mt-8 mb-4 text-h4 font-medium">Te pueden interesar</h3>
            <ul className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
              {suggestions.map((slug) => (
                <li key={slug}>{cards[slug]}</li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}
