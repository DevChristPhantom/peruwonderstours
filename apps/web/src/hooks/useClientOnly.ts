"use client";

import { useSyncExternalStore } from "react";

import { todayInLima } from "@/lib/format";

const subscribeNoop = () => () => {};

/** true solo en el cliente tras hidratar (false en el HTML del servidor): evita desalinear la hidratación. */
export function useIsClient(): boolean {
  return useSyncExternalStore(subscribeNoop, () => true, () => false);
}

/** Fecha de hoy en Lima según el reloj del visitante; null durante el render del servidor. */
export function useLimaToday(): string | null {
  return useSyncExternalStore(subscribeNoop, () => todayInLima(), () => null);
}
