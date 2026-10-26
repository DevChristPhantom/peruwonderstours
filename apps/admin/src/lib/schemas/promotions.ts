import { z } from "zod";

import { TRANSLATION_STATUS_VALUES } from "@/lib/content";

/**
 * Formularios de Eventos y promociones. Espejo de `promotions.dto.ts` y de las reglas de la API
 * (`assertPromotionRules`); la API y la base vuelven a validar todo.
 */
const DAY = /^\d{4}-\d{2}-\d{2}$/;
/** Ruta interna del sitio en español, sin /es (igual que el CHECK de la base). */
const PATH = /^\/[a-z0-9/_-]*$/;

const optText = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `Máximo ${max} caracteres.`)
    .default("")
    .transform((v) => v || null);
const optDay = z
  .string()
  .trim()
  .default("")
  .refine((v) => !v || DAY.test(v), "Fecha inválida.")
  .transform((v) => v || null);

/** Día de Lima (UTC−5, sin horario de verano) → instante ISO. `end` = fin de ese día (exclusivo). */
export function limaDayToInstant(day: string | null, end = false): string | null {
  if (!day) return null;
  const start = new Date(`${day}T00:00:00-05:00`);
  return new Date(start.getTime() + (end ? 24 * 60 * 60 * 1000 : 0)).toISOString();
}

/** Instante → día de Lima para mostrarlo en un `<input type="date">` (`end`: el día anterior al límite exclusivo). */
export function instantToLimaDay(iso: string | null, end = false): string {
  if (!iso) return "";
  const t = new Date(iso).getTime() - 5 * 60 * 60 * 1000 - (end ? 1 : 0);
  return new Date(t).toISOString().slice(0, 10);
}

export const promotionTranslationSchema = z.object({
  title: z.string().trim().min(3, "Mínimo 3 caracteres.").max(120, "Máximo 120 caracteres."),
  eyebrow: optText(80),
  summary: z.string().trim().min(20, "Mínimo 20 caracteres.").max(400, "Máximo 400 caracteres."),
  ctaLabel: optText(60),
  whatsappMessage: optText(300),
  translationStatus: z
    .enum(["", ...TRANSLATION_STATUS_VALUES])
    .default("")
    .transform((v) => (v ? v : null)),
});

export const promotionFieldsSchema = z
  .object({
    showFrom: optDay,
    showUntil: optDay,
    eventStartsOn: optDay,
    eventEndsOn: optDay,
    coverStorageKey: z
      .string()
      .trim()
      .max(2000)
      .default("")
      .refine((v) => !/^\s*(javascript|data):/i.test(v), "Imagen inválida.")
      .transform((v) => v || null),
    ctaKind: z.enum(["tour", "page", "whatsapp"]),
    tourId: z
      .string()
      .trim()
      .default("")
      .refine((v) => !v || /^[0-9a-f-]{36}$/i.test(v), "Paquete inválido.")
      .transform((v) => v || null),
    ctaPath: z
      .string()
      .trim()
      .toLowerCase()
      .default("")
      .transform((v) => (v ? v.replace(/^https?:\/\/[^/]+/, "").replace(/^\/es(?=\/|$)/, "") || "/" : null))
      .refine((v) => v === null || (PATH.test(v) && !v.startsWith("//")), "Ruta del sitio en minúsculas que empiece con «/», p. ej. /destinos/tours-en-puno."),
    showPopup: z.boolean().default(false),
    sortOrder: z.coerce.number().int("Entero.").min(0, "Mínimo 0.").max(9999, "Máximo 9999."),
  })
  .superRefine((v, ctx) => {
    if (v.ctaKind === "tour" && !v.tourId) ctx.addIssue({ code: "custom", path: ["tourId"], message: "Elige el paquete o tour." });
    if (v.ctaKind === "page" && !v.ctaPath) ctx.addIssue({ code: "custom", path: ["ctaPath"], message: "Indica la página del sitio." });
    if (v.showFrom && v.showUntil && v.showUntil < v.showFrom) ctx.addIssue({ code: "custom", path: ["showUntil"], message: "Debe ser igual o posterior a «Mostrar desde»." });
    if (v.eventStartsOn && v.eventEndsOn && v.eventEndsOn < v.eventStartsOn) ctx.addIssue({ code: "custom", path: ["eventEndsOn"], message: "No puede ser anterior al primer día." });
  })
  .transform(({ showFrom, showUntil, ...rest }) => ({
    ...rest,
    // Solo se guarda la ruta o el paquete que corresponde al tipo de botón elegido.
    tourId: rest.ctaKind === "tour" ? rest.tourId : null,
    ctaPath: rest.ctaKind === "page" ? rest.ctaPath : null,
    startsAt: limaDayToInstant(showFrom),
    endsAt: limaDayToInstant(showUntil, true),
  }));

export const promotionCreateSchema = promotionTranslationSchema.omit({ translationStatus: true });
