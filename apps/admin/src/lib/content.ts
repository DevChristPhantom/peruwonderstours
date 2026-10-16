/**
 * Etiquetas y utilidades puras del backoffice de contenido (Sprint 3). Con mapa de medios local y sin dependencias de
 * runtime: se prueban con `node --test src/lib/content.test.ts`.
 */
import type { Tone } from "./labels";
import legacyMediaMap from "./legacy-media-map.json" with { type: "json" };

export const TRANSLATION_STATUS_VALUES = ["machine_reviewed_pending_client", "client_approved", "staff_written"] as const;
export type TranslationStatusValue = (typeof TRANSLATION_STATUS_VALUES)[number];

export const TRANSLATION_STATUS: Record<TranslationStatusValue, { label: string; tone: Tone }> = {
  machine_reviewed_pending_client: { label: "Traducción automática pendiente de revisión", tone: "warning" },
  client_approved: { label: "Revisada y aprobada", tone: "success" },
  staff_written: { label: "Redactada por el equipo", tone: "success" },
};

/** Estado de una traducción para la insignia: `null` = revisada por el equipo; `undefined` = no existe. */
export function translationBadge(status: string | null | undefined): { label: string; tone: Tone } {
  if (status === undefined) return { label: "Sin traducción", tone: "neutral" };
  if (status === null) return { label: "Revisada por el equipo", tone: "success" };
  return TRANSLATION_STATUS[status as TranslationStatusValue] ?? { label: status, tone: "neutral" };
}

export function isPendingReview(status: string | null | undefined): boolean {
  return status === "machine_reviewed_pending_client";
}

export const BLOG_STATUS: Record<string, { label: string; tone: Tone }> = {
  draft: { label: "Borrador", tone: "neutral" },
  published: { label: "Publicado", tone: "success" },
  archived: { label: "Archivado", tone: "danger" },
};

export const DESTINATION_STATUS: Record<string, { label: string; tone: Tone }> = {
  draft: { label: "Borrador", tone: "neutral" },
  published: { label: "Publicado", tone: "success" },
};

export const TESTIMONIAL_STATUS: Record<string, { label: string; tone: Tone }> = {
  pending: { label: "Pendiente", tone: "warning" },
  approved: { label: "Aprobado", tone: "success" },
  rejected: { label: "Rechazado", tone: "danger" },
};

export const TESTIMONIAL_ORIGIN: Record<string, string> = { web: "Formulario web", legacy_site: "Sitio anterior", admin: "Ingresado por el equipo" };

export const CONTACT_STATUS: Record<string, { label: string; tone: Tone }> = {
  new: { label: "Nuevo", tone: "warning" },
  answered: { label: "Respondido", tone: "success" },
  archived: { label: "Archivado", tone: "neutral" },
};

/** Transiciones válidas (copia de `canTransitionContact` de la API). */
export function contactTargets(from: string): string[] {
  if (from === "new") return ["answered", "archived"];
  if (from === "answered") return ["archived"];
  if (from === "archived") return ["new"];
  return [];
}

export const CONTACT_ACTION_LABEL: Record<string, string> = {
  answered: "Marcar como respondido",
  archived: "Archivar",
  new: "Reabrir (volver a nuevo)",
};

/** "Cusco, trekking ,, Lima" → ["cusco", "trekking", "lima"] (sin duplicados, máx. 20 de 60 car.). */
export function parseTags(input: string): string[] {
  const out: string[] = [];
  for (const raw of input.split(",")) {
    const tag = raw.trim().toLowerCase().replace(/\s+/g, " ").slice(0, 60);
    if (tag && !out.includes(tag)) out.push(tag);
    if (out.length === 20) break;
  }
  return out;
}

/** Mueve el elemento `index` una posición (`delta` = -1 sube, 1 baja). Devuelve una copia. */
export function moveItem<T>(items: readonly T[], index: number, delta: -1 | 1): T[] {
  const target = index + delta;
  const copy = [...items];
  if (index < 0 || index >= copy.length || target < 0 || target >= copy.length) return copy;
  [copy[index], copy[target]] = [copy[target] as T, copy[index] as T];
  return copy;
}

/** Orden en pasos de 10 (deja huecos para inserciones manuales). */
export function toSortOrders(ids: readonly string[]): { id: string; sortOrder: number }[] {
  return ids.map((id, i) => ({ id, sortOrder: (i + 1) * 10 }));
}

/** Slug sugerido a partir de un título ("Machu Picchu: guía" → "machu-picchu-guia"). */
export function slugify(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 120);
}

/** Clave o URL de medio → URL mostrable. Las URL heredadas usan el archivo propio; otras URL y claves del CMS conservan su origen. */
export function resolveMediaUrl(keyOrUrl: string | null | undefined, base: string, publicWebBase = "https://peruwonderstours.com"): string | null {
  if (!keyOrUrl) return null;
  if (/^https?:\/\//i.test(keyOrUrl)) {
    let old: URL;
    try { old = new URL(keyOrUrl); } catch { return null; }
    if (!["www.andeanperutours.com", "andeanperutours.com", "turinet.turismoads.com"].includes(old.hostname)) return keyOrUrl;
    const key = `${old.hostname.replace(/^www\./, "")}${old.pathname}`;
    const local = (legacyMediaMap as Record<string, string>)[key] ?? "/brand/media-pending.svg";
    return `${publicWebBase.replace(/\/+$/, "")}${local}`;
  }
  if (!/^[A-Za-z0-9][A-Za-z0-9/_.-]{0,500}$/.test(keyOrUrl) || keyOrUrl.includes("..")) return null;
  return `${base.replace(/\/+$/, "")}/${keyOrUrl}`;
}

export const MEDIA_TYPES = ["image/jpeg", "image/png", "image/webp", "image/avif"] as const;
export const MEDIA_MAX_BYTES = 8 * 1024 * 1024;
export const MEDIA_FOLDERS = ["tours", "destinations", "categories", "blog"] as const;
export type MediaFolder = (typeof MEDIA_FOLDERS)[number];

/** Validación previa a la subida (la API vuelve a validar por magic bytes). */
export function checkUpload(file: { type: string; size: number }): string | null {
  if (!(MEDIA_TYPES as readonly string[]).includes(file.type)) return "Formato no admitido. Usa JPEG, PNG, WebP o AVIF.";
  if (file.size <= 0) return "El archivo está vacío.";
  if (file.size > MEDIA_MAX_BYTES) return "La imagen supera el máximo de 8 MB.";
  return null;
}
