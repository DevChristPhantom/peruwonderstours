"use server";

import { redirect } from "next/navigation";

import { apiData } from "@/lib/api/client";
import type { Promotion } from "@/lib/api/content-types";
import { action } from "@/lib/auth/guard";
import { formObject, invalidResult } from "@/lib/schemas/content";
import { promotionCreateSchema, promotionFieldsSchema, promotionTranslationSchema } from "@/lib/schemas/promotions";

const UUID = /^[0-9a-f-]{36}$/i;
const TR_KEYS = ["title", "eyebrow", "summary", "ctaLabel", "whatsappMessage", "translationStatus"] as const;
const FIELD_KEYS = ["showFrom", "showUntil", "eventStartsOn", "eventEndsOn", "coverStorageKey", "ctaKind", "tourId", "ctaPath", "sortOrder"] as const;

function promotionPath(id: string, suffix = ""): string {
  if (!UUID.test(id)) throw new Error("Id de evento inválido");
  return `/admin/promotions/${id}${suffix}`;
}

function assertLocale(locale: string): "es" | "en" | "pt" {
  if (locale !== "es" && locale !== "en" && locale !== "pt") throw new Error("Idioma inválido");
  return locale;
}

function fieldsFrom(fd: FormData) {
  return promotionFieldsSchema.safeParse({ ...formObject(fd, FIELD_KEYS), showPopup: fd.get("showPopup") === "on" });
}

/** Alta en borrador: texto en español + configuración (fechas, botón, anuncio emergente). */
export async function createPromotionAction(_prev: unknown, fd: FormData) {
  const translation = promotionCreateSchema.safeParse(formObject(fd, TR_KEYS));
  const fields = fieldsFrom(fd);
  if (!translation.success) return invalidResult(translation.error);
  if (!fields.success) return invalidResult(fields.error);
  const result = await action(() => apiData<Promotion>("/admin/promotions", { method: "POST", body: { ...fields.data, translation: translation.data } }));
  if (!result.ok) return result;
  redirect(`/eventos/${result.data.id}`);
}

export async function updatePromotionAction(id: string, version: number, _prev: unknown, fd: FormData) {
  const parsed = fieldsFrom(fd);
  if (!parsed.success) return invalidResult(parsed.error);
  return action(() => apiData<Promotion>(promotionPath(id), { method: "PATCH", body: { version, ...parsed.data } }).then(() => null), {
    message: "Cambios guardados. La portada del sitio ya se actualizó.",
  });
}

export async function savePromotionTranslationAction(id: string, version: number, locale: string, _prev: unknown, fd: FormData) {
  const loc = assertLocale(locale);
  const parsed = promotionTranslationSchema.safeParse(formObject(fd, TR_KEYS));
  if (!parsed.success) return invalidResult(parsed.error);
  return action(() => apiData<Promotion>(promotionPath(id, `/translations/${loc}`), { method: "PUT", body: { version, ...parsed.data } }).then(() => null), {
    message: "Texto guardado.",
  });
}

export async function deletePromotionTranslationAction(id: string, version: number, locale: "en" | "pt", _prev: unknown, _fd: FormData) {
  return action(() => apiData<Promotion>(promotionPath(id, `/translations/${assertLocale(locale)}`), { method: "DELETE", body: { version } }).then(() => null), {
    message: "Traducción eliminada.",
  });
}

const STATUS_MESSAGES = {
  publish: "Evento publicado: ya aparece en «Lo más relevante» (y como anuncio si lo marcaste).",
  unpublish: "Evento despublicado: dejó de verse en el sitio.",
  archive: "Evento eliminado.",
} as const;

export async function changePromotionStatusAction(id: string, version: number, op: keyof typeof STATUS_MESSAGES, _prev: unknown, _fd: FormData) {
  if (!(op in STATUS_MESSAGES)) throw new Error("Operación inválida");
  const result = await action(() => apiData<Promotion | null>(promotionPath(id, `/${op}`), { method: "POST", body: { version } }).then(() => null), {
    message: STATUS_MESSAGES[op],
  });
  if (result.ok && op === "archive") redirect("/eventos");
  return result;
}
