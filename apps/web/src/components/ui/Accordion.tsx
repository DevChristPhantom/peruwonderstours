"use client";

import { ChevronDown } from "lucide-react";
import { useId, useState, type ReactNode } from "react";

export interface AccordionItem {
  key: string;
  title: ReactNode;
  content: ReactNode;
}

/**
 * Acordeón con button[aria-expanded] (tour-detalle.md). Altura animada con
 * grid-template-rows 0fr → 1fr (360 ms, ease-in-out); instantáneo con movimiento reducido.
 * El contenido está en el HTML (SEO) aunque esté plegado.
 */
export function Accordion({
  items,
  defaultOpen = [],
  headingLevel = "h3",
}: {
  items: AccordionItem[];
  defaultOpen?: string[];
  headingLevel?: "h3" | "h4";
}) {
  const id = useId();
  const [open, setOpen] = useState<Set<string>>(() => new Set(defaultOpen));
  const Heading = headingLevel;

  const toggle = (key: string) =>
    setOpen((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  return (
    <div className="divide-y divide-border border-y border-border">
      {items.map((item) => {
        const expanded = open.has(item.key);
        const panelId = `${id}-${item.key}`;
        return (
          <div key={item.key}>
            <Heading className="m-0">
              <button
                type="button"
                aria-expanded={expanded}
                aria-controls={panelId}
                onClick={() => toggle(item.key)}
                className="flex min-h-14 w-full items-center justify-between gap-4 py-3 text-left font-medium text-foreground"
              >
                <span>{item.title}</span>
                <ChevronDown
                  aria-hidden
                  size={20}
                  strokeWidth={1.5}
                  className={`shrink-0 transition-transform duration-[360ms] ease-in-out ${expanded ? "rotate-180" : ""}`}
                />
              </button>
            </Heading>
            <div
              id={panelId}
              className={`grid transition-[grid-template-rows] duration-[360ms] ease-in-out ${expanded ? "grid-rows-[1fr]" : "grid-rows-[0fr]"}`}
            >
              <div className="overflow-hidden" inert={!expanded}>
                <div className="pb-5">{item.content}</div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
