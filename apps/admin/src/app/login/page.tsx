import type { Metadata } from "next";
import Image from "next/image";
import { connection } from "next/server";

import { formatWait } from "@/lib/api/errors";
import { readChallenge } from "@/lib/session/server";

import { LoginFlow } from "./LoginFlow";
import type { LoginStep } from "./actions";

export const metadata: Metadata = { title: "Iniciar sesión" };

const NOTICES: Record<string, { tone: "info" | "warning"; text: string }> = {
  salida: { tone: "info", text: "Cerraste sesión." },
  sesion: { tone: "warning", text: "Tu sesión terminó o expiró. Vuelve a iniciar sesión." },
  reuso: { tone: "warning", text: "Por seguridad cerramos la sesión: se detectó el reuso de un token de sesión. Si no fuiste tú, avisa a un administrador." },
  bloqueo: { tone: "warning", text: "Demasiados intentos fallidos: por seguridad cerramos tu sesión y bloqueamos la cuenta temporalmente." },
  desafio: { tone: "warning", text: "El paso de verificación expiró (5 min). Vuelve a ingresar tu correo y contraseña." },
  "session-revoked": { tone: "warning", text: "Tu sesión fue cerrada (desde otro dispositivo o por un administrador). Vuelve a iniciar sesión." },
  "refresh-token-reused": { tone: "warning", text: "Por seguridad cerramos la sesión: se detectó el reuso de un token de sesión." },
};

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  await connection();
  const params = await searchParams;
  const motivo = typeof params.motivo === "string" ? params.motivo : undefined;
  const volver = typeof params.volver === "string" && /^\/(?!\/)/.test(params.volver) ? params.volver : "/";
  const challenge = await readChallenge();
  const initial: LoginStep | null = challenge
    ? challenge.kind === "mfa"
      ? { step: "mfa", email: challenge.email }
      : challenge.kind === "pwchange"
        ? { step: "password-change", email: challenge.email }
        : { step: "enroll", email: challenge.email, qr: null, secret: null }
    : null;
  const espera = Number(params.espera);
  const base = motivo ? (NOTICES[motivo] ?? NOTICES.sesion) : undefined;
  const notice =
    base && motivo === "bloqueo" && Number.isFinite(espera) && espera > 0
      ? { ...base, text: `${base.text} Intenta de nuevo en ${formatWait(espera)}.` }
      : base;

  return (
    <main id="contenido" className="grid min-h-dvh place-items-center bg-background px-4 py-10">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center">
          <div className="relative mx-auto h-20 w-[280px] overflow-hidden rounded-lg bg-white"><Image src="/brand/peruwonderstours-condor.png" alt="peruwonderstours.com" width={2172} height={724} sizes="280px" className="absolute top-1/2 h-auto w-full -translate-y-1/2" preload /></div>
          <h1 className="mt-3 text-2xl font-semibold tracking-tight">Panel de administración</h1>
        </div>
        <div className="admin-login-card rounded-lg border border-border bg-surface p-6 sm:p-8">
          <LoginFlow initial={initial} next={volver} notice={notice} />
        </div>
        <p className="text-center text-xs text-foreground-muted">Acceso exclusivo del personal. Toda actividad queda registrada.</p>
      </div>
    </main>
  );
}
