"use server";

import { redirect } from "next/navigation";

import { apiData } from "@/lib/api/client";
import type { BlogPost, BlogTranslation } from "@/lib/api/content-types";
import { action } from "@/lib/auth/guard";
import { blogCreateSchema, blogGeneralSchema, blogTranslationSchema, formObject, invalidResult } from "@/lib/schemas/content";

const UUID = /^[0-9a-f-]{36}$/i;
const TR_KEYS = ["slug", "title", "excerpt", "body", "seoTitle", "seoDescription", "translationStatus"] as const;

function postPath(id: string, suffix = ""): string {
  if (!UUID.test(id)) throw new Error("Id de artículo inválido");
  return `/admin/blog-posts/${id}${suffix}`;
}

function assertLocale(locale: string): "es" | "en" {
  if (locale !== "es" && locale !== "en") throw new Error("Idioma inválido");
  return locale;
}

export async function createBlogPostAction(_prev: unknown, fd: FormData) {
  const raw = formObject(fd, ["coverStorageKey", "tags", ...TR_KEYS]);
  const parsed = blogCreateSchema.safeParse({ coverStorageKey: raw.coverStorageKey, tags: raw.tags, translation: raw });
  if (!parsed.success) {
    // Los errores de `translation.x` se muestran junto al campo `x`.
    const r = invalidResult(parsed.error);
    r.error.fields = Object.fromEntries(Object.entries(r.error.fields).map(([k, v]) => [k.replace(/^translation\./, ""), v]));
    return r;
  }
  const result = await action(() => apiData<BlogPost>("/admin/blog-posts", { method: "POST", body: parsed.data }));
  if (!result.ok) return result;
  redirect(`/blog/${result.data.id}`);
}

export async function updateBlogPostAction(id: string, version: number, _prev: unknown, fd: FormData) {
  const parsed = blogGeneralSchema.safeParse(formObject(fd, ["coverStorageKey", "tags"]));
  if (!parsed.success) return invalidResult(parsed.error);
  return action(() => apiData<BlogPost>(postPath(id), { method: "PATCH", body: { version, ...parsed.data } }).then(() => null), { message: "Cambios guardados." });
}

export async function saveBlogTranslationAction(id: string, version: number, locale: string, _prev: unknown, fd: FormData) {
  const loc = assertLocale(locale);
  const parsed = blogTranslationSchema.safeParse(formObject(fd, TR_KEYS));
  if (!parsed.success) return invalidResult(parsed.error);
  return action(() => apiData<BlogPost>(postPath(id, `/translations/${loc}`), { method: "PUT", body: { version, ...parsed.data } }).then(() => null), {
    message: "Traducción guardada.",
  });
}

/** "Marcar como revisada": reenvía la traducción vigente con `translationStatus = client_approved`. */
export async function markBlogReviewedAction(id: string, version: number, t: BlogTranslation, _prev: unknown, _fd: FormData) {
  const loc = assertLocale(t.locale);
  const body = { version, slug: t.slug, title: t.title, excerpt: t.excerpt, body: t.body, seoTitle: t.seoTitle, seoDescription: t.seoDescription, translationStatus: "client_approved" };
  return action(() => apiData<BlogPost>(postPath(id, `/translations/${loc}`), { method: "PUT", body }).then(() => null), { message: "Traducción marcada como revisada." });
}

export async function deleteBlogTranslationAction(id: string, version: number, _prev: unknown, _fd: FormData) {
  return action(() => apiData<BlogPost>(postPath(id, "/translations/en"), { method: "DELETE", body: { version } }).then(() => null), { message: "Traducción al inglés eliminada." });
}

const STATUS_MESSAGES = {
  publish: "Artículo publicado: ya aparece en el blog.",
  unpublish: "Artículo despublicado: volvió a borrador.",
  archive: "Artículo archivado.",
} as const;

export async function changeBlogStatusAction(id: string, version: number, op: keyof typeof STATUS_MESSAGES, _prev: unknown, _fd: FormData) {
  if (!(op in STATUS_MESSAGES)) throw new Error("Operación inválida");
  const result = await action(() => apiData<BlogPost | null>(postPath(id, `/${op}`), { method: "POST", body: { version } }).then(() => null), { message: STATUS_MESSAGES[op] });
  if (result.ok && op === "archive") redirect("/blog?status=archived");
  return result;
}
