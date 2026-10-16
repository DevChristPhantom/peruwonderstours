import { z } from "zod";

import { parseTags, TRANSLATION_STATUS_VALUES } from "@/lib/content";

/**
 * Validación de los formularios de contenido (Sprint 3). Espejo de los DTO de la API
 * (`content-admin.dto.ts`); la API vuelve a validar todo.
 */
const SLUG = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const slug = (max: number) => z.string().trim().regex(SLUG, "Solo minúsculas, números y guiones (sin espacios ni tildes).").max(max, `Máximo ${max} caracteres.`);
const optText = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `Máximo ${max} caracteres.`)
    .default("")
    .transform((v) => v || null);
const coverKey = z
  .string()
  .trim()
  .max(2000)
  .default("")
  .refine((v) => !/^\s*(javascript|data):/i.test(v), "Imagen inválida.")
  .transform((v) => v || null);
const translationStatus = z
  .enum(["", ...TRANSLATION_STATUS_VALUES])
  .default("")
  .transform((v) => (v ? v : null));
const sortOrder = z.coerce.number().int("Entero.").min(0, "Mínimo 0.").max(10_000, "Máximo 10 000.");

/* ---------------------------------------------------------------- Destinos y categorías */
export const taxonomyGeneralSchema = z.object({
  slug: slug(120),
  sortOrder,
  coverStorageKey: coverKey,
  status: z.enum(["draft", "published"]).optional(),
  parentId: z
    .string()
    .trim()
    .default("")
    .refine((v) => !v || /^[0-9a-f-]{36}$/i.test(v), "Destino inválido.")
    .transform((v) => v || null),
});

export const taxonomyCreateSchema = taxonomyGeneralSchema.extend({
  name: z.string().trim().min(1, "Obligatorio.").max(160),
  description: optText(20_000),
  seoTitle: optText(70),
  seoDescription: optText(170),
});

export const taxonomyTranslationSchema = z.object({
  name: z.string().trim().min(1, "Obligatorio.").max(160),
  description: optText(20_000),
  slug: z
    .string()
    .trim()
    .default("")
    .refine((v) => !v || (SLUG.test(v) && v.length <= 160), "Solo minúsculas, números y guiones.")
    .transform((v) => v || null),
  seoTitle: optText(70),
  seoDescription: optText(170),
  translationStatus,
});

/* ---------------------------------------------------------------- Blog */
const tags = z
  .string()
  .default("")
  .transform((v) => parseTags(v));

export const blogTranslationSchema = z.object({
  slug: slug(160),
  title: z.string().trim().min(1, "Obligatorio.").max(200),
  excerpt: optText(400),
  body: z.string().min(1, "Obligatorio.").max(200_000),
  seoTitle: optText(70),
  seoDescription: optText(170),
  translationStatus,
});

export const blogCreateSchema = z.object({
  coverStorageKey: coverKey,
  tags,
  translation: blogTranslationSchema.omit({ translationStatus: true }),
});

export const blogGeneralSchema = z.object({ coverStorageKey: coverKey, tags });

/* ---------------------------------------------------------------- Testimonios */
export const testimonialEditSchema = z.object({
  authorName: z.string().trim().min(2, "Mínimo 2 caracteres.").max(120),
  authorCountry: z
    .string()
    .trim()
    .default("")
    .refine((v) => !v || /^[A-Za-z]{2}$/.test(v), "Código de país de 2 letras (PE, US…).")
    .transform((v) => (v ? v.toUpperCase() : null)),
  body: z.string().trim().min(20, "Mínimo 20 caracteres.").max(3000),
  rating: z.coerce.number().int().min(1, "De 1 a 5.").max(5, "De 1 a 5."),
  locale: z.enum(["es", "en", "pt"]),
});

export const moderationNoteSchema = z.object({ note: optText(500) });
export const rejectNoteSchema = z.object({ note: z.string().trim().min(3, "Explica el motivo (mín. 3 caracteres).").max(500) });

/* ---------------------------------------------------------------- Contacto */
export const contactStatusSchema = z.object({
  status: z.enum(["new", "answered", "archived"], { error: "Elige el nuevo estado." }),
  internalNote: z.string().trim().max(2000, "Máximo 2000 caracteres.").default(""),
});

/* ---------------------------------------------------------------- Pagos manuales */
export const voidPaymentSchema = z.object({
  reason: z.string().trim().min(5, "Explica el motivo (mínimo 5 caracteres).").max(500, "Máximo 500 caracteres."),
});

/** FormData → objeto plano de strings (los checkbox llegan como "on"). */
export function formObject(fd: FormData, keys: readonly string[]): Record<string, string | undefined> {
  const out: Record<string, string | undefined> = {};
  for (const k of keys) {
    const v = fd.get(k);
    out[k] = typeof v === "string" ? v : undefined;
  }
  return out;
}

/** Error de validación con mensajes por campo, en el formato de `ActionResult`. */
export function invalidResult(error: z.ZodError) {
  return {
    ok: false as const,
    error: { code: "validation-failed", message: "Revisa los campos indicados.", fields: Object.fromEntries(error.issues.map((i) => [i.path.join("."), i.message])) },
  };
}
