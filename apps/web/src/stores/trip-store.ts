"use client";

import { useMemo } from "react";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

import type { CartLine } from "@/lib/cart/types";
import { buildTripPlan, type TripConflict } from "@/lib/trip/itinerary";
import { safeSessionStorage } from "./safe-storage";

/**
 * Confirmaciones de choques de fechas (HU-B.A5: "no puede pagar sin cambiar uno o confirmar que es
 * correcto"). Se guarda la firma del choque: si cambian tours o fechas, hay que volver a confirmar.
 * sessionStorage: dura lo que la pestaña, no viaja al servidor.
 */
interface TripState {
  acknowledged: string[];
  acknowledge: (signatures: string[]) => void;
}

export const useTripStore = create<TripState>()(
  persist(
    (set) => ({
      acknowledged: [],
      acknowledge: (signatures) =>
        set((s) => ({ acknowledged: [...new Set([...s.acknowledged, ...signatures])].slice(-50) })),
    }),
    {
      name: "pwt-trip-ack",
      version: 1,
      storage: createJSONStorage(() => safeSessionStorage),
      merge: (persisted, current) => {
        const list = (persisted as { acknowledged?: unknown } | undefined)?.acknowledged;
        return {
          ...current,
          acknowledged: Array.isArray(list) ? list.filter((x): x is string => typeof x === "string").slice(-50) : [],
        };
      },
    },
  ),
);

export interface TripGate {
  /** Choques que bloquean el pago y aún no se confirmaron. */
  pending: TripConflict[];
  acknowledgeAll: () => void;
}

export function useTripGate(lines: readonly CartLine[]): TripGate {
  const acknowledged = useTripStore((s) => s.acknowledged);
  const acknowledge = useTripStore((s) => s.acknowledge);
  const blocking = useMemo(() => buildTripPlan(lines).conflicts.filter((c) => c.blocking), [lines]);
  const pending = blocking.filter((c) => !acknowledged.includes(c.signature));
  return { pending, acknowledgeAll: () => acknowledge(pending.map((c) => c.signature)) };
}
