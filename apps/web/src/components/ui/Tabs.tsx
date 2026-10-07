"use client";

import clsx from "clsx";
import { useId, useRef, useState, type KeyboardEvent, type ReactNode } from "react";

export interface TabItem {
  key: string;
  label: string;
  content: ReactNode;
}

/**
 * Pestañas ARIA (activación automática, flechas/Inicio/Fin). Los paneles llegan renderizados desde
 * el servidor; aquí solo se alterna su visibilidad.
 */
export function Tabs({ items, label }: { items: TabItem[]; label: string }) {
  const id = useId();
  const [active, setActive] = useState(0);
  const refs = useRef<(HTMLButtonElement | null)[]>([]);

  const focusTab = (i: number) => {
    const next = (i + items.length) % items.length;
    setActive(next);
    refs.current[next]?.focus();
  };

  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key === "ArrowRight") focusTab(active + 1);
    else if (e.key === "ArrowLeft") focusTab(active - 1);
    else if (e.key === "Home") focusTab(0);
    else if (e.key === "End") focusTab(items.length - 1);
    else return;
    e.preventDefault();
  };

  return (
    <div>
      <div role="tablist" aria-label={label} className="mb-6 flex gap-2 overflow-x-auto pb-1" onKeyDown={onKeyDown}>
        {items.map((item, i) => (
          <button
            key={item.key}
            ref={(el) => {
              refs.current[i] = el;
            }}
            type="button"
            role="tab"
            id={`${id}-tab-${item.key}`}
            aria-selected={i === active}
            aria-controls={`${id}-panel-${item.key}`}
            tabIndex={i === active ? 0 : -1}
            onClick={() => setActive(i)}
            className={clsx(
              "inline-flex min-h-11 shrink-0 items-center rounded-pill border px-4 text-sm font-medium transition-colors duration-150",
              i === active
                ? "border-primary bg-primary text-on-primary"
                : "border-border-strong text-foreground hover:bg-surface-muted",
            )}
          >
            {item.label}
          </button>
        ))}
      </div>
      {items.map((item, i) => (
        <div
          key={item.key}
          role="tabpanel"
          id={`${id}-panel-${item.key}`}
          aria-labelledby={`${id}-tab-${item.key}`}
          hidden={i !== active}
          tabIndex={0}
          className="focus-visible:outline-offset-4"
        >
          {item.content}
        </div>
      ))}
    </div>
  );
}
