"use server";

import { z } from "zod";

import { ApiError, apiJson } from "@/lib/api/client";

export type UnsubscribeResult = { ok: true; revoked: string[]; alreadyRevoked: string[] } | { ok: false; message: string };

const schema = z.object({
  token: z.string().min(20).max(1024),
  purposes: z.array(z.enum(["marketing_email", "marketing_whatsapp"])).max(2),
});

/**
 * Baja de comunicaciones comerciales (Ley 29733, art. 10.4 / 26.5 del Reglamento): gratuita,
 * inmediata y sin cuenta. El token firmado (HMAC) viaja al servidor de Next y de ahí a la API;
 * Next ya rechaza Server Actions de otro origen (Origin vs Host).
 */
export async function unsubscribeAction(_prev: UnsubscribeResult | null, formData: FormData): Promise<UnsubscribeResult> {
  const parsed = schema.safeParse({ token: formData.get("token"), purposes: formData.getAll("purposes") });
  if (!parsed.success) return { ok: false, message: "El enlace no es válido. Usa el enlace más reciente de nuestros correos." };
  if (parsed.data.purposes.length === 0) return { ok: false, message: "Marca al menos un canal para darte de baja." };
  try {
    const res = await apiJson<{ data: { revoked: string[]; alreadyRevoked: string[] } }>("/privacy/unsubscribe", {
      method: "POST",
      body: { token: parsed.data.token, purposes: parsed.data.purposes },
    });
    return { ok: true, ...res.data };
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) return { ok: false, message: "El enlace de baja no es válido o fue modificado. Usa el enlace más reciente de nuestros correos." };
    if (error instanceof ApiError && error.status === 429) return { ok: false, message: "Hiciste varios intentos seguidos. Espera un minuto e inténtalo de nuevo." };
    return { ok: false, message: "No pudimos procesar la baja en este momento. Intenta de nuevo en unos minutos o escríbenos." };
  }
}
