"use client";

import { ArrowRight, Copy, Eye, EyeOff, KeyRound, LockKeyhole, Mail, ShieldCheck, Smartphone } from "lucide-react";
import { useRouter } from "next/navigation";
import { useActionState, useEffect, useRef, useState, useTransition } from "react";

import { colors } from "@pwt/ui/tokens";

import { ErrorSummary, SubmitButton } from "@/components/forms/ActionForm";
import { Field } from "@/components/forms/Field";
import { Alert } from "@/components/ui/Alert";
import { buttonClass } from "@/components/ui/styles";
import type { ActionResult } from "@/lib/auth/guard";

import { cancelLoginAction, confirmEnrollmentAction, initialPasswordAction, loginAction, showEnrollmentQrAction, verifyMfaAction, type LoginStep } from "./actions";

type State = ActionResult<LoginStep> | null;

function StepHeading({ children, step }: { children: React.ReactNode; step: string }) {
  const ref = useRef<HTMLHeadingElement>(null);
  // Al cambiar de paso, el foco va al título (lectores de pantalla anuncian el nuevo paso).
  useEffect(() => ref.current?.focus(), [step]);
  return (
    <h2 ref={ref} tabIndex={-1} className="auth-step-heading outline-none">
      {children}
    </h2>
  );
}

function CancelButton() {
  return (
    <form action={cancelLoginAction}>
      <button type="submit" className={buttonClass("ghost", "sm")}>
        Usar otra cuenta
      </button>
    </form>
  );
}

function PasswordStep({ onStep, next }: { onStep: (s: LoginStep) => void; next: string }) {
  const [state, action] = useActionState<State, FormData>(loginAction, null);
  const [showPassword, setShowPassword] = useState(false);
  useEffect(() => {
    if (state?.ok) onStep(state.data);
  }, [state, onStep]);
  const fields = state && !state.ok ? state.error.fields : undefined;
  return (
    <form action={action} className="space-y-4">
      <StepHeading step="password">Iniciar sesión</StepHeading>
      <p className="auth-step-description text-sm text-foreground-muted">Tu equipo, tus viajes y cada detalle, en un solo lugar.</p>
      {state && !state.ok ? <ErrorSummary error={state.error} /> : null}
      <input type="hidden" name="next" value={next} />
      <Field label={<span className="inline-flex items-center gap-2"><Mail aria-hidden size={16} /> Correo</span>} name="email" error={fields?.email} required>
        <input type="email" autoComplete="username" className="field-input" maxLength={254} autoFocus />
      </Field>
      <div className="relative">
        <Field label={<span className="inline-flex items-center gap-2"><LockKeyhole aria-hidden size={16} /> Contraseña</span>} name="password" error={fields?.password} required>
          <input type={showPassword ? "text" : "password"} autoComplete="current-password" className="field-input pr-14" maxLength={128} />
        </Field>
        <button type="button" aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"} aria-pressed={showPassword} onClick={() => setShowPassword(value => !value)} className="auth-password-toggle">
          {showPassword ? <EyeOff aria-hidden size={19} /> : <Eye aria-hidden size={19} />}
        </button>
      </div>
      <SubmitButton variant="primary" className="w-full" pendingLabel="Verificando…">
        Continuar <ArrowRight aria-hidden size={18} />
      </SubmitButton>
    </form>
  );
}

function MfaStep({ email, next }: { email: string; next: string }) {
  const [state, action] = useActionState<State, FormData>(verifyMfaAction, null);
  const [recovery, setRecovery] = useState(false);
  const fields = state && !state.ok ? state.error.fields : undefined;
  return (
    <div className="space-y-4">
      <form action={action} className="space-y-4">
        <StepHeading step="mfa">Verificación en dos pasos</StepHeading>
        <div className="auth-verification-note"><Smartphone aria-hidden size={22} /><p>Confirma que eres tú con el código de tu app autenticadora.</p></div>
        <p className="text-sm text-foreground-muted">
          Cuenta: <strong className="text-foreground">{email}</strong>
        </p>
        {state && !state.ok ? <ErrorSummary error={state.error} /> : null}
        <input type="hidden" name="next" value={next} />
        {recovery ? (
          <Field label="Código de recuperación" name="code" hint="Formato XXXXX-XXXXX. Cada código sirve una sola vez." error={fields?.code} required>
            <input key="recovery" type="text" autoComplete="off" spellCheck={false} className="field-input font-mono uppercase" maxLength={11} autoFocus />
          </Field>
        ) : (
          <Field label="Código de 6 dígitos" name="code" hint="Ábrelo en tu app autenticadora (Google Authenticator, Microsoft Authenticator, 1Password…)." error={fields?.code} required>
            <input key="totp" type="text" inputMode="numeric" autoComplete="one-time-code" pattern="\d{6}" maxLength={6} className="auth-code-input field-input font-mono tracking-[0.3em]" autoFocus />
          </Field>
        )}
        <SubmitButton variant="primary" className="w-full" pendingLabel="Verificando…">
          Ingresar
        </SubmitButton>
      </form>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <button type="button" className={buttonClass("ghost", "sm")} onClick={() => setRecovery((v) => !v)}>
          <KeyRound aria-hidden size={16} />
          {recovery ? "Usar el código de la app" : "No tengo mi teléfono: usar código de recuperación"}
        </button>
        <CancelButton />
      </div>
    </div>
  );
}

function EnrollStep({ step, next, onStep }: { step: Extract<LoginStep, { step: "enroll" }>; next: string; onStep: (s: LoginStep) => void }) {
  const [state, action] = useActionState<State, FormData>(confirmEnrollmentAction, null);
  const [qrError, setQrError] = useState<ActionResult<LoginStep> | null>(null);
  const [loadingQr, startQr] = useTransition();
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    if (state?.ok) onStep(state.data);
  }, [state, onStep]);
  const fields = state && !state.ok ? state.error.fields : undefined;

  return (
    <div className="space-y-4">
      <StepHeading step="enroll">Activa la verificación en dos pasos</StepHeading>
      <div className="auth-verification-note"><ShieldCheck aria-hidden size={22} /><p>Una capa adicional de protección para tu cuenta y las reservas.</p></div>
      <p className="text-sm text-foreground-muted">
        Es obligatoria para el panel. Cuenta: <strong className="text-foreground">{step.email}</strong>
      </p>
      <ol className="list-decimal space-y-1 pl-5 text-sm">
        <li>Instala una app autenticadora (Google Authenticator, Microsoft Authenticator, 1Password…).</li>
        <li>Escanea el código QR o escribe la clave manualmente.</li>
        <li>Ingresa el código de 6 dígitos que muestra la app.</li>
      </ol>
      {step.qr ? (
        <div className="flex flex-col items-center gap-3 rounded-sm border border-border bg-surface-muted p-4">
          {/* QR en SVG generado en el servidor: siempre oscuro sobre claro (los lectores lo necesitan). */}
          <svg role="img" aria-label="Código QR para configurar la app autenticadora" viewBox={`0 0 ${step.qr.size} ${step.qr.size}`} width={200} height={200} shapeRendering="crispEdges" className="rounded-xs">
            <rect width={step.qr.size} height={step.qr.size} fill={colors.light.surface} />
            <path d={step.qr.path} fill={colors.light.foreground} />
          </svg>
          {step.secret ? (
            <div className="w-full text-center">
              <p className="text-xs text-foreground-muted">Clave para ingreso manual</p>
              <p className="font-mono text-sm break-all select-all">{step.secret.replace(/(.{4})/g, "$1 ").trim()}</p>
              <button
                type="button"
                className={buttonClass("ghost", "sm", "mt-1")}
                onClick={async () => {
                  await navigator.clipboard?.writeText(step.secret ?? "");
                  setCopied(true);
                }}
              >
                <Copy aria-hidden size={14} /> {copied ? "Copiada" : "Copiar clave"}
              </button>
            </div>
          ) : null}
        </div>
      ) : (
        <div className="space-y-2">
          {qrError && !qrError.ok ? <ErrorSummary error={qrError.error} /> : null}
          <button
            type="button"
            className={buttonClass("secondary")}
            disabled={loadingQr}
            onClick={() =>
              startQr(async () => {
                const res = await showEnrollmentQrAction();
                if (res.ok) onStep(res.data);
                else setQrError(res);
              })
            }
          >
            {loadingQr ? "Generando…" : "Mostrar código QR"}
          </button>
        </div>
      )}
      <form action={action} className="space-y-4">
        {state && !state.ok ? <ErrorSummary error={state.error} /> : null}
        <input type="hidden" name="next" value={next} />
        <Field label="Código de 6 dígitos" name="code" error={fields?.code} required>
          <input type="text" inputMode="numeric" autoComplete="one-time-code" pattern="\d{6}" maxLength={6} className="field-input font-mono tracking-[0.3em]" />
        </Field>
        <SubmitButton variant="primary" className="w-full" pendingLabel="Activando…">
          Activar y entrar
        </SubmitButton>
      </form>
      <CancelButton />
    </div>
  );
}

function PasswordChangeStep({ email, onStep }: { email: string; onStep: (s: LoginStep) => void }) {
  const [state, action] = useActionState<State, FormData>(initialPasswordAction, null);
  useEffect(() => {
    if (state?.ok) onStep(state.data);
  }, [state, onStep]);
  const fields = state && !state.ok ? state.error.fields : undefined;
  return (
    <div className="space-y-4">
      <form action={action} className="space-y-4">
        <StepHeading step="password-change">Crea tu contraseña</StepHeading>
        <p className="text-sm text-foreground-muted">
          Tu contraseña es temporal. Define una propia para <strong className="text-foreground">{email}</strong>; luego activarás el segundo factor.
        </p>
        {state && !state.ok ? <ErrorSummary error={state.error} /> : null}
        <Field label="Contraseña nueva" name="newPassword" hint="Mínimo 12 caracteres; mejor una frase larga o una generada por tu gestor." error={fields?.newPassword} required>
          <input type="password" autoComplete="new-password" className="field-input" minLength={12} maxLength={128} autoFocus />
        </Field>
        <Field label="Repite la contraseña" name="confirm" error={fields?.confirm} required>
          <input type="password" autoComplete="new-password" className="field-input" maxLength={128} />
        </Field>
        <SubmitButton variant="primary" className="w-full" pendingLabel="Guardando…">
          Guardar y continuar
        </SubmitButton>
      </form>
      <CancelButton />
    </div>
  );
}

function RecoveryCodesStep({ codes, next }: { codes: string[]; next: string }) {
  const router = useRouter();
  const [saved, setSaved] = useState(false);
  const [copied, setCopied] = useState(false);
  return (
    <div className="space-y-4">
      <StepHeading step="codes">Guarda tus códigos de recuperación</StepHeading>
      <Alert tone="warning" title="Se muestran una sola vez">
        Cada código sirve una vez para entrar si pierdes el teléfono. Guárdalos en un gestor de contraseñas o imprímelos; no los compartas.
      </Alert>
      <ul aria-label="Códigos de recuperación" className="grid grid-cols-2 gap-2 rounded-sm border border-border bg-surface-muted p-3 font-mono text-sm">
        {codes.map((c) => (
          <li key={c} className="select-all">
            {c}
          </li>
        ))}
      </ul>
      <button
        type="button"
        className={buttonClass("outline", "sm")}
        onClick={async () => {
          await navigator.clipboard?.writeText(codes.join("\n"));
          setCopied(true);
        }}
      >
        <Copy aria-hidden size={14} /> {copied ? "Copiados" : "Copiar los 10 códigos"}
      </button>
      <label className="flex min-h-11 cursor-pointer items-center gap-3 text-sm">
        <input type="checkbox" className="size-5" checked={saved} onChange={(e) => setSaved(e.target.checked)} />
        Guardé los códigos en un lugar seguro.
      </label>
      <button type="button" className={buttonClass("primary", "md", "w-full")} disabled={!saved} onClick={() => router.replace(next)}>
        <ShieldCheck aria-hidden size={16} /> Ya los guardé, entrar al panel
      </button>
    </div>
  );
}

export function LoginFlow({ initial, next, notice }: { initial: LoginStep | null; next: string; notice?: { tone: "info" | "warning"; text: string } }) {
  const [step, setStep] = useState<LoginStep | null>(initial);
  return (
    <div className="space-y-4">
      {notice && !step ? (
        <Alert tone={notice.tone} role="status">
          {notice.text}
        </Alert>
      ) : null}
      {!step ? <PasswordStep onStep={setStep} next={next} /> : null}
      {step?.step === "mfa" ? <MfaStep email={step.email} next={next} /> : null}
      {step?.step === "enroll" ? <EnrollStep step={step} next={next} onStep={setStep} /> : null}
      {step?.step === "recovery-codes" ? <RecoveryCodesStep codes={step.codes} next={step.next} /> : null}
      {step?.step === "password-change" ? <PasswordChangeStep email={step.email} onStep={setStep} /> : null}
    </div>
  );
}
