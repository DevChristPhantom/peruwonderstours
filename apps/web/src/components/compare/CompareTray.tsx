"use client";

import { GitCompareArrows, X } from "lucide-react";
import Link from "@/components/ui/IntentLink";
import { useLocale, useTranslations } from "next-intl";

import { usePathname } from "@/i18n/navigation";

import { MAX_COMPARE, useCompareStore } from "@/stores/compare-store";
import { useUiStore } from "@/stores/ui-store";
import { buttonClass } from "@/components/ui/button-styles";
import { compareHref } from "./compare-href";

/** Rutas con su propia barra inferior o donde el comparador no aporta. */
const HIDDEN = ["/tours/[slug]", "/carrito", "/comparar", "/mi-viaje", "/reserva/[codigo]"];

/** Bandeja del comparador (HU-B.A8): aparece al marcar el primer tour. */
export function CompareTray() {
  const pathname = usePathname();
  const items = useCompareStore((s) => s.items);
  const remove = useCompareStore((s) => s.remove);
  const clear = useCompareStore((s) => s.clear);
  const announce = useUiStore((s) => s.announce);
  const t = useTranslations("compare");
  const locale = useLocale();

  if (!items.length || HIDDEN.includes(pathname)) return null;
  const ready = items.length >= 2;

  return (
    <>
      {/* Reserva el alto de la bandeja al final de la página: nada queda tapado (WCAG 2.4.11). */}
      <div aria-hidden="true" className="h-20" />
      <section
        aria-label={t("trayLabel")}
        className="pwt-toast fixed inset-x-0 bottom-0 z-10 max-w-[100vw] border-t border-border bg-surface shadow-sticky"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        <div className="pwt-container flex flex-wrap items-center gap-x-4 gap-y-2 py-3">
          <p className="inline-flex items-center gap-2 text-sm font-medium">
            <GitCompareArrows aria-hidden size={18} strokeWidth={1.5} />
            {t("trayTitle", { count: items.length, max: MAX_COMPARE })}
          </p>
          <ul className="hidden min-w-0 flex-1 flex-wrap gap-2 xl:flex">
            {items.map((item) => (
              <li key={item.slug}>
                <button
                  type="button"
                  onClick={() => {
                    remove(item.slug);
                    announce(t("removedAnnounce", { title: item.title }));
                  }}
                  className="inline-flex min-h-11 max-w-[260px] items-center gap-1.5 rounded-pill border border-border-strong px-3 text-sm hover:bg-surface-muted"
                  aria-label={t("removeLabel", { title: item.title })}
                >
                  <span className="truncate">{item.title}</span>
                  <X aria-hidden size={14} strokeWidth={1.5} className="shrink-0" />
                </button>
              </li>
            ))}
          </ul>
          <div className="ml-auto flex items-center gap-2">
            <button type="button" className={buttonClass("ghost", "md")} onClick={() => { clear(); announce(t("clearedAnnounce")); }}>
              {t("clear")}
            </button>
            {ready ? (
              <Link href={compareHref(items.map((i) => i.slug), locale)} className={buttonClass("secondary", "md")}>
                {t("compareCount", { count: items.length })}
              </Link>
            ) : (
              <span className="text-sm text-foreground-muted">{t("chooseTwo")}</span>
            )}
          </div>
        </div>
      </section>
    </>
  );
}
