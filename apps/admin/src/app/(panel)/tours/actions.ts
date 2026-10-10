"use server";

import { redirect } from "next/navigation";
import type { z } from "zod";

import { apiData } from "@/lib/api/client";
import type { TourDetail } from "@/lib/api/types";
import { action, type ActionResult } from "@/lib/auth/guard";
import { createTourSchema, mediaSchema, tourFieldsSchema, translationSchema, type TourFieldsInput, type TranslationFormInput } from "@/lib/schemas/tours";

const UUID = /^[0-9a-f-]{36}$/i;

function invalid(error: z.ZodError): ActionResult<never> {
  return {
    ok: false,
    error: { code: "validation-failed", message: "Revisa los campos indicados.", fields: Object.fromEntries(error.issues.map((i) => [i.path.join("."), i.message])) },
  };
}

function tourPath(id: string, suffix = ""): string {
  if (!UUID.test(id)) throw new Error("Id de tour inválido");
  return `/admin/tours/${id}${suffix}`;
}

const str = (fd: FormData, k: string) => String(fd.get(k) ?? "");

export async function createTourAction(_prev: unknown, fd: FormData) {
  const parsed = createTourSchema.safeParse({
    type: str(fd, "type"),
    code: str(fd, "code").toUpperCase(),
    slug: str(fd, "slug"),
    durationDays: str(fd, "durationDays"),
    durationNights: str(fd, "durationNights"),
    durationHours: str(fd, "durationHours"),
    minPax: str(fd, "minPax") || "1",
  });
  if (!parsed.success) return invalid(parsed.error);
  const result = await action(() => apiData<TourDetail>("/admin/tours", { method: "POST", body: parsed.data }));
  if (!result.ok) return result;
  redirect(`/tours/${result.data.id}`);
}

export async function updateTourAction(id: string, version: number, input: TourFieldsInput) {
  const parsed = tourFieldsSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  return action(() => apiData<TourDetail>(tourPath(id), { method: "PATCH", body: { ...parsed.data, version } }).then((t) => ({ version: t.version })));
}

export async function saveTranslationAction(id: string, version: number, locale: "es" | "en", input: TranslationFormInput) {
  if (locale !== "es" && locale !== "en") throw new Error("Idioma inválido");
  const parsed = translationSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  return action(() => apiData<TourDetail>(tourPath(id, `/translations/${locale}`), { method: "PUT", body: { ...parsed.data, version } }).then((t) => ({ version: t.version })));
}

export async function deleteTranslationAction(id: string, version: number, _prev: unknown, _fd: FormData) {
  return action(() => apiData<TourDetail>(tourPath(id, "/translations/en"), { method: "DELETE", body: { version } }).then(() => null), {
    message: "Traducción al inglés eliminada.",
  });
}

export async function publishTourAction(id: string, version: number, publish: boolean, _prev: unknown, _fd: FormData) {
  return action(() => apiData<TourDetail>(tourPath(id, publish ? "/publish" : "/unpublish"), { method: "POST", body: { version } }).then((t) => ({ status: t.status })), {
    message: publish ? "Tour publicado: ya aparece en el sitio." : "Tour despublicado: ya no aparece en el sitio.",
  });
}

export async function addMediaAction(id: string, version: number, _prev: unknown, fd: FormData) {
  const parsed = mediaSchema.safeParse({ storageKey: str(fd, "storageKey"), altEs: str(fd, "altEs"), isCover: fd.get("isCover") === "on" });
  if (!parsed.success) return invalid(parsed.error);
  return action(() => apiData<TourDetail>(tourPath(id, "/media"), { method: "POST", body: { ...parsed.data, kind: "image", version } }).then(() => null), {
    message: "Imagen agregada.",
  });
}

export async function setCoverAction(id: string, version: number, mediaId: string, _prev: unknown, _fd: FormData) {
  if (!UUID.test(mediaId)) throw new Error("Id de medio inválido");
  return action(() => apiData<TourDetail>(tourPath(id, `/media/${mediaId}`), { method: "PATCH", body: { isCover: true, version } }).then(() => null));
}

export async function deleteMediaAction(id: string, version: number, mediaId: string, _prev: unknown, _fd: FormData) {
  if (!UUID.test(mediaId)) throw new Error("Id de medio inválido");
  return action(() => apiData<TourDetail>(tourPath(id, `/media/${mediaId}`), { method: "DELETE", body: { version } }).then(() => null));
}
