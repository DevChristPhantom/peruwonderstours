"use server";

import { z } from "zod";

import { apiData } from "@/lib/api/client";
import type { BulkDeparturesResult } from "@/lib/api/types";
import { action, type ActionResult } from "@/lib/auth/guard";

const UUID = /^[0-9a-f-]{36}$/i;
const DATE = /^\d{4}-\d{2}-\d{2}$/;

function invalid(error: z.ZodError): ActionResult<never> {
  return {
    ok: false,
    error: { code: "validation-failed", message: "Revisa los campos indicados.", fields: Object.fromEntries(error.issues.map((i) => [i.path.join("."), i.message])) },
  };
}

const bulkSchema = z
  .object({
    from: z.string().regex(DATE, "Fecha inválida."),
    to: z.string().regex(DATE, "Fecha inválida."),
    weekdays: z.array(z.coerce.number().int().min(1).max(7)).min(1, "Elige al menos un día de la semana."),
    startTime: z
      .string()
      .default("")
      .refine((v) => v === "" || /^([01]\d|2[0-3]):[0-5]\d$/.test(v), "Formato HH:MM."),
    capacity: z.coerce.number().int("Entero.").min(1, "Mínimo 1.").max(10_000),
  })
  .refine((v) => v.to >= v.from, { path: ["to"], message: "Debe ser igual o posterior al inicio." })
  .refine((v) => (Date.parse(v.to) - Date.parse(v.from)) / 86_400_000 <= 365, { path: ["to"], message: "El rango no puede superar 366 días." });

export async function bulkDeparturesAction(tourId: string, _prev: unknown, fd: FormData) {
  if (!UUID.test(tourId)) throw new Error("Id inválido");
  const parsed = bulkSchema.safeParse({
    from: fd.get("from"),
    to: fd.get("to"),
    weekdays: fd.getAll("weekdays"),
    startTime: fd.get("startTime") ?? "",
    capacity: fd.get("capacity"),
  });
  if (!parsed.success) return invalid(parsed.error);
  const { startTime, ...rest } = parsed.data;
  const result = await action(() =>
    apiData<BulkDeparturesResult>(`/admin/tours/${tourId}/departures/bulk`, { method: "POST", body: { ...rest, ...(startTime ? { startTime } : {}) } }),
  );
  if (!result.ok) return result;
  const d = result.data;
  return {
    ...result,
    message: `${d.created} salida(s) creada(s)${d.skipped.length ? `; ${d.skipped.length} ya existían y se omitieron` : ""}.${d.usesInventory ? "" : " Aviso: el tour no controla cupos (usesInventory desactivado)."}`,
  };
}

export async function updateCapacityAction(id: string, version: number, _prev: unknown, fd: FormData) {
  if (!UUID.test(id)) throw new Error("Id inválido");
  const capacity = z.coerce.number().int().min(0).max(10_000).safeParse(fd.get("capacity"));
  if (!capacity.success) return { ok: false as const, error: { code: "validation-failed", message: "Capacidad: entero entre 0 y 10000.", fields: { capacity: "Entero entre 0 y 10000." } } };
  return action(() => apiData(`/admin/departures/${id}`, { method: "PATCH", body: { version, capacity: capacity.data } }), { message: "Capacidad actualizada." });
}

export async function toggleSalesAction(id: string, version: number, close: boolean, _prev: unknown, _fd: FormData) {
  if (!UUID.test(id)) throw new Error("Id inválido");
  return action(() => apiData(`/admin/departures/${id}/${close ? "close-sales" : "reopen-sales"}`, { method: "POST", body: { version } }), {
    message: close ? "Ventas cerradas." : "Ventas reabiertas.",
  });
}

export async function deleteDepartureAction(id: string, version: number, _prev: unknown, _fd: FormData) {
  if (!UUID.test(id)) throw new Error("Id inválido");
  return action(() => apiData(`/admin/departures/${id}`, { method: "DELETE", body: { version } }), { message: "Salida eliminada." });
}
