import "server-only";

import type { Locale } from "@/i18n/routing";

import { apiRequest } from "./client";

/** Revisión vigente de las Políticas de reserva, pago y cancelación (PWT-LEG-001), editable en el panel. */
export interface BookingPolicyRevision {
  version: string;
  revision: number;
  locale: Locale;
  title: string;
  body: string;
  updatedAt: string;
}

/**
 * `fresh`: sin caché (checkout: el cliente debe aceptar la versión vigente). Sin `fresh` se cachea
 * 1 h con el tag `booking-policy`, que el panel invalida al guardar una revisión nueva.
 */
export async function getBookingPolicy(locale: Locale, options: { fresh?: boolean } = {}): Promise<BookingPolicyRevision | null> {
  try {
    const res = await apiRequest<{ data: BookingPolicyRevision }>(
      `/booking-policy?locale=${locale}`,
      options.fresh ? { nullOn404: true } : { nullOn404: true, next: { revalidate: 3600, tags: ["booking-policy"] } },
    );
    return res?.body.data ?? null;
  } catch {
    return null;
  }
}
