import { z } from "zod";

const SLUG = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const lines = z
  .string()
  .default("")
  .transform((v) =>
    v
      .split(/\r?\n/)
      .map((s) => s.trim())
      .filter(Boolean),
  );
const optText = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `Máximo ${max} caracteres.`)
    .default("")
    .transform((v) => (v ? v : null));
const optInt = (min: number, max: number) =>
  z
    .string()
    .trim()
    .default("")
    .transform((v, ctx) => {
      if (!v) return null;
      const n = Number(v);
      if (!Number.isInteger(n) || n < min || n > max) {
        ctx.addIssue({ code: "custom", message: `Entero entre ${min} y ${max}.` });
        return z.NEVER;
      }
      return n;
    });

/** Traducción (es) con itinerario por días. Listas como "una por línea". */
export const translationSchema = z
  .object({
    slug: z.string().trim().regex(SLUG, "Solo minúsculas, números y guiones.").max(160),
    title: z.string().trim().min(1, "Obligatorio.").max(200),
    summary: z.string().trim().min(1, "Obligatorio.").max(600),
    description: optText(50_000),
    itinerary: z
      .array(
        z.object({
          title: z.string().trim().max(200).default(""),
          description: z.string().trim().min(1, "Describe el día.").max(5000),
          meals: z.string().trim().max(200).default(""),
          overnight: z.string().trim().max(120).default(""),
        }),
      )
      .max(60),
    includes: lines,
    notIncluded: lines,
    recommendations: lines,
    importantNotes: lines,
    faqs: z.array(z.object({ question: z.string().trim().min(1, "Obligatorio.").max(500), answer: z.string().trim().min(1, "Obligatorio.").max(4000) })).max(100),
    policies: optText(20_000),
    meetingPoint: optText(2000),
    seoTitle: optText(70),
    seoDescription: optText(170),
    /** Metadato del panel: vacío = revisada por el equipo (`null` en la API). */
    translationStatus: z
      .enum(["", "machine_reviewed_pending_client", "client_approved", "staff_written"])
      .default("")
      .transform((s) => (s ? s : null)),
  })
  .transform((v) => ({
    ...v,
    itinerary: v.itinerary.map((d, i) => ({
      day: i + 1,
      title: d.title || null,
      description: d.description,
      meals: d.meals
        .split(",")
        .map((m) => m.trim())
        .filter(Boolean),
      overnight: d.overnight || null,
    })),
  }));
export type TranslationFormInput = z.input<typeof translationSchema>;

/** Campos generales del tour. */
export const tourFieldsSchema = z
  .object({
    type: z.enum(["tour", "package", "transfer"]),
    code: z.string().trim().regex(/^[A-Z0-9][A-Z0-9-]{1,39}$/, "2-40 mayúsculas, números o guiones."),
    durationDays: optInt(0, 60),
    durationNights: optInt(0, 60),
    durationHours: z
      .string()
      .trim()
      .default("")
      .transform((v, ctx) => {
        if (!v) return null;
        const n = Number(v.replace(",", "."));
        if (!Number.isFinite(n) || n < 0 || n > 999) {
          ctx.addIssue({ code: "custom", message: "Horas entre 0 y 999." });
          return z.NEVER;
        }
        return n;
      }),
    minPax: z.coerce.number().int("Entero.").min(1, "Mínimo 1.").max(500),
    maxPax: optInt(1, 500),
    difficulty: z.enum(["", "easy", "moderate", "challenging", "extreme"]).default(""),
    languages: z
      .string()
      .default("es")
      .transform((v) =>
        v
          .split(",")
          .map((s) => s.trim().toLowerCase())
          .filter((s) => /^[a-z]{2}$/.test(s)),
      ),
    bookingCutoffHours: z.coerce.number().int("Entero.").min(0).max(8760),
    depositPercentOverride: optInt(1, 100),
    requiresTravelerDocument: z.boolean().default(false),
    usesInventory: z.boolean().default(true),
    isFeatured: z.boolean().default(false),
  })
  .transform((v) => ({ ...v, difficulty: v.difficulty || null }));
export type TourFieldsInput = z.input<typeof tourFieldsSchema>;

export const createTourSchema = z.object({
  type: z.enum(["tour", "package", "transfer"]),
  code: z.string().trim().regex(/^[A-Z0-9][A-Z0-9-]{1,39}$/, "2-40 mayúsculas, números o guiones."),
  slug: z.string().trim().regex(SLUG, "Solo minúsculas, números y guiones.").max(160),
  durationDays: optInt(0, 60),
  durationNights: optInt(0, 60),
  durationHours: optInt(0, 999),
  minPax: z.coerce.number().int().min(1, "Mínimo 1.").max(500).default(1),
});

export const mediaSchema = z.object({
  storageKey: z.string().trim().min(3, "Ingresa la URL o clave del archivo.").max(2000).refine((v) => !/^\s*javascript:/i.test(v), "URL inválida."),
  altEs: optText(250),
  isCover: z.boolean().default(false),
});
