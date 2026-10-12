"use client";

import { AlertTriangle, Check } from "lucide-react";
import { useTranslations } from "next-intl";
import type { ComponentProps } from "react";

import { useFormat } from "@/hooks/useFormat";
import { Link } from "@/i18n/navigation";

import type { CartLine } from "@/lib/cart/types";
import { useTripGate } from "@/stores/trip-store";
import { useUiStore } from "@/stores/ui-store";
import { buttonClass } from "@/components/ui/button-styles";

interface TripConflictAlertProps {
  lines: readonly CartLine[];
  /** Enlace para corregir fechas (se omite cuando ya estamos en el carrito). */
  editHref?: ComponentProps<typeof Link>["href"] | null;
  className?: string;
}

/**
 * Aviso de choque de fechas (HU-B.A5). Bloquea el pago hasta cambiar un tour o confirmar
 * explícitamente que las fechas son correctas (p. ej. dos grupos distintos viajando).
 */
export function TripConflictAlert({ lines, editHref = "/carrito", className }: TripConflictAlertProps) {
  const t = useTranslations("trip.conflict");
  const fmt = useFormat();
  const { pending, acknowledgeAll } = useTripGate(lines);
  const announce = useUiStore((s) => s.announce);
  if (!pending.length) return null;

  return (
    <section
      aria-labelledby="trip-conflict-title"
      className={`rounded-lg border border-danger bg-danger-soft p-4 text-foreground ${className ?? ""}`}
    >
      <h2 id="trip-conflict-title" className="flex items-center gap-2 font-medium text-danger">
        <AlertTriangle aria-hidden size={20} strokeWidth={1.5} />
        {t("title")}
      </h2>
      <ul className="mt-2 space-y-2 text-sm">
        {pending.map((conflict) => (
          <li key={conflict.signature}>
            {conflict.items
              .map((it) => t("item", { title: it.line.title, date: fmt.date(it.start), days: it.days }))
              .join(t("and"))}
            {conflict.dates.length ? t("overlapOn", { dates: conflict.dates.map((d) => fmt.date(d)).join(", ") }) : "."}
          </li>
        ))}
      </ul>
      <p className="mt-2 text-sm">{t("help")}</p>
      <div className="mt-3 flex flex-wrap gap-2">
        {editHref ? (
          <Link href={editHref} className={buttonClass("secondary", "md")}>
            {t("change")}
          </Link>
        ) : null}
        <button
          type="button"
          className={buttonClass("outline", "md")}
          onClick={() => {
            acknowledgeAll();
            announce(t("confirmed"));
          }}
        >
          <Check aria-hidden size={16} strokeWidth={1.5} />
          {t("confirm")}
        </button>
      </div>
    </section>
  );
}
