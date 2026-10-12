"use server";

import { getTranslations } from "next-intl/server";
import { z } from "zod";

import { ApiError, apiJson } from "@/lib/api/client";
import { requestLocale } from "@/lib/i18n/request-locale";

export type ConfirmResult = { ok: true; confirmed: string[]; alreadyConfirmed: string[]; notPending: string[] } | { ok: false; message: string };

/**
 * Doble opt-in de marketing (H-05, Ley 29733): el titular confirma desde su correo lo que marcó en el
 * checkout. Se confirma con un clic explícito (POST), nunca al abrir el enlace (los antivirus de correo
 * abren enlaces automáticamente). Mensajes en el idioma de la página.
 */
export async function confirmMarketingAction(_prev: ConfirmResult | null, formData: FormData): Promise<ConfirmResult> {
  const t = await getTranslations({ locale: await requestLocale(), namespace: "privacy.confirm" });
  const token = z.string().min(20).max(1024).safeParse(formData.get("token"));
  if (!token.success) return { ok: false, message: t("errors.invalidLink") };
  try {
    const res = await apiJson<{ data: { confirmed: string[]; alreadyConfirmed: string[]; notPending: string[] } }>("/privacy/marketing-confirmation", {
      method: "POST",
      body: { token: token.data },
    });
    return { ok: true, ...res.data };
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) return { ok: false, message: t("errors.expired") };
    if (error instanceof ApiError && error.status === 429) return { ok: false, message: t("errors.busy") };
    return { ok: false, message: t("errors.unavailable") };
  }
}
