"use client";

import clsx from "clsx";
import { MapPin, Route, Tag } from "lucide-react";
import { useId, useMemo, useRef, useState } from "react";

import { matchesQuery } from "@/lib/catalog/rules";
import type { SearchOption } from "@/lib/catalog/types";

const MAX_RESULTS = 8;

const ICONS = { destination: MapPin, category: Tag, tour: Route } as const;

interface DestinationComboboxProps {
  options: SearchOption[];
  query: string;
  onQueryChange: (q: string) => void;
  selected: SearchOption | null;
  onSelect: (option: SearchOption | null) => void;
  label: string;
  placeholder?: string;
  inputClassName?: string;
}

/**
 * Combobox ARIA 1.2 (lista con autocompletado). Teclado: ↑ ↓ Enter Esc.
 * Sin foco en el input, la lista se cierra; con el input vacío muestra destinos populares.
 */
export function DestinationCombobox({
  options,
  query,
  onQueryChange,
  selected,
  onSelect,
  label,
  placeholder,
  inputClassName,
}: DestinationComboboxProps) {
  const id = useId();
  const listId = `${id}-list`;
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);

  const results = useMemo(() => {
    if (!query.trim()) return options.filter((o) => o.kind === "destination").slice(0, MAX_RESULTS);
    return options.filter((o) => matchesQuery(`${o.label} ${o.hint}`, query)).slice(0, MAX_RESULTS);
  }, [options, query]);

  const choose = (option: SearchOption) => {
    onSelect(option);
    onQueryChange(option.label);
    setOpen(false);
    setActive(-1);
  };

  return (
    <div className="relative">
      <label htmlFor={`${id}-input`} className="block text-sm font-medium text-foreground">
        {label}
      </label>
      <input
        ref={inputRef}
        id={`${id}-input`}
        type="text"
        role="combobox"
        aria-autocomplete="list"
        aria-expanded={open}
        aria-controls={listId}
        aria-activedescendant={open && active >= 0 ? `${id}-opt-${active}` : undefined}
        autoComplete="off"
        spellCheck={false}
        placeholder={placeholder}
        value={query}
        className={inputClassName}
        onChange={(e) => {
          onQueryChange(e.target.value);
          if (selected) onSelect(null);
          setOpen(true);
          setActive(-1);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown") {
            e.preventDefault();
            setOpen(true);
            setActive((i) => (results.length ? (i + 1) % results.length : -1));
          } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setOpen(true);
            setActive((i) => (results.length ? (i <= 0 ? results.length - 1 : i - 1) : -1));
          } else if (e.key === "Enter" && open && active >= 0 && results[active]) {
            e.preventDefault();
            choose(results[active]);
          } else if (e.key === "Escape") {
            if (open) {
              e.preventDefault();
              setOpen(false);
            } else if (query) {
              onQueryChange("");
              onSelect(null);
            }
          }
        }}
      />
      <div
        className={clsx(
          "absolute top-full right-0 left-0 z-30 mt-2 overflow-hidden rounded-lg border border-border bg-surface shadow-lg",
          !open && "hidden",
        )}
      >
        {!query.trim() ? (
          <p className="px-4 pt-3 pb-1 text-xs font-medium tracking-[0.08em] text-foreground-muted uppercase">
            Destinos populares
          </p>
        ) : null}
        <ul id={listId} role="listbox" aria-label={label} className="max-h-80 overflow-y-auto p-1" data-lenis-prevent>
          {results.map((option, i) => {
            const Icon = ICONS[option.kind];
            return (
              <li
                key={`${option.kind}-${option.value}`}
                id={`${id}-opt-${i}`}
                role="option"
                aria-selected={i === active}
                className={clsx(
                  "flex min-h-11 cursor-pointer items-center gap-3 rounded-md px-3 py-2",
                  i === active ? "bg-surface-muted" : "hover:bg-surface-muted",
                )}
                // mousedown evita el blur del input antes de elegir.
                onMouseDown={(e) => {
                  e.preventDefault();
                  choose(option);
                }}
                onMouseEnter={() => setActive(i)}
              >
                <Icon aria-hidden size={18} strokeWidth={1.5} className="shrink-0 text-primary" />
                <span className="min-w-0">
                  <span className="block truncate text-foreground">{option.label}</span>
                  <span className="block truncate text-sm text-foreground-muted">{option.hint}</span>
                </span>
              </li>
            );
          })}
        </ul>
        {query.trim() && results.length === 0 ? (
          <p className="px-4 py-3 text-sm text-foreground-muted" role="status">
            No encontramos «{query.trim()}». Prueba con un destino como Puno o Cusco.
          </p>
        ) : null}
      </div>
    </div>
  );
}
