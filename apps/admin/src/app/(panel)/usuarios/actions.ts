"use server";

import { z } from "zod";

import { apiData } from "@/lib/api/client";
import type { StaffUserSummary } from "@/lib/api/types";
import { action, type ActionResult } from "@/lib/auth/guard";

const UUID = /^[0-9a-f-]{36}$/i;
const userPath = (id: string, suffix = "") => {
  if (!UUID.test(id)) throw new Error("Id inválido");
  return `/admin/users/${id}${suffix}`;
};

export type TempPasswordResult = { email: string; temporaryPassword: string | null };

const createSchema = z.object({
  email: z.email("Correo inválido.").max(254),
  fullName: z.string().trim().min(3, "Mínimo 3 caracteres.").max(160),
  role: z.enum(["admin", "operator", "agent"]),
});

export async function createUserAction(_prev: unknown, fd: FormData): Promise<ActionResult<TempPasswordResult>> {
  const parsed = createSchema.safeParse({ email: String(fd.get("email") ?? "").trim().toLowerCase(), fullName: fd.get("fullName"), role: fd.get("role") });
  if (!parsed.success) {
    return { ok: false, error: { code: "validation-failed", message: "Revisa los campos indicados.", fields: Object.fromEntries(parsed.error.issues.map((i) => [i.path.join("."), i.message])) } };
  }
  return action(async () => {
    const res = await apiData<{ user: StaffUserSummary; temporaryPassword: string | null }>("/admin/users", { method: "POST", body: parsed.data });
    // La contraseña temporal se devuelve UNA vez y solo se muestra a quien creó el usuario.
    return { email: res.user.email, temporaryPassword: res.temporaryPassword };
  });
}

export async function resetPasswordAction(id: string, _prev: unknown, _fd: FormData): Promise<ActionResult<TempPasswordResult>> {
  return action(async () => {
    const res = await apiData<{ user: StaffUserSummary; temporaryPassword: string }>(userPath(id, "/reset-password"), { method: "POST" });
    return { email: res.user.email, temporaryPassword: res.temporaryPassword };
  });
}

export async function updateUserAction(id: string, version: number, _prev: unknown, fd: FormData) {
  const parsed = z.object({ role: z.enum(["admin", "operator", "agent"]), status: z.enum(["active", "suspended", "disabled"]) }).safeParse({ role: fd.get("role"), status: fd.get("status") });
  if (!parsed.success) return { ok: false as const, error: { code: "validation-failed", message: "Rol o estado inválido." } };
  return action(() => apiData(userPath(id), { method: "PATCH", body: { ...parsed.data, version } }), { message: "Usuario actualizado." });
}

export async function resetMfaAction(id: string, _prev: unknown, _fd: FormData) {
  return action(() => apiData(userPath(id, "/reset-mfa"), { method: "POST" }), { message: "Segundo factor reiniciado: deberá enrolarlo al ingresar. Se cerraron sus sesiones." });
}

export async function unlockUserAction(id: string, _prev: unknown, _fd: FormData) {
  return action(() => apiData(userPath(id, "/unlock"), { method: "POST" }), { message: "Cuenta desbloqueada." });
}

export async function revokeUserSessionsAction(id: string, _prev: unknown, _fd: FormData) {
  return action(() => apiData(userPath(id, "/revoke-sessions"), { method: "POST" }), { message: "Sesiones cerradas." });
}
