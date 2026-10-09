"use server";

import { redirect } from "next/navigation";
import { z } from "zod";

import { apiData } from "@/lib/api/client";
import type { PrivacyRequest } from "@/lib/api/types";
import { action, type ActionResult } from "@/lib/auth/guard";
import { limaLocalToIso } from "@/lib/format";

const UUID = /^[0-9a-f-]{36}$/i;

function invalid(error: z.ZodError): ActionResult<never> {
  return {
    ok: false,
    error: { code: "validation-failed", message: "Revisa los campos indicados.", fields: Object.fromEntries(error.issues.map((i) => [i.path.join("."), i.message])) },
  };
}
const obj = (fd: FormData) => Object.fromEntries([...fd.entries()].filter(([, v]) => typeof v === "string")) as Record<string, string>;
const reqPath = (id: string, suffix = "") => {
  if (!UUID.test(id)) throw new Error("Id inválido");
  return `/admin/privacy/requests/${id}${suffix}`;
};

const createSchema = z
  .object({
    type: z.enum(["information", "access", "portability", "rectification", "cancellation", "opposition", "revoke_consent"], { error: "Elige el derecho." }),
    subjectName: z.string().trim().min(3, "Mínimo 3 caracteres.").max(200),
    subjectEmail: z.email("Correo inválido.").max(254),
    channel: z.enum(["email", "web", "office", "phone", "letter"]),
    detail: z.string().trim().min(5, "Mínimo 5 caracteres.").max(5000),
    receivedAt: z.string().default(""),
  })
  .transform((v, ctx) => {
    const receivedAt = v.receivedAt ? limaLocalToIso(v.receivedAt) : null;
    if (v.receivedAt && !receivedAt) ctx.addIssue({ code: "custom", path: ["receivedAt"], message: "Fecha inválida." });
    return { ...v, receivedAt: receivedAt ?? undefined };
  });

export async function createDsrAction(_prev: unknown, fd: FormData) {
  const parsed = createSchema.safeParse(obj(fd));
  if (!parsed.success) return invalid(parsed.error);
  const result = await action(() => apiData<PrivacyRequest>("/admin/privacy/requests", { method: "POST", body: parsed.data }));
  if (!result.ok) return result;
  redirect(`/privacidad/${result.data.id}`);
}

export async function setDsrStatusAction(id: string, version: number, status: "in_progress" | "withdrawn", _prev: unknown, _fd: FormData) {
  return action(() => apiData(reqPath(id, "/status"), { method: "POST", body: { version, status } }), { message: status === "in_progress" ? "Solicitud en trámite." : "Registrado el desistimiento." });
}

export async function extendDsrAction(id: string, version: number, _prev: unknown, fd: FormData) {
  const reason = z.string().trim().min(10, "Mínimo 10 caracteres.").max(1000).safeParse(fd.get("reason") ?? "");
  if (!reason.success) return { ok: false as const, error: { code: "validation-failed", message: "Revisa el motivo.", fields: { reason: reason.error.issues[0]!.message } } };
  return action(() => apiData(reqPath(id, "/extend"), { method: "POST", body: { version, reason: reason.data } }), { message: "Plazo ampliado una vez." });
}

const respondSchema = z.object({
  status: z.enum(["answered", "rejected"]),
  responseText: z.string().trim().min(10, "Mínimo 10 caracteres.").max(20_000),
});

export async function respondDsrAction(id: string, version: number, _prev: unknown, fd: FormData) {
  const parsed = respondSchema.safeParse(obj(fd));
  if (!parsed.success) return invalid(parsed.error);
  return action(() => apiData(reqPath(id, "/respond"), { method: "POST", body: { ...parsed.data, version } }), { message: "Respuesta registrada." });
}

export type ConsentHistory = {
  current: Record<string, boolean>;
  consents: { purpose: string; granted: boolean; method: string; source: string; policyVersion: string | null; createdAt: string }[];
  legalAcceptances: { document: string; documentVersion: string; bookingId: string | null; source: string; createdAt: string }[];
};

/** H-15: el correo va en el cuerpo de POST /admin/privacy/consents/search (consulta auditada). */
export async function consentHistoryAction(_prev: unknown, fd: FormData): Promise<ActionResult<ConsentHistory>> {
  const email = z.email().max(254).safeParse(String(fd.get("email") ?? "").trim().toLowerCase());
  if (!email.success) return { ok: false, error: { code: "validation-failed", message: "Correo inválido.", fields: { email: "Correo inválido." } } };
  return action(() => apiData<ConsentHistory>("/admin/privacy/consents/search", { method: "POST", body: { email: email.data } }));
}
