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
}

export type CartLineInput = Omit<CartLine, "id" | "addedAt">;

export function cartLineId(tourSlug: string, date: string): string {
  return `${tourSlug}__${date}`;
}

export function travelerCount(t: Travelers): number {
  return t.adults + t.children + t.infants;
}

export function describeTravelers(t: Travelers): string {
  const parts: string[] = [];
  if (t.adults) parts.push(`${t.adults} ${t.adults === 1 ? "adulto" : "adultos"}`);
  if (t.children) parts.push(`${t.children} ${t.children === 1 ? "niño" : "niños"}`);
  if (t.infants) parts.push(`${t.infants} ${t.infants === 1 ? "bebé" : "bebés"}`);
  return parts.join(", ") || "Sin viajeros";
}
