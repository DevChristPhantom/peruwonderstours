"use server";

import type { z } from "zod";

import { apiData } from "@/lib/api/client";
import type { TranscriptionResult } from "@/lib/api/types";
import { action, type ActionResult } from "@/lib/auth/guard";
import {
  acceptanceSchema,
  offerSchema,
  reclassifySchema,
  rejectionSchema,
  respondSchema,
  transcriptionSchema,
  type TranscriptionInput,
} from "@/lib/schemas/complaints";

const UUID = /^[0-9a-f-]{36}$/i;

function invalid(error: z.ZodError): ActionResult<never> {
  return {
    ok: false,
    error: { code: "validation-failed", message: "Revisa los campos indicados.", fields: Object.fromEntries(error.issues.map((i) => [i.path.join("."), i.message])) },
  };
}

const formObject = (fd: FormData) => Object.fromEntries([...fd.entries()].filter(([, v]) => typeof v === "string")) as Record<string, string>;

function path(id: string, suffix: string): string {
  if (!UUID.test(id)) throw new Error("Id de reclamo inválido");
  return `/admin/complaints/${id}/${suffix}`;
}

export async function markInReviewAction(id: string, _prev: unknown, _fd: FormData) {
  return action(() => apiData(path(id, "in-review"), { method: "POST" }), { message: "Marcado en revisión." });
}

export async function respondAction(id: string, _prev: unknown, fd: FormData) {
  const parsed = respondSchema.safeParse(formObject(fd));
  if (!parsed.success) return invalid(parsed.error);
  return action(() => apiData(path(id, "respond"), { method: "POST", body: parsed.data }), {
    message: "Respuesta registrada. Si el canal es correo, la fecha de comunicación se fija cuando el correo se entrega.",
  });
}

export async function reclassifyAction(id: string, _prev: unknown, fd: FormData) {
  const parsed = reclassifySchema.safeParse(formObject(fd));
  if (!parsed.success) return invalid(parsed.error);
  return action(() => apiData(path(id, "reclassify"), { method: "POST", body: parsed.data }), { message: "Reclasificado. El plazo no cambia." });
}

export async function offerSettlementAction(id: string, _prev: unknown, fd: FormData) {
  const parsed = offerSchema.safeParse(formObject(fd));
  if (!parsed.success) return invalid(parsed.error);
  return action(() => apiData(path(id, "settlement-offer"), { method: "POST", body: parsed.data }), {
    message: "Oferta enviada. El plazo queda suspendido hasta 5 días hábiles.",
  });
}

export async function acceptSettlementAction(id: string, _prev: unknown, fd: FormData) {
  const parsed = acceptanceSchema.safeParse(formObject(fd));
  if (!parsed.success) return invalid(parsed.error);
  return action(() => apiData(path(id, "settlement-acceptance"), { method: "POST", body: parsed.data }), { message: "Aceptación registrada: reclamo solucionado." });
}

export async function rejectSettlementAction(id: string, _prev: unknown, fd: FormData) {
  const parsed = rejectionSchema.safeParse(formObject(fd));
  if (!parsed.success) return invalid(parsed.error);
  return action(() => apiData(path(id, "settlement-rejection"), { method: "POST", body: { note: parsed.data.note || undefined } }), {
    message: "Rechazo registrado: el plazo se reanuda.",
  });
}

export async function transcribeAction(input: TranscriptionInput) {
  const parsed = transcriptionSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  return action(() => apiData<TranscriptionResult>("/admin/complaints/transcriptions", { method: "POST", body: parsed.data }));
}
