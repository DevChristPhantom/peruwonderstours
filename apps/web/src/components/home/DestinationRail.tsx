"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { useRef, type ReactNode } from "react";

/**
 * Carrusel manual < 768 px (scroll-snap, 82 % de ancho, botones Anterior/Siguiente, sin autoplay);
 * grilla desde 768 px (home.md §5).
 */
export function DestinationRail({
  children,
  label,
  previousLabel,
  nextLabel,
}: {
  children: ReactNode;
  label: string;
  previousLabel: string;
  nextLabel: string;
}) {
  const ref = useRef<HTMLUListElement>(null);
  const scroll = (dir: 1 | -1) => {
    const el = ref.current;
    if (!el) return;
    const first = el.firstElementChild as HTMLElement | null;
    const step = first ? first.getBoundingClientRect().width + 16 : el.clientWidth * 0.8;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    el.scrollBy({ left: dir * step, behavior: reduced ? "auto" : "smooth" });
  };
  const btn =
    "inline-flex size-11 items-center justify-center rounded-pill border border-border-strong bg-surface text-foreground hover:bg-surface-muted";

  return (
    <div>
      <ul
        ref={ref}
        aria-label={label}
        className="-mx-4 flex snap-x snap-mandatory gap-4 overflow-x-auto px-4 pb-2 [scroll-padding-inline:1rem] [scrollbar-width:none] md:mx-0 md:grid md:grid-cols-2 md:overflow-visible md:px-0 lg:grid-cols-3 xl:grid-cols-5"
        data-reveal-stagger
      >
        {children}
      </ul>
      <div className="mt-4 flex justify-end gap-2 md:hidden">
        <button type="button" className={btn} onClick={() => scroll(-1)} aria-label={previousLabel}>
          <ChevronLeft aria-hidden size={20} strokeWidth={1.5} />
        </button>
        <button type="button" className={btn} onClick={() => scroll(1)} aria-label={nextLabel}>
          <ChevronRight aria-hidden size={20} strokeWidth={1.5} />
        </button>
      </div>
    </div>
  );
}
