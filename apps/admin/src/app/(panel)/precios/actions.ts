"use server";

import { z } from "zod";

import { apiData } from "@/lib/api/client";
import { action, type ActionResult } from "@/lib/auth/guard";
import { parseAmountToCents } from "@/lib/format";

const UUID = /^[0-9a-f-]{36}$/i;
const DATE = /^\d{4}-\d{2}-\d{2}$/;

function invalid(error: z.ZodError): ActionResult<never> {
  return {
    ok: false,
    error: { code: "validation-failed", message: "Revisa los campos indicados.", fields: Object.fromEntries(error.issues.map((i) => [i.path.join("."), i.message])) },
  };
}
const obj = (fd: FormData) => Object.fromEntries([...fd.entries()].filter(([, v]) => typeof v === "string")) as Record<string, string>;

const seasonSchema = z
  .object({
    code: z.string().trim().toUpperCase().regex(/^[A-Z0-9][A-Z0-9_-]{1,39}$/, "2-40 mayúsculas, números, _ o -."),
    name: z.string().trim().min(2, "Mínimo 2 caracteres.").max(120),
    startDate: z.string().regex(DATE, "Fecha inválida."),
    endDate: z.string().regex(DATE, "Fecha inválida."),
    priority: z.coerce.number().int().min(0).max(100).default(0),
  })
  .refine((v) => v.endDate >= v.startDate, { path: ["endDate"], message: "Debe ser igual o posterior al inicio." });

export async function createSeasonAction(_prev: unknown, fd: FormData) {
  const parsed = seasonSchema.safeParse(obj(fd));
  if (!parsed.success) return invalid(parsed.error);
  return action(() => apiData("/admin/seasons", { method: "POST", body: parsed.data }), { message: "Temporada creada." });
}

export async function updateSeasonAction(id: string, version: number, _prev: unknown, fd: FormData) {
  if (!UUID.test(id)) throw new Error("Id inválido");
  const parsed = seasonSchema.safeParse(obj(fd));
  if (!parsed.success) return invalid(parsed.error);
  return action(() => apiData(`/admin/seasons/${id}`, { method: "PATCH", body: { ...parsed.data, version } }), { message: "Temporada actualizada." });
}

export async function deleteSeasonAction(id: string, _prev: unknown, _fd: FormData) {
  if (!UUID.test(id)) throw new Error("Id inválido");
  return action(() => apiData(`/admin/seasons/${id}`, { method: "DELETE" }), { message: "Temporada eliminada." });
}

const rateSchema = z
  .object({
    seasonId: z.string().default(""),
    paxType: z.enum(["adult", "child", "student", "senior"]),
    residency: z.enum(["national", "foreign"]),
    currency: z.enum(["PEN", "USD"]),
    amount: z.string().transform((v, ctx) => {
      const cents = parseAmountToCents(v);
      if (cents === null) {
        ctx.addIssue({ code: "custom", message: "Precio inválido (ej. 450.00)." });
        return z.NEVER;
      }
      return cents;
    }),
    validFrom: z.string().regex(DATE, "Fecha inválida."),
    validTo: z.string().regex(DATE, "Fecha inválida."),
    minGroupSize: z.coerce.number().int().min(1, "Mínimo 1.").max(500).default(1),
    maxGroupSize: z
      .string()
      .default("")
      .transform((v, ctx) => {
        if (!v.trim()) return null;
        const n = Number(v);
        if (!Number.isInteger(n) || n < 1 || n > 500) {
          ctx.addIssue({ code: "custom", message: "Entero entre 1 y 500." });
          return z.NEVER;
        }
        return n;
      }),
  })
  .refine((v) => v.validTo >= v.validFrom, { path: ["validTo"], message: "Debe ser igual o posterior al inicio." })
  .refine((v) => v.maxGroupSize === null || v.maxGroupSize >= v.minGroupSize, { path: ["maxGroupSize"], message: "Debe ser mayor o igual al mínimo." });

export async function createRateAction(tourId: string, _prev: unknown, fd: FormData) {
  if (!UUID.test(tourId)) throw new Error("Id inválido");
  const parsed = rateSchema.safeParse(obj(fd));
  if (!parsed.success) return invalid(parsed.error);
  const { seasonId, ...rest } = parsed.data;
  return action(() => apiData(`/admin/tours/${tourId}/rates`, { method: "POST", body: { ...rest, seasonId: UUID.test(seasonId) ? seasonId : null, isActive: true } }), {
    message: "Tarifa creada.",
  });
}

export async function setRateActiveAction(id: string, version: number, isActive: boolean, _prev: unknown, _fd: FormData) {
  if (!UUID.test(id)) throw new Error("Id inválido");
  return action(() => apiData(`/admin/rates/${id}`, { method: "PATCH", body: { version, isActive } }), { message: isActive ? "Tarifa activada." : "Tarifa desactivada." });
}

export async function deleteRateAction(id: string, _prev: unknown, _fd: FormData) {
  if (!UUID.test(id)) throw new Error("Id inválido");
  return action(() => apiData(`/admin/rates/${id}`, { method: "DELETE" }), { message: "Tarifa eliminada (las reservas conservan su precio)." });
}
