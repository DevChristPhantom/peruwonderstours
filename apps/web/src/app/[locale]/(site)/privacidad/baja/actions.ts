"use server";

import { getTranslations } from "next-intl/server";
import { z } from "zod";

import { ApiError, apiJson } from "@/lib/api/client";
import { requestLocale } from "@/lib/i18n/request-locale";

export type UnsubscribeResult = { ok: true; revoked: string[]; alreadyRevoked: string[] } | { ok: false; message: string };

const schema = z.object({
  token: z.string().min(20).max(1024),
  purposes: z.array(z.enum(["marketing_email", "marketing_whatsapp"])).max(2),
});

/**
 * Baja de comunicaciones comerciales (Ley 29733, art. 10.4 / 26.5 del Reglamento): gratuita,
 * inmediata y sin cuenta. El token firmado (HMAC) viaja al servidor de Next y de ahí a la API;
 * Next ya rechaza Server Actions de otro origen (Origin vs Host). Mensajes en el idioma de la página.
 */
export async function unsubscribeAction(_prev: UnsubscribeResult | null, formData: FormData): Promise<UnsubscribeResult> {
  const t = await getTranslations({ locale: await requestLocale(), namespace: "privacy.unsubscribe" });
  const parsed = schema.safeParse({ token: formData.get("token"), purposes: formData.getAll("purposes") });
  if (!parsed.success) return { ok: false, message: t("errors.invalidLink") };
  if (parsed.data.purposes.length === 0) return { ok: false, message: t("errors.noneSelected") };
  try {
    const res = await apiJson<{ data: { revoked: string[]; alreadyRevoked: string[] } }>("/privacy/unsubscribe", {
      method: "POST",
      body: { token: parsed.data.token, purposes: parsed.data.purposes },
    });
    return { ok: true, ...res.data };
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) return { ok: false, message: t("errors.tampered") };
    if (error instanceof ApiError && error.status === 429) return { ok: false, message: t("errors.busy") };
    return { ok: false, message: t("errors.unavailable") };
  }
}
