import type { Metadata } from "next";
import Image from "next/image";
import { connection } from "next/server";
import { CalendarCheck2, MapPinned, MapPin, ShieldCheck, WalletCards } from "lucide-react";

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
    <main id="contenido" className="auth-shell">
      <Image src="/brand/admin-machu-amanecer.webp" alt="" width={1672} height={941} sizes="100vw" className="auth-backdrop" preload />
      <section className="auth-scene" aria-labelledby="auth-scene-title">
        <div className="auth-scene-content">
          <span className="auth-eyebrow">BIENVENIDO AL</span>
          <div className="auth-introduction">
            <h1 id="auth-scene-title" className="auth-scene-title">Panel de<br /><span>administración</span></h1>
            <p className="auth-lead">Gestiona reservas, tours y operaciones de forma simple y segura.</p>
          </div>
          <ul className="auth-features">
            <li><span className="auth-feature-icon"><CalendarCheck2 aria-hidden size={20} strokeWidth={1.6} /></span><div><strong>Reservas y viajeros</strong><p>Organiza cada etapa de la experiencia.</p></div></li>
            <li><span className="auth-feature-icon"><MapPinned aria-hidden size={20} strokeWidth={1.6} /></span><div><strong>Tours y destinos</strong><p>Mantén tu catálogo siempre al día.</p></div></li>
            <li><span className="auth-feature-icon"><WalletCards aria-hidden size={20} strokeWidth={1.6} /></span><div><strong>Pagos y operaciones</strong><p>Consulta los movimientos de tu agencia.</p></div></li>
            <li><span className="auth-feature-icon"><ShieldCheck aria-hidden size={20} strokeWidth={1.6} /></span><div><strong>Acceso protegido</strong><p>Verificación en dos pasos para tu equipo.</p></div></li>
          </ul>
          <div className="auth-office"><MapPin aria-hidden size={17} strokeWidth={1.6} /><div><strong>Oficina en Puno</strong><span>Calle N 500, Puno · Perú</span></div></div>
        </div>
      </section>
      <section className="auth-access" aria-label="Acceso del personal">
        <div className="auth-access-inner">
          <div className="auth-card">
            <div className="auth-brand"><Image src="/brand/peruwonderstours-dorado.png" alt="peruwonderstours.com" width={2171} height={724} sizes="(min-width: 1024px) 380px, 260px" className="auth-logo" preload /></div>
            <h1 className="auth-mobile-title">Panel de administración</h1>
            <LoginFlow initial={initial} next={volver} notice={notice} />
            <p className="auth-security"><ShieldCheck aria-hidden size={19} strokeWidth={1.7} /><span>Acceso exclusivo del personal.<br />Toda actividad queda registrada.</span></p>
          </div>
        </div>
      </section>
    </main>
  );
}
