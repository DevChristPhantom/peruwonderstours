import type { CatalogImage, PaymentPolicy, TourPricing } from "@/lib/catalog/types";

export interface Travelers {
  adults: number;
  children: number;
  infants: number;
}

/**
 * Ítem del carrito. El precio unitario se congela al agregar (RN-12: el backend lo revalida
 * al crear el hold del checkout). `unitPricing: null` = tour sin tarifa → "por cotizar".
 */
export interface CartLine {
  id: string;
  tourSlug: string;
  title: string;
  path: string;
  image: CatalogImage | null;
  destinationLabel: string;
  durationLabel: string;
  /** Fecha de salida `YYYY-MM-DD` (calendario de Lima). */
  date: string;
  travelers: Travelers;
  unitPricing: TourPricing | null;
  paymentPolicy: PaymentPolicy;
  addedAt: string;
  /**
   * Datos para "Mi viaje" (HU-B.A5). Opcionales: los ítems guardados antes de este cambio no los
   * tienen y se deducen de `durationLabel` (ver `lib/trip/itinerary.ts`).
   */
  durationDays?: number | null;
  destinationSlugs?: string[];
  difficulty?: string | null;
}

export type CartLineInput = Omit<CartLine, "id" | "addedAt">;

export function cartLineId(tourSlug: string, date: string): string {
  return `${tourSlug}__${date}`;
}

export function travelerCount(t: Travelers): number {
  return t.adults + t.children + t.infants;
}

