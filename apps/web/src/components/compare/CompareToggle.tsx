"use client";

import clsx from "clsx";
import { Check, GitCompareArrows } from "lucide-react";
import { usePathname } from "next/navigation";

import { MAX_COMPARE, useCompareStore } from "@/stores/compare-store";
import { useUiStore } from "@/stores/ui-store";
import { compareHref } from "./compare-href";

/** "Comparar" en la tarjeta (HU-B.A8). Conmutador con `aria-pressed`; máximo 3 tours. */
export function CompareToggle({ slug, title, className }: { slug: string; title: string; className?: string }) {
  const active = useCompareStore((s) => s.items.some((i) => i.slug === slug));
  const toggle = useCompareStore((s) => s.toggle);
  const announce = useUiStore((s) => s.announce);
  const showToast = useUiStore((s) => s.showToast);
  // En la ficha no hay bandeja del comparador: se confirma con un toast.
  const onDetail = /^\/es\/tours\/[^/]+$/.test(usePathname());

  const onClick = () => {
    const result = toggle({ slug, title });
    const items = useCompareStore.getState().items;
    if (result === "full") {
      announce(`Puedes comparar hasta ${MAX_COMPARE} tours. Quita uno para agregar ${title}.`);
      showToast({
        message: `Puedes comparar hasta ${MAX_COMPARE} tours`,
        duration: 7000,
        action: { label: "Comparar ahora", href: compareHref(items.map((i) => i.slug)) },
      });
      return;
    }
    if (onDetail && result === "added") {
      showToast({
        message: `Agregado al comparador (${items.length} de ${MAX_COMPARE})`,
        action: items.length >= 2 ? { label: "Comparar ahora", href: compareHref(items.map((i) => i.slug)) } : undefined,
      });
    }
    announce(
      result === "added"
        ? `${title} agregado al comparador (${items.length} de ${MAX_COMPARE}).`
        : `${title} quitado del comparador.`,
    );
  };

  return (
    <button
      type="button"
      aria-pressed={active}
      aria-label={`Comparar ${title}`}
      onClick={onClick}
      className={clsx(
        "relative z-[2] inline-flex min-h-11 items-center gap-2 rounded-pill border px-3 text-sm font-medium",
        "transition-[background-color,color,border-color] duration-150",
        "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
        active
          ? "border-primary bg-primary text-on-primary hover:bg-primary-hover"
          : "border-border-strong bg-surface text-foreground hover:bg-surface-muted",
        className,
      )}
    >
      {active ? <Check aria-hidden size={16} strokeWidth={2} /> : <GitCompareArrows aria-hidden size={16} strokeWidth={1.5} />}
      Comparar
    </button>
  );
}
