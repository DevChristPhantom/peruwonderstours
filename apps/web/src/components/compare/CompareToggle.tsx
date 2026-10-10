"use client";

import clsx from "clsx";
import { Check, GitCompareArrows } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";

import { usePathname } from "@/i18n/navigation";

import { MAX_COMPARE, useCompareStore } from "@/stores/compare-store";
import { useUiStore } from "@/stores/ui-store";
import { compareHref } from "./compare-href";

/** "Comparar" en la tarjeta (HU-B.A8). Conmutador con `aria-pressed`; máximo 3 tours. */
export function CompareToggle({ slug, title, className }: { slug: string; title: string; className?: string }) {
  const active = useCompareStore((s) => s.items.some((i) => i.slug === slug));
  const toggle = useCompareStore((s) => s.toggle);
  const announce = useUiStore((s) => s.announce);
  const showToast = useUiStore((s) => s.showToast);
  const t = useTranslations("compare");
  const locale = useLocale();
  // En la ficha no hay bandeja del comparador: se confirma con un toast.
  const onDetail = usePathname() === "/tours/[slug]";

  const onClick = () => {
    const result = toggle({ slug, title });
    const items = useCompareStore.getState().items;
    if (result === "full") {
      announce(t("fullAnnounce", { max: MAX_COMPARE, title }));
      showToast({
        message: t("full", { max: MAX_COMPARE }),
        duration: 7000,
        action: { label: t("compareNow"), href: compareHref(items.map((i) => i.slug), locale) },
      });
      return;
    }
    if (onDetail && result === "added") {
      showToast({
        message: t("addedToast", { count: items.length, max: MAX_COMPARE }),
        action: items.length >= 2 ? { label: t("compareNow"), href: compareHref(items.map((i) => i.slug), locale) } : undefined,
      });
    }
    announce(result === "added" ? t("addedAnnounce", { title, count: items.length, max: MAX_COMPARE }) : t("removedAnnounce", { title }));
  };

  return (
    <button
      type="button"
      aria-pressed={active}
      aria-label={t("toggleLabel", { title })}
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
      {t("toggle")}
    </button>
  );
}
