"use server";

import { apiData } from "@/lib/api/client";
import { action } from "@/lib/auth/guard";

const LOCALES = ["es", "en", "pt"] as const;

/**
 * Guarda una revisión NUEVA de las Políticas de reserva, pago y cancelación (la API nunca modifica
 * revisiones anteriores). `expectedRevision` evita pisar los cambios de otra persona.
 */
export async function saveBookingPolicyAction(expectedRevision: number, _prev: unknown, fd: FormData) {
  const translations = Object.fromEntries(
    LOCALES.map((locale) => [locale, { title: String(fd.get(`${locale}.title`) ?? ""), body: String(fd.get(`${locale}.body`) ?? "") }]),
  );
  return action(
    () => apiData<{ version: string }>("/admin/booking-policy", { method: "PUT", body: { expectedRevision, translations } }).then(() => null),
    { message: "Borrador guardado. Puedes revisarlo y publicarlo cuando esté listo." },
  );
}

export async function publishBookingPolicyAction(expectedRevision: number) {
  return action(
    () => apiData<{ version: string }>("/admin/booking-policy/publish", { method: "POST", body: { expectedRevision } }).then(() => null),
    { message: "Políticas publicadas. Las reservas anteriores conservan la versión que aceptaron." },
  );
}
