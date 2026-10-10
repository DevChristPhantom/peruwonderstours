"use server";

import { z } from "zod";

import { ApiError, apiJson } from "@/lib/api/client";

export type ConfirmResult = { ok: true; confirmed: string[]; alreadyConfirmed: string[]; notPending: string[] } | { ok: false; message: string };

/**
 * Doble opt-in de marketing (H-05, Ley 29733): el titular confirma desde su correo lo que marcó en el
 * checkout. Se confirma con un clic explícito (POST), nunca al abrir el enlace (los antivirus de correo
 * abren enlaces automáticamente).
 */
export async function confirmMarketingAction(_prev: ConfirmResult | null, formData: FormData): Promise<ConfirmResult> {
  const token = z.string().min(20).max(1024).safeParse(formData.get("token"));
  if (!token.success) return { ok: false, message: "El enlace no es válido. Usa el enlace más reciente de nuestro correo." };
  try {
    const res = await apiJson<{ data: { confirmed: string[]; alreadyConfirmed: string[]; notPending: string[] } }>("/privacy/marketing-confirmation", {
      method: "POST",
      body: { token: token.data },
    });
    return { ok: true, ...res.data };
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) return { ok: false, message: "El enlace venció (7 días) o no es válido. Puedes volver a suscribirte en tu próxima reserva." };
    if (error instanceof ApiError && error.status === 429) return { ok: false, message: "Hiciste varios intentos seguidos. Espera un minuto e inténtalo de nuevo." };
    return { ok: false, message: "No pudimos confirmar en este momento. Intenta de nuevo en unos minutos." };
  }
}
