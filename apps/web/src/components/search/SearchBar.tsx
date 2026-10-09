"use client";

import clsx from "clsx";
import { Search } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useId, useRef, useState, type FormEvent } from "react";

import type { SearchOption } from "@/lib/catalog/types";
import { describeTravelers, type Travelers } from "@/lib/cart/types";
import { addDays, todayInLima } from "@/lib/format";
import { applyPhraseToParams, parsePhrase } from "@/lib/search/phrase";
import { useLimaToday } from "@/hooks/useClientOnly";
import { buttonClass } from "@/components/ui/button-styles";
import { Counter } from "@/components/ui/Counter";
import { DestinationCombobox } from "./DestinationCombobox";

const QUICK_LINKS = [
  { label: "Uros y Taquile", href: "/es/tours/tour-islas-de-los-uros-y-taquile-full-day" },
  { label: "Machu Picchu", href: "/es/categorias/tours-a-machu-picchu" },
  { label: "Colca 2D/1N", href: "/es/tours/trekking-canon-del-colca-2-dias" },
  { label: "Paquetes de varios días", href: "/es/categorias/paquetes-turisticos-en-peru" },
];

const fieldBox = "flex flex-col justify-center gap-1 px-4 py-3 lg:px-5";
const inputCls =
  "mt-1 block w-full min-h-11 rounded-md border border-border-strong bg-surface px-3 text-body text-foreground " +
  "placeholder:text-foreground-muted lg:border-transparent lg:px-0 lg:min-h-8 focus-visible:outline-2 focus-visible:outline-ring";

/** Buscador de la home (home.md §4): destino, fecha y viajeros → /es/tours con query string. */
export function SearchBar({ options }: { options: SearchOption[] }) {
  const router = useRouter();
  const id = useId();
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<SearchOption | null>(null);
  const [date, setDate] = useState("");
  const [travelers, setTravelers] = useState<Travelers>({ adults: 2, children: 0, infants: 0 });
  const [paxOpen, setPaxOpen] = useState(false);
  const paxRef = useRef<HTMLDivElement>(null);
  const paxButtonRef = useRef<HTMLButtonElement>(null);
  // Fecha mínima según el reloj del visitante en Lima (no la del build).
  const today = useLimaToday();
  const minDate = today ? addDays(today, 1) : undefined;

  useEffect(() => {
    if (!paxOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setPaxOpen(false);
        paxButtonRef.current?.focus();
      }
    };
    const onDown = (e: PointerEvent) => {
      if (!paxRef.current?.contains(e.target as Node)) setPaxOpen(false);
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onDown);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onDown);
    };
  }, [paxOpen]);

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    const params = new URLSearchParams();
    if (date) params.set("fecha", date);
    params.set("adultos", String(travelers.adults));
    if (travelers.children) params.set("ninos", String(travelers.children));
    if (travelers.infants) params.set("bebes", String(travelers.infants));

    if (selected?.kind === "tour") {
      router.push(`${selected.href}?${params}`);
      return;
    }
    if (selected?.kind === "destination") params.set("destino", selected.value);
    else if (selected?.kind === "category") params.set("categoria", selected.value);
    else if (query.trim()) {
      // HU-B.A9: "titicaca julio 4 personas" → destino, mes y viajeros (chips editables en /es/tours).
      const parsed = parsePhrase(query, todayInLima());
      if (!parsed.understood) params.set("q", query.trim());
      else {
        // La fecha exacta elegida manda sobre el mes de la frase.
        router.push(`/es/tours?${applyPhraseToParams(date ? { ...parsed, month: null } : parsed, params)}`);
        return;
      }
    }
    router.push(`/es/tours?${params}`);
  };

  return (
    <div className="pwt-search-in relative z-10 -mt-12">
      <form
        role="search"
        aria-label="Buscar tours"
        onSubmit={onSubmit}
        className="mx-auto grid max-w-[1080px] grid-cols-1 overflow-visible rounded-lg border border-border bg-surface shadow-lg md:grid-cols-2 lg:grid-cols-[1.5fr_1fr_1fr_auto] lg:divide-x lg:divide-border"
      >
        <div className={clsx(fieldBox, "md:col-span-2 lg:col-span-1")}>
          <DestinationCombobox
            options={options}
            query={query}
            onQueryChange={setQuery}
            selected={selected}
            onSelect={setSelected}
            label="¿A dónde vas?"
            placeholder="Ej.: titicaca julio 4 personas"
            inputClassName={inputCls}
          />
        </div>

        <div className={fieldBox}>
          <label htmlFor={`${id}-date`} className="block text-sm font-medium text-foreground">
            ¿Cuándo?
          </label>
          <input
            id={`${id}-date`}
            type="date"
            min={minDate}
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className={inputCls}
            aria-describedby={`${id}-date-hint`}
          />
          <span id={`${id}-date-hint`} className="sr-only">
            Opcional. Formato día, mes y año.
          </span>
        </div>

        <div className={clsx(fieldBox, "relative")} ref={paxRef}>
          <span id={`${id}-pax-label`} className="block text-sm font-medium text-foreground">
            Viajeros
          </span>
          <button
            ref={paxButtonRef}
            type="button"
            aria-haspopup="dialog"
            aria-expanded={paxOpen}
            aria-controls={`${id}-pax`}
            aria-labelledby={`${id}-pax-label ${id}-pax-value`}
            onClick={() => setPaxOpen((v) => !v)}
            className={clsx(inputCls, "text-left")}
          >
            <span id={`${id}-pax-value`}>{describeTravelers(travelers)}</span>
          </button>
          {paxOpen ? (
            <div
              id={`${id}-pax`}
              role="dialog"
              aria-label="Elegir viajeros"
              className="absolute top-full right-0 left-0 z-30 mt-2 rounded-lg border border-border bg-surface p-4 shadow-lg lg:left-auto lg:w-80"
            >
              <Counter
                label="Adultos"
                hint="12 años o más"
                unitName="un adulto"
                value={travelers.adults}
                min={1}
                onChange={(adults) => setTravelers((t) => ({ ...t, adults }))}
              />
              <Counter
                label="Niños"
                hint="3 a 11 años"
                unitName="un niño"
                value={travelers.children}
                onChange={(children) => setTravelers((t) => ({ ...t, children }))}
              />
              <Counter
                label="Bebés"
                hint="0 a 2 años"
                unitName="un bebé"
                value={travelers.infants}
                onChange={(infants) => setTravelers((t) => ({ ...t, infants }))}
              />
              <button
                type="button"
                className={buttonClass("outline", "md", "mt-2 w-full")}
                onClick={() => {
                  setPaxOpen(false);
                  paxButtonRef.current?.focus();
                }}
              >
                Listo
              </button>
            </div>
          ) : null}
        </div>

        <div className="flex items-center p-3 md:col-span-2 lg:col-span-1">
          <button type="submit" className={buttonClass("primary", "xl", "w-full lg:w-auto")}>
            <Search aria-hidden size={20} strokeWidth={1.5} />
            Buscar tours
          </button>
        </div>
      </form>

      <nav aria-label="Accesos rápidos" className="mx-auto mt-4 max-w-[1080px]">
        <ul className="flex flex-wrap justify-center gap-2">
          {QUICK_LINKS.map((q) => (
            <li key={q.href}>
              <Link
                href={q.href}
                className="inline-flex min-h-11 items-center rounded-pill border border-border-strong px-4 text-sm text-foreground transition-colors duration-150 hover:bg-surface-muted"
              >
                {q.label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  );
}
