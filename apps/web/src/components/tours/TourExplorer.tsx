"use client";

import { SlidersHorizontal, Sparkles, X } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { useQuery } from "@tanstack/react-query";
import { useId, useMemo, useState, type ReactNode } from "react";

import { DURATION_BUCKETS, isDurationBucket, matchesQuery } from "@/lib/catalog/rules";
import type { DurationBucket } from "@/lib/catalog/types";
import { addDays, todayInLima } from "@/lib/format";
import { applyPhraseToParams, isMonthValue, parsePhrase, resolveMonth } from "@/lib/search/phrase";
import { useFormat } from "@/hooks/useFormat";
import { useLimaToday } from "@/hooks/useClientOnly";
import { useUiStore } from "@/stores/ui-store";
import { buttonClass } from "@/components/ui/button-styles";

export interface ExplorerTour {
  slug: string;
  destinationSlugs: string[];
  categorySlugs: string[];
  durationBucket: DurationBucket | null;
  minPax: number;
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
  const t = useTranslations("explorer");
  const tf = useTranslations("filters");
  const f = useFormat();
  const monthLabel = (m: string) => f.month(m) ?? m;
  const durationLabel = (value: string) => tf(`duration.${value as "1" | "2-3" | "4-6" | "7+"}`);
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

  /*
   * W4: la fecha exacta (o el mes) y los viajeros filtran por salidas reales con cupo. Rango: el día
   * elegido, el mes completo o, solo con viajeros, los próximos 60 días. Lo resuelve el BFF
   * (/api/availability) con el calendario de cada tour.
   */
  const validDate = date && /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : null;
  const pax = Math.max(0, adults) + Math.max(0, children);
  const range = useMemo((): { from: string; to: string } | null => {
    if (validDate) return { from: validDate, to: validDate };
    if (month) {
      const [y, m] = month.split("-").map(Number);
      return { from: `${month}-01`, to: new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10) };
    }
    if (pax > 0 && today) return { from: addDays(today, 1), to: addDays(today, 60) };
    return null;
  }, [validDate, month, pax, today]);
  const availability = useQuery({
    queryKey: ["availability", range?.from, range?.to, pax],
    enabled: !!range,
    staleTime: 60_000,
    queryFn: async () => {
      const res = await fetch(`/api/availability?from=${range!.from}&to=${range!.to}&pax=${Math.max(1, pax)}`);
      if (!res.ok) throw new Error(`availability ${res.status}`);
      return new Set(((await res.json()) as { keys: string[] }).keys);
    },
  });
  const availableKeys = range && availability.data ? availability.data : null;

  const results = useMemo(
    () =>
      tours.filter(
        (t) =>
          (!destination || t.destinationSlugs.includes(destination)) &&
          (!category || t.categorySlugs.includes(category)) &&
          (!duration || t.durationBucket === duration) &&
          (!q || matchesQuery(t.searchText, q)) &&
          (!availableKeys || availableKeys.has(t.slug)),
      ),
    [tours, destination, category, duration, q, availableKeys],
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
      parsed.destination && t("understood.destination", { value: destinations.find((d) => d.value === parsed.destination!.slug)?.label ?? parsed.destination.label }),
      parsed.category && t("understood.category", { value: categories.find((c) => c.value === parsed.category!.slug)?.label ?? parsed.category.label }),
      parsed.month && t("understood.month", { value: monthLabel(parsed.month) }),
      parsed.adults && t("travelers", { count: parsed.adults }),
      parsed.children && t("children", { count: parsed.children }),
      parsed.duration && t("understood.duration", { value: durationLabel(parsed.duration) }),
    ].filter(Boolean);
    announce(t("understoodAnnounce", { list: understood.join(", ") }));
  };

  const clearAll = () => {
    setQDraft("");
    // Fecha, mes y viajeros también filtran (W4): se limpian con el resto.
    router.replace(pathname, { scroll: false });
  };

  const activeCount = [destination, category, duration, q, date, month, adults > 0 ? "pax" : ""].filter(Boolean).length;
  const chips = [
    destination && { key: "destino", label: t("chips.destination", { value: destinations.find((d) => d.value === destination)?.label ?? destination }) },
    category && { key: "categoria", label: t("chips.category", { value: categories.find((c) => c.value === category)?.label ?? category }) },
    duration && { key: "duracion", label: t("chips.duration", { value: durationLabel(duration) }) },
    validDate && { key: "fecha", label: t("chips.date", { value: f.date(validDate) }) },
    month && { key: "mes", label: t("chips.month", { value: monthLabel(month) }) },
    adults > 0 && {
      key: "adultos",
      label: children > 0 ? t("chips.travelersChildren", { adults, children }) : t("travelers", { count: adults }),
    },
    q && { key: "q", label: t("chips.text", { value: q }) },
  ].filter((c): c is { key: string; label: string } => !!c);
  const removeChip = (key: string) => {
    if (key === "q") setQDraft("");
    const next = new URLSearchParams(params.toString());
    next.delete(key);
    if (key === "adultos") next.delete("ninos");
    const qs = next.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  };

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
          {t("filtersButton", { count: activeCount })}
        </button>
        <form
          id={`${id}-filters`}
          role="search"
          aria-label={t("formLabel")}
          className={`${filtersOpen ? "mt-4 block" : "hidden"} space-y-5 rounded-lg border border-border bg-surface p-5 lg:sticky lg:top-24 lg:mt-0 lg:block`}
          onSubmit={(e) => {
            e.preventDefault();
            submitPhrase(qDraft);
          }}
        >
          <div>
            <label htmlFor={`${id}-q`} className="block text-sm font-medium">
              {t("search")}
            </label>
            <div className="mt-1 flex gap-2">
              <input
                id={`${id}-q`}
                type="search"
                value={qDraft}
                onChange={(e) => setQDraft(e.target.value)}
                placeholder={t("placeholder")}
                aria-describedby={`${id}-q-help`}
                className="block min-h-12 w-full min-w-0 rounded-md border border-border-strong bg-surface px-3 text-body"
              />
              <button type="submit" className={buttonClass("secondary", "md", "min-h-12")}>
                {t("search")}
              </button>
            </div>
            <p id={`${id}-q-help`} className="mt-1 text-sm text-foreground-muted">
              {t("searchHelp")}
            </p>
          </div>
          <div>
            <label htmlFor={`${id}-dest`} className="block text-sm font-medium">
              {t("destination")}
            </label>
            <select id={`${id}-dest`} className={selectCls} value={destination} onChange={(e) => update("destino", e.target.value)}>
              <option value="">{t("allDestinations")}</option>
              {destinations.map((d) => (
                <option key={d.value} value={d.value}>
                  {d.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor={`${id}-cat`} className="block text-sm font-medium">
              {t("category")}
            </label>
            <select id={`${id}-cat`} className={selectCls} value={category} onChange={(e) => update("categoria", e.target.value)}>
              <option value="">{t("allCategories")}</option>
              {categories.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </select>
          </div>
          <fieldset>
            <legend className="text-sm font-medium">{t("duration")}</legend>
            <div className="mt-2 flex flex-wrap gap-2">
              {[{ value: "", label: t("anyDuration") }, ...DURATION_BUCKETS.map((b) => ({ value: b.value, label: durationLabel(b.value) }))].map((b) => (
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
            <label htmlFor={`${id}-fecha`} className="block text-sm font-medium">
              {t("date")}
            </label>
            <input
              id={`${id}-fecha`}
              type="date"
              min={today ? addDays(today, 1) : undefined}
              value={validDate ?? ""}
              onChange={(e) => {
                const next = new URLSearchParams(params.toString());
                if (e.target.value) {
                  next.set("fecha", e.target.value);
                  next.delete("mes");
                } else next.delete("fecha");
                router.replace(`${pathname}?${next.toString()}`, { scroll: false });
              }}
              className={selectCls}
            />
          </div>
          <div>
            <label htmlFor={`${id}-mes`} className="block text-sm font-medium">
              {t("month")}
            </label>
            <select id={`${id}-mes`} className={selectCls} value={month} onChange={(e) => update("mes", e.target.value)}>
              <option value="">{t("anyMonth")}</option>
              {monthOptions.map((m) => (
                <option key={m} value={m}>
                  {monthLabel(m)}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor={`${id}-pax`} className="block text-sm font-medium">
              {t("travelersLabel")}
            </label>
            <select
              id={`${id}-pax`}
              className={selectCls}
              value={adults > 0 ? String(Math.min(adults, 20)) : ""}
              onChange={(e) => update("adultos", e.target.value)}
            >
              <option value="">{t("notSpecified")}</option>
              {Array.from({ length: 20 }, (_, i) => i + 1).map((n) => (
                <option key={n} value={n}>
                  {t("travelers", { count: n })}
                </option>
              ))}
            </select>
          </div>
          {activeCount || chips.length ? (
            <button type="button" className={buttonClass("ghost", "md", "w-full")} onClick={clearAll}>
              <X aria-hidden size={16} strokeWidth={1.5} />
              {t("clear")}
            </button>
          ) : null}
        </form>
      </div>

      <div>
        <p role="status" aria-live="polite" className="mb-4 text-foreground-muted">
          {t("results", { count: results.length })}
        </p>
        {chips.length ? (
          <div className="mb-5">
            <p id={`${id}-chips`} className="mb-2 inline-flex items-center gap-1.5 text-sm font-medium">
              <Sparkles aria-hidden size={16} strokeWidth={1.5} />
              {t("applied")}
            </p>
            <ul aria-labelledby={`${id}-chips`} className="flex flex-wrap gap-2">
              {chips.map((chip) => (
                <li key={chip.key}>
                  <button
                    type="button"
                    onClick={() => removeChip(chip.key)}
                    aria-label={t("removeChip", { label: chip.label })}
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
            {validDate
              ? t("searchedDate", { date: f.date(validDate) })
              : month
                ? t("searchedMonth", { month: monthLabel(month) })
                : t("searchedNoDate")}
            {adults > 0 ? ` · ${t("travelers", { count: adults })}` : ""}.{" "}
            {availability.isFetching
              ? t("availabilityLoading")
              : availability.isError
                ? t("availabilityError")
                : t("availabilityNote")}
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
            <h2 className="text-h3 font-medium">{t("emptyTitle")}</h2>
            <p className="mt-2 text-foreground-muted">{t("emptyText")}</p>
            <button type="button" className={buttonClass("secondary", "md", "mt-4")} onClick={clearAll}>
              {t("clear")}
            </button>
            <h3 className="mt-8 mb-4 text-h4 font-medium">{t("suggestions")}</h3>
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
