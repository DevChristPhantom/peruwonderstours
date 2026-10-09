"use server";

import { redirect } from "next/navigation";
import { z } from "zod";

import { api, apiData } from "@/lib/api/client";
import { action, type ActionResult } from "@/lib/auth/guard";
import { clearSession } from "@/lib/session/server";

const UUID = /^[0-9a-f-]{36}$/i;

export async function revokeSessionAction(sessionId: string, _prev: unknown, _fd: FormData) {
  if (!UUID.test(sessionId)) throw new Error("Id inválido");
  return action(() => api(`/auth/staff/sessions/${sessionId}`, { method: "DELETE" }), { message: "Sesión cerrada." });
}

export async function logoutAllAction(_prev: unknown, _fd: FormData) {
  const result = await action(() => apiData<{ revokedSessions: number }>("/auth/staff/logout-all", { method: "POST" }));
  if (!result.ok) return result;
  await clearSession();
  redirect("/login?motivo=salida");
}

const passwordSchema = z
  .object({
    currentPassword: z.string().min(1, "Ingresa tu contraseña actual.").max(128),
    newPassword: z.string().min(12, "Mínimo 12 caracteres.").max(128),
    confirm: z.string(),
  })
  .refine((v) => v.newPassword === v.confirm, { path: ["confirm"], message: "No coincide con la nueva contraseña." })
  .refine((v) => v.newPassword !== v.currentPassword, { path: ["newPassword"], message: "Debe ser distinta de la actual." });

/** H-12/H-13: al bloquearse la cuenta (429) la API cierra la sesión actual: se sale al login. */
async function exitIfLocked<T>(result: ActionResult<T>): Promise<ActionResult<T>> {
  if (!result.ok && result.error.status === 429) {
    await clearSession();
    redirect(`/login?motivo=bloqueo${result.error.retryAfterSeconds ? `&espera=${Math.ceil(result.error.retryAfterSeconds)}` : ""}`);
  }
  return result;
}

export async function changePasswordAction(_prev: unknown, fd: FormData) {
  const parsed = passwordSchema.safeParse({ currentPassword: fd.get("currentPassword"), newPassword: fd.get("newPassword"), confirm: fd.get("confirm") });
  if (!parsed.success) {
    return { ok: false as const, error: { code: "validation-failed", message: "Revisa los campos indicados.", fields: Object.fromEntries(parsed.error.issues.map((i) => [i.path.join("."), i.message])) } };
  }
  return exitIfLocked(
    await action(() => api("/auth/staff/password", { method: "POST", body: { currentPassword: parsed.data.currentPassword, newPassword: parsed.data.newPassword } }), {
      message: "Contraseña cambiada. Se cerraron tus otras sesiones.",
    }),
  );
}

export async function regenerateRecoveryCodesAction(_prev: unknown, fd: FormData): Promise<ActionResult<{ recoveryCodes: string[] }>> {
  const code = String(fd.get("code") ?? "").replace(/\s+/g, "");
  if (!/^\d{6}$/.test(code)) return { ok: false, error: { code: "validation-failed", message: "Ingresa los 6 dígitos de tu app.", fields: { code: "Deben ser 6 dígitos." } } };
  return exitIfLocked(await action(() => apiData<{ recoveryCodes: string[] }>("/auth/staff/mfa/recovery-codes", { method: "POST", body: { code } })));
}
