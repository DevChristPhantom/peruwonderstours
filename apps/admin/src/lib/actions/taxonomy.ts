"use server";

import { redirect } from "next/navigation";

import { apiData } from "@/lib/api/client";
import type { ContentLocale, TaxonomyItem, TaxonomyKind, TaxonomyTranslation } from "@/lib/api/content-types";
import { action } from "@/lib/auth/guard";
import { formObject, invalidResult, taxonomyCreateSchema, taxonomyGeneralSchema, taxonomyTranslationSchema } from "@/lib/schemas/content";
import { taxonomyConfig, UUID_RE } from "@/lib/taxonomy";

/** Server Actions de destinos y categorías (mismo contrato en la API). Escrituras con `version`. */

function itemPath(kind: TaxonomyKind, id: string, suffix = ""): string {
  if (!UUID_RE.test(id)) throw new Error("Id inválido");
  return `${taxonomyConfig(kind).apiPath}/${id}${suffix}`;
}

function assertLocale(locale: string): ContentLocale {
  if (locale !== "es" && locale !== "en" && locale !== "pt") throw new Error("Idioma inválido");
  return locale;
}

const GENERAL_KEYS = ["slug", "sortOrder", "coverStorageKey", "status", "parentId"] as const;

export async function createTaxonomyAction(kind: TaxonomyKind, _prev: unknown, fd: FormData) {
  const cfg = taxonomyConfig(kind);
  const parsed = taxonomyCreateSchema.safeParse(formObject(fd, [...GENERAL_KEYS, "name", "description", "seoTitle", "seoDescription"]));
  if (!parsed.success) return invalidResult(parsed.error);
  const v = parsed.data;
  const result = await action(() =>
    apiData<TaxonomyItem>(cfg.apiPath, {
      method: "POST",
      body: {
        slug: v.slug,
        sortOrder: v.sortOrder,
        coverStorageKey: v.coverStorageKey,
        ...(kind === "destination" ? { status: v.status ?? "draft", parentId: v.parentId } : {}),
        translation: { name: v.name, description: v.description, ...(kind === "destination" ? { seoTitle: v.seoTitle, seoDescription: v.seoDescription } : {}) },
      },
    }),
  );
  if (!result.ok) return result;
  redirect(`${cfg.route}/${result.data.id}`);
}

export async function updateTaxonomyAction(kind: TaxonomyKind, id: string, version: number, _prev: unknown, fd: FormData) {
  const parsed = taxonomyGeneralSchema.safeParse(formObject(fd, GENERAL_KEYS));
  if (!parsed.success) return invalidResult(parsed.error);
  const v = parsed.data;
  const body = { version, slug: v.slug, sortOrder: v.sortOrder, coverStorageKey: v.coverStorageKey, ...(kind === "destination" ? { status: v.status, parentId: v.parentId } : {}) };
  return action(() => apiData<TaxonomyItem>(itemPath(kind, id), { method: "PATCH", body }).then((t) => ({ version: t.version })), { message: "Cambios guardados." });
}

export async function saveTaxonomyTranslationAction(kind: TaxonomyKind, id: string, version: number, locale: string, _prev: unknown, fd: FormData) {
  const loc = assertLocale(locale);
  const parsed = taxonomyTranslationSchema.safeParse(formObject(fd, ["name", "description", "slug", "seoTitle", "seoDescription", "translationStatus"]));
  if (!parsed.success) return invalidResult(parsed.error);
  const v = parsed.data;
  const body = {
    version,
    name: v.name,
    description: v.description,
    slug: loc === "es" ? null : v.slug,
    translationStatus: v.translationStatus,
    ...(kind === "destination" ? { seoTitle: v.seoTitle, seoDescription: v.seoDescription } : {}),
  };
  return action(() => apiData<TaxonomyItem>(itemPath(kind, id, `/translations/${loc}`), { method: "PUT", body }).then(() => null), { message: "Traducción guardada." });
}

/** "Marcar como revisada": reenvía la traducción vigente con `translationStatus = client_approved`. */
export async function markTaxonomyReviewedAction(kind: TaxonomyKind, id: string, version: number, t: TaxonomyTranslation, _prev: unknown, _fd: FormData) {
  const loc = assertLocale(t.locale);
  const body = {
    version,
    name: t.name,
    description: t.description,
    slug: loc === "es" ? null : t.slug,
    translationStatus: "client_approved",
    ...(kind === "destination" ? { seoTitle: t.seoTitle, seoDescription: t.seoDescription } : {}),
  };
  return action(() => apiData<TaxonomyItem>(itemPath(kind, id, `/translations/${loc}`), { method: "PUT", body }).then(() => null), { message: "Traducción marcada como revisada." });
}

export async function deleteTaxonomyTranslationAction(kind: TaxonomyKind, id: string, version: number, locale: string, _prev: unknown, _fd: FormData) {
  const loc = assertLocale(locale);
  if (loc === "es") throw new Error("La traducción en español es obligatoria");
  return action(() => apiData<TaxonomyItem>(itemPath(kind, id, `/translations/${loc}`), { method: "DELETE", body: { version } }).then(() => null), {
    message: "Traducción eliminada.",
  });
}

export async function deleteTaxonomyAction(kind: TaxonomyKind, id: string, version: number, _prev: unknown, _fd: FormData) {
  const cfg = taxonomyConfig(kind);
  const result = await action(() => apiData<null>(itemPath(kind, id), { method: "DELETE", body: { version } }));
  if (!result.ok) return result;
  redirect(`${cfg.route}?eliminado=1`);
}

/** Reordenar (subir/bajar): envía el orden completo en pasos de 10. */
export async function reorderTaxonomyAction(kind: TaxonomyKind, order: { id: string; sortOrder: number }[], _prev: unknown, _fd: FormData) {
  const cfg = taxonomyConfig(kind);
  if (order.length > 500 || order.some((o) => !UUID_RE.test(o.id) || !Number.isInteger(o.sortOrder) || o.sortOrder < 0 || o.sortOrder > 10_000)) throw new Error("Orden inválido");
  return action(() => apiData<TaxonomyItem[]>(`${cfg.apiPath}/reorder`, { method: "POST", body: { items: order } }).then(() => null));
}
