"use client";

import { useLocale } from "next-intl";
import { useCallback, useSyncExternalStore } from "react";

import type { TourPricing } from "@/lib/catalog/types";

/**
 * Regla comercial (cliente, 2026-11-15): residentes en el Perú → soles (tarifa nacional);
 * extranjeros → dólares (tarifa extranjera). Aquí solo se elige QUÉ PRECIO MOSTRAR; lo que se
 * cobra lo decide el país del checkout (`residencyFor` en checkout-service).
 *
 * Preferencia en localStorage (`pwt-residency`). Sin elección: español → residente; inglés y
 * portugués → extranjero.
 */
export type PriceResidency = "national" | "foreign";

const STORAGE_KEY = "pwt-residency";
const listeners = new Set<() => void>();
/** Respaldo en memoria si el navegador bloquea localStorage (navegación privada estricta). */
let memory: PriceResidency | null = null;

function stored(): PriceResidency | null {
  try {
    const value = localStorage.getItem(STORAGE_KEY);
    return value === "national" || value === "foreign" ? value : memory;
  } catch {
    return memory;
  }
}

function subscribe(listener: () => void): () => void {
  const onStorage = (e: StorageEvent) => e.key === STORAGE_KEY && listener();
  listeners.add(listener);
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}

export function defaultResidency(locale: string): PriceResidency {
  return locale === "es" ? "national" : "foreign";
}

/** [residencia elegida, cambiarla]. En el servidor y al hidratar usa el valor por idioma. */
export function usePriceResidency(): [PriceResidency, (value: PriceResidency) => void] {
  const fallback = defaultResidency(useLocale());
  const value = useSyncExternalStore(subscribe, () => stored() ?? fallback, () => fallback);
  const set = useCallback((next: PriceResidency) => {
    memory = next;
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // Sin almacenamiento: la elección dura solo mientras no se recargue.
    }
    listeners.forEach((listener) => listener());
  }, []);
  return [value, set];
}

/** Precio a mostrar para la residencia elegida (si no existe, el otro: mejor un precio que ninguno). */
export function pricingFor(
  residency: PriceResidency,
  national: TourPricing | null,
  foreign: TourPricing | null,
): { pricing: TourPricing | null; other: TourPricing | null; shown: PriceResidency } {
  const preferred = residency === "national" ? national : foreign;
  const other = residency === "national" ? foreign : national;
  if (preferred) return { pricing: preferred, other, shown: residency };
  return { pricing: other, other: null, shown: residency === "national" ? "foreign" : "national" };
}
