"use client";

import { CalendarPlus } from "lucide-react";

import { absoluteUrl } from "@/lib/site";
import { buildIcs, downloadIcs, PICKUP_PENDING } from "@/lib/trip/ics";
import { useUiStore } from "@/stores/ui-store";
import { buttonClass } from "@/components/ui/button-styles";

interface VoucherCalendarButtonProps {
  code: string;
  items: { id: string; title: string; date: string; pax: number }[];
}

/** .ics de la reserva (HU-B.A5/A2): código y tours, sin datos personales. */
export function VoucherCalendarButton({ code, items }: VoucherCalendarButtonProps) {
  const announce = useUiStore((s) => s.announce);
  return (
    <button
      type="button"
      className={buttonClass("outline", "md")}
      onClick={() => {
        const ics = buildIcs(
          items.map((item) => ({
            uid: `${code}-${item.id}@peruwonderstours.com`,
            title: `${item.title} · Reserva ${code}`,
            date: item.date,
            days: 1,
            description: [`Reserva ${code} · ${item.pax} ${item.pax === 1 ? "viajero" : "viajeros"}.`, PICKUP_PENDING].join("\n"),
            url: absoluteUrl(`/es/reserva/${code}`),
          })),
          { name: `Reserva ${code} · Peru Wonders Tours` },
        );
        downloadIcs(ics, `reserva-${code}.ics`);
        announce("Descargamos el calendario de tu reserva.");
      }}
    >
      <CalendarPlus aria-hidden size={18} strokeWidth={1.5} />
      Añadir al calendario
    </button>
  );
}
