"use server";

import { redirect } from "next/navigation";
import { z } from "zod";

import { api, apiData } from "@/lib/api/client";
import type { LoginResponse, MfaEnrollment, SessionTokens } from "@/lib/api/types";
import { assertSameOrigin, publicAction, type ActionResult } from "@/lib/auth/guard";
import { encodeQr, qrPath } from "@/lib/qr/qrcode";
import { sessionFromTokens } from "@/lib/session/model";
import { clearChallenge, clearSession, getSession, readChallenge, writeChallenge, writeSession } from "@/lib/session/server";

export type LoginStep =
  | { step: "mfa"; email: string }
  | { step: "enroll"; email: string; qr: { path: string; size: number } | null; secret: string | null }
  | { step: "password-change"; email: string }
  | { step: "recovery-codes"; codes: string[]; next: string };

const QUIET = 4;

/** Solo rutas internas (evita redirecciones abiertas). */
function safeNext(value: unknown): string {
  return typeof value === "string" && /^\/(?!\/)[\w\-./?=&%]*$/.test(value) && !value.startsWith("/login") ? value : "/";
}

const invalid = (message: string, fields?: Record<string, string>): ActionResult<never> => ({ ok: false, error: { code: "validation-failed", message, fields } });

async function startEnrollment(enrollmentToken: string) {
  const data = await apiData<MfaEnrollment>("/auth/staff/mfa/enrollment", { method: "POST", body: { enrollmentToken }, auth: false });
  const matrix = encodeQr(data.otpauthUri);
  return { qr: { path: qrPath(matrix, QUIET), size: matrix.size + QUIET * 2 }, secret: data.secret };
}

const loginSchema = z.object({
  email: z.email("Ingresa un correo válido.").max(254),
  password: z.string().min(1, "Ingresa tu contraseña.").max(128),
});

export async function loginAction(_prev: ActionResult<LoginStep> | null, formData: FormData): Promise<ActionResult<LoginStep>> {
  const parsed = loginSchema.safeParse({ email: String(formData.get("email") ?? "").trim(), password: formData.get("password") });
  if (!parsed.success) {
    const fields = Object.fromEntries(parsed.error.issues.map((i) => [String(i.path[0]), i.message]));
    return invalid("Revisa los datos ingresados.", fields);
  }
  return publicAction(async (): Promise<LoginStep> => {
    const res = await apiData<LoginResponse>("/auth/staff/login", { method: "POST", body: parsed.data, auth: false });
    return nextStep(res, parsed.data.email);
  });
}

/** Paso siguiente según la respuesta de login / cambio inicial de contraseña. */
async function nextStep(res: LoginResponse, email: string): Promise<LoginStep> {
  const exp = Date.parse(res.expiresAt) || Date.now() + 5 * 60_000;
  if (res.status === "mfa_required") {
    await writeChallenge({ kind: "mfa", token: res.mfaToken, exp, email });
    return { step: "mfa", email };
  }
  if (res.status === "mfa_enrollment_required") {
    await writeChallenge({ kind: "enroll", token: res.enrollmentToken, exp, email });
    const { qr, secret } = await startEnrollment(res.enrollmentToken);
    return { step: "enroll", email, qr, secret };
  }
  // H-14: contraseña temporal → cambio obligatorio antes del segundo factor.
  await writeChallenge({ kind: "pwchange", token: res.passwordChangeToken, exp, email });
  return { step: "password-change", email };
}

const initialPasswordSchema = z
  .object({ newPassword: z.string().min(12, "Mínimo 12 caracteres.").max(128), confirm: z.string() })
  .refine((v) => v.newPassword === v.confirm, { path: ["confirm"], message: "No coincide con la nueva contraseña." });

export async function initialPasswordAction(_prev: ActionResult<LoginStep> | null, formData: FormData): Promise<ActionResult<LoginStep>> {
  const parsed = initialPasswordSchema.safeParse({ newPassword: formData.get("newPassword"), confirm: formData.get("confirm") });
  if (!parsed.success) return invalid("Revisa los datos ingresados.", Object.fromEntries(parsed.error.issues.map((i) => [String(i.path[0]), i.message])));
  const result = await publicAction(async (): Promise<LoginStep> => {
    const challenge = await readChallenge();
    if (!challenge || challenge.kind !== "pwchange") redirect("/login?motivo=desafio");
    const res = await apiData<LoginResponse>("/auth/staff/password/initial", {
      method: "POST",
      body: { passwordChangeToken: challenge.token, newPassword: parsed.data.newPassword },
      auth: false,
    });
    return nextStep(res, challenge.email);
  });
  if (!result.ok && result.error.code === "invalid-mfa-token") await clearChallenge();
  return result;
}

/** Vuelve a generar el QR (p. ej. tras recargar la página en el paso de enrolamiento). */
export async function showEnrollmentQrAction(): Promise<ActionResult<LoginStep>> {
  return publicAction(async (): Promise<LoginStep> => {
    const challenge = await readChallenge();
    if (!challenge || challenge.kind !== "enroll") redirect("/login?motivo=desafio");
    const { qr, secret } = await startEnrollment(challenge.token);
    return { step: "enroll", email: challenge.email, qr, secret };
  });
}

const codeSchema = z
  .string()
  .transform((v) => v.trim().toUpperCase().replace(/\s+/g, ""))
  .refine((v) => /^\d{6}$/.test(v) || /^[A-Z0-9]{5}-?[A-Z0-9]{5}$/.test(v), "Ingresa los 6 dígitos de tu app o un código de recuperación (XXXXX-XXXXX).");

export async function verifyMfaAction(_prev: ActionResult<LoginStep> | null, formData: FormData): Promise<ActionResult<LoginStep>> {
  const code = codeSchema.safeParse(formData.get("code") ?? "");
  if (!code.success) return invalid(code.error.issues[0]!.message, { code: code.error.issues[0]!.message });
  const next = safeNext(formData.get("next"));
  const result = await publicAction(async () => {
    const challenge = await readChallenge();
    if (!challenge || challenge.kind !== "mfa") redirect("/login?motivo=desafio");
    // Código de recuperación: la API espera el formato XXXXX-XXXXX.
    const normalized = /^[A-Z0-9]{10}$/.test(code.data) ? `${code.data.slice(0, 5)}-${code.data.slice(5)}` : code.data;
    const tokens = await apiData<SessionTokens>("/auth/staff/mfa/verify", { method: "POST", body: { mfaToken: challenge.token, code: normalized }, auth: false });
    await writeSession(sessionFromTokens(tokens));
    await clearChallenge();
  });
  if (!result.ok) {
    if (result.error.code === "invalid-mfa-token") await clearChallenge();
    return result;
  }
  redirect(next);
}

export async function confirmEnrollmentAction(_prev: ActionResult<LoginStep> | null, formData: FormData): Promise<ActionResult<LoginStep>> {
  const code = String(formData.get("code") ?? "").replace(/\s+/g, "");
  if (!/^\d{6}$/.test(code)) return invalid("Ingresa los 6 dígitos que muestra tu app.", { code: "Deben ser 6 dígitos." });
  const next = safeNext(formData.get("next"));
  const result = await publicAction(async (): Promise<LoginStep> => {
    const challenge = await readChallenge();
    if (!challenge || challenge.kind !== "enroll") redirect("/login?motivo=desafio");
    const tokens = await apiData<SessionTokens>("/auth/staff/mfa/enrollment/confirm", {
      method: "POST",
      body: { enrollmentToken: challenge.token, code },
      auth: false,
    });
    await writeSession(sessionFromTokens(tokens));
    await clearChallenge();
    // Los 10 códigos se muestran UNA vez al usuario (no se guardan en el BFF).
    return { step: "recovery-codes", codes: tokens.recoveryCodes ?? [], next };
  });
  if (!result.ok && result.error.code === "invalid-mfa-token") await clearChallenge();
  return result;
}

export async function cancelLoginAction(): Promise<void> {
  if (!(await assertSameOrigin())) redirect("/login");
  await clearChallenge();
  redirect("/login");
}

/** Cierre de sesión: revoca en la API (si aún es válida) y borra la cookie siempre. */
export async function logoutAction(): Promise<void> {
  if (!(await assertSameOrigin())) redirect("/");
  const session = await getSession();
  if (session) {
    try {
      await api("/auth/staff/logout", { method: "POST" });
    } catch {
      // La cookie se borra igual: la sesión deja de existir en este navegador.
    }
  }
  await clearSession();
  redirect("/login?motivo=salida");
}
