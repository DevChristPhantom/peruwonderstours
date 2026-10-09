"use client";

import { AlertTriangle, Check } from "lucide-react";
import Link from "next/link";

import type { CartLine } from "@/lib/cart/types";
import { formatDate } from "@/lib/format";
import { useTripGate } from "@/stores/trip-store";
import { useUiStore } from "@/stores/ui-store";
import { buttonClass } from "@/components/ui/button-styles";

interface TripConflictAlertProps {
  lines: readonly CartLine[];
  /** Enlace para corregir fechas (se omite cuando ya estamos en el carrito). */
  editHref?: string | null;
  className?: string;
}

/**
 * Aviso de choque de fechas (HU-B.A5). Bloquea el pago hasta cambiar un tour o confirmar
 * explícitamente que las fechas son correctas (p. ej. dos grupos distintos viajando).
 */
export function TripConflictAlert({ lines, editHref = "/es/carrito", className }: TripConflictAlertProps) {
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
        Estos tours se superponen
      </h2>
      <ul className="mt-2 space-y-2 text-sm">
        {pending.map((conflict) => (
          <li key={conflict.signature}>
            {conflict.items.map((it) => `${it.line.title} (${formatDate(it.start)}${it.days > 1 ? `, ${it.days} días` : ""})`).join(" y ")}
            {conflict.dates.length ? ` coinciden el ${conflict.dates.map(formatDate).join(", ")}.` : "."}
          </li>
        ))}
      </ul>
      <p className="mt-2 text-sm">Cambia la fecha de uno de ellos o confirma que es correcto (por ejemplo, si viajan grupos distintos).</p>
      <div className="mt-3 flex flex-wrap gap-2">
        {editHref ? (
          <Link href={editHref} className={buttonClass("secondary", "md")}>
            Cambiar fechas
          </Link>
        ) : null}
        <button
          type="button"
          className={buttonClass("outline", "md")}
          onClick={() => {
            acknowledgeAll();
            announce("Confirmaste las fechas. Ya puedes continuar con la reserva.");
          }}
        >
          <Check aria-hidden size={16} strokeWidth={1.5} />
          Las fechas son correctas
        </button>
      </div>
    </section>
  );
}
