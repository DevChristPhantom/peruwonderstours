"use client";

import { CalendarCheck } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";

import { buttonClass } from "@/components/ui/button-styles";
import { useFormat } from "@/hooks/useFormat";
import type { TourPricing } from "@/lib/catalog/types";

/** Ancla del módulo de reserva en flujo (móvil/tablet) dentro de la ficha del tour. */
const PANEL_SELECTOR = "#reservar";

/**
 * Botón flotante "Reservar" en móvil/tablet (ficha del tour). Lleva al módulo de reserva y enfoca el
 * calendario. Se oculta mientras el módulo de reserva está en pantalla (no lo tapa) y aparece al
 * alejarse; la transición solo usa opacity/transform y respeta `prefers-reduced-motion`.
 */
export function MobileBookingBar({ pricing }: { pricing: TourPricing | null }) {
  const t = useTranslations("booking");
  const tp = useTranslations("price");
  const f = useFormat();
  const [panelVisible, setPanelVisible] = useState(false);

  useEffect(() => {
    // Se oculta con el módulo de reserva o el pie en pantalla (no tapa el texto legal del pie).
    const targets = [document.querySelector(PANEL_SELECTOR), document.querySelector("footer")].filter(
      (el): el is Element => el !== null,
    );
    if (!targets.length || typeof IntersectionObserver === "undefined") return;
    const visible = new Set<Element>();
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) visible.add(entry.target);
          else visible.delete(entry.target);
        }
        setPanelVisible(visible.size > 0);
      },
      { threshold: 0.05 },
    );
    targets.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, []);

  return (
    <div
      className={`pointer-events-none fixed inset-x-0 bottom-0 z-10 flex max-w-[100vw] justify-end px-4 transition-[opacity,transform] duration-300 ease-out motion-reduce:transition-none lg:hidden ${
        panelVisible ? "translate-y-4 opacity-0" : "translate-y-0 opacity-100"
      }`}
      style={{ paddingBottom: "max(1rem, env(safe-area-inset-bottom))" }}
      // Oculto también para lectores de pantalla y teclado mientras el módulo de reserva está visible.
      aria-hidden={panelVisible || undefined}
      inert={panelVisible || undefined}
    >
      <a
        href={PANEL_SELECTOR}
        className={buttonClass("primary", "lg", "pointer-events-auto gap-3 rounded-pill px-5 shadow-lg")}
        onClick={() => {
          requestAnimationFrame(() =>
            document.querySelector<HTMLElement>(`${PANEL_SELECTOR} [role="grid"] button[tabindex="0"], ${PANEL_SELECTOR} input[type=date]`)?.focus(),
          );
        }}
      >
        <CalendarCheck aria-hidden size={20} strokeWidth={1.5} />
        {/* Nombre accesible = texto visible (WCAG 2.5.3) + pista solo para lectores de pantalla. */}
        <span className="font-semibold">{t("floating")}</span>
        <span className="sr-only">{t("floatingHint")}</span>
        <span className="border-l border-white/30 pl-3 text-sm font-normal opacity-90">
          {pricing
            ? tp.rich("fromShort", { amount: () => <span className="tabular font-semibold">{f.money(pricing.adultCents, pricing.currency)}</span> })
            : tp("onRequest")}
        </span>
      </a>
    </div>
  );
}
