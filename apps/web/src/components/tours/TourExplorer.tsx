"use client";

import { SlidersHorizontal, Sparkles, X } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useId, useMemo, useState, type ReactNode } from "react";

import { DURATION_BUCKETS, isDurationBucket, matchesQuery } from "@/lib/catalog/rules";
import type { DurationBucket } from "@/lib/catalog/types";
import { formatDate, todayInLima } from "@/lib/format";
import { applyPhraseToParams, isMonthValue, monthLabel, parsePhrase, resolveMonth } from "@/lib/search/phrase";
import { useLimaToday } from "@/hooks/useClientOnly";
import { useUiStore } from "@/stores/ui-store";
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
  const children = Number(params.get("ninos") ?? 0);
  const monthParam = params.get("mes");
  const month = isMonthValue(monthParam) ? monthParam : "";
  const announce = useUiStore((s) => s.announce);
  const today = useLimaToday();
  // Próximos 12 meses para el selector de mes (según el reloj del visitante en Lima).
  const monthOptions = useMemo(() => {
    if (!today) return month ? [month] : [];
    const [y, m] = today.split("-").map(Number);
    const list = Array.from({ length: 12 }, (_, i) =>
      resolveMonth(((m - 1 + i) % 12) + 1, today, y + Math.floor((m - 1 + i) / 12)),
    );
    return month && !list.includes(month) ? [month, ...list] : list;
  }, [today, month]);

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

  /** HU-B.A9: frase → filtros visibles. Lo no entendido queda como texto normal. */
  const submitPhrase = (phrase: string) => {
    const parsed = parsePhrase(phrase, todayInLima());
    if (!parsed.understood) {
      update("q", phrase.trim());
      return;
    }
    const next = applyPhraseToParams(parsed, new URLSearchParams(params.toString()));
    setQDraft(parsed.text);
    setSyncedQ(parsed.text);
    const qs = next.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    const understood = [
      parsed.destination && `destino ${parsed.destination.label}`,
      parsed.category && `categoría ${parsed.category.label}`,
      parsed.month && `mes ${monthLabel(parsed.month)}`,
      parsed.adults && `${parsed.adults} ${parsed.adults === 1 ? "viajero" : "viajeros"}`,
      parsed.children && `${parsed.children} ${parsed.children === 1 ? "niño" : "niños"}`,
      parsed.duration && `duración ${DURATION_BUCKETS.find((b) => b.value === parsed.duration)?.label}`,
    ].filter(Boolean);
    announce(`Entendimos: ${understood.join(", ")}. Puedes editar o quitar cada filtro.`);
  };

  const clearAll = () => {
    setQDraft("");
    const next = new URLSearchParams();
    // Se conserva solo la fecha exacta del buscador; mes y viajeros son chips y se limpian.
    for (const key of ["fecha"]) {
      const v = params.get(key);
      if (v) next.set(key, v);
    }
    const qs = next.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  };

  const activeCount = [destination, category, duration, q].filter(Boolean).length;
  const chips = [
    destination && { key: "destino", label: `Destino: ${destinations.find((d) => d.value === destination)?.label ?? destination}` },
    category && { key: "categoria", label: `Categoría: ${categories.find((c) => c.value === category)?.label ?? category}` },
    duration && { key: "duracion", label: `Duración: ${DURATION_BUCKETS.find((b) => b.value === duration)?.label}` },
    month && { key: "mes", label: `Mes: ${monthLabel(month)}` },
    adults > 0 && {
      key: "adultos",
      label: `${adults} ${adults === 1 ? "viajero" : "viajeros"}${children > 0 ? ` + ${children} ${children === 1 ? "niño" : "niños"}` : ""}`,
    },
    q && { key: "q", label: `Texto: "${q}"` },
  ].filter((c): c is { key: string; label: string } => !!c);
  const removeChip = (key: string) => {
    if (key === "q") setQDraft("");
    const next = new URLSearchParams(params.toString());
    next.delete(key);
    if (key === "adultos") next.delete("ninos");
    const qs = next.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  };
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
            submitPhrase(qDraft);
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
                placeholder="Ej.: titicaca julio 4 personas"
                aria-describedby={`${id}-q-help`}
                className="block min-h-12 w-full min-w-0 rounded-md border border-border-strong bg-surface px-3 text-body"
              />
              <button type="submit" className={buttonClass("secondary", "md", "min-h-12")}>
                Buscar
              </button>
            </div>
            <p id={`${id}-q-help`} className="mt-1 text-sm text-foreground-muted">
              Escribe destino, mes y personas; lo convertimos en filtros que puedes editar.
            </p>
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
          <div>
            <label htmlFor={`${id}-mes`} className="block text-sm font-medium">
              Mes de viaje
            </label>
            <select id={`${id}-mes`} className={selectCls} value={month} onChange={(e) => update("mes", e.target.value)}>
              <option value="">Cualquier mes</option>
              {monthOptions.map((m) => (
                <option key={m} value={m}>
                  {monthLabel(m)}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor={`${id}-pax`} className="block text-sm font-medium">
              Viajeros
            </label>
            <select
              id={`${id}-pax`}
              className={selectCls}
              value={adults > 0 ? String(Math.min(adults, 20)) : ""}
              onChange={(e) => update("adultos", e.target.value)}
            >
              <option value="">Sin indicar</option>
              {Array.from({ length: 20 }, (_, i) => i + 1).map((n) => (
                <option key={n} value={n}>
                  {n} {n === 1 ? "viajero" : "viajeros"}
                </option>
              ))}
            </select>
          </div>
          {activeCount || chips.length ? (
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
        {chips.length ? (
          <div className="mb-5">
            <p id={`${id}-chips`} className="mb-2 inline-flex items-center gap-1.5 text-sm font-medium">
              <Sparkles aria-hidden size={16} strokeWidth={1.5} />
              Filtros aplicados
            </p>
            <ul aria-labelledby={`${id}-chips`} className="flex flex-wrap gap-2">
              {chips.map((chip) => (
                <li key={chip.key}>
                  <button
                    type="button"
                    onClick={() => removeChip(chip.key)}
                    aria-label={`Quitar filtro ${chip.label}`}
                    className="inline-flex min-h-11 items-center gap-1.5 rounded-pill border border-primary bg-surface px-4 text-sm text-foreground transition-colors duration-150 hover:bg-surface-muted"
                  >
                    {chip.label}
                    <X aria-hidden size={14} strokeWidth={1.5} />
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
        {validDate || adults > 0 || month ? (
          <p className="mb-6 rounded-md bg-surface-muted px-4 py-3 text-sm text-foreground-muted">
            Buscaste
            {validDate ? ` para el ${formatDate(validDate)}` : month ? ` en ${monthLabel(month)}` : ""}
            {adults > 0 ? ` · ${adults} ${adults === 1 ? "viajero" : "viajeros"}` : ""}. Mostramos todos los tours que
            coinciden; la disponibilidad por fecha se confirma al elegir el tour.
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
