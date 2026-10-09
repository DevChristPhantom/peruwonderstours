"use client";

import { Copy } from "lucide-react";
import { useRouter } from "next/navigation";
import { useActionState, useEffect, useState } from "react";

import { createUserAction, resetPasswordAction, type TempPasswordResult } from "@/app/(panel)/usuarios/actions";
import { ErrorSummary, SubmitButton } from "@/components/forms/ActionForm";
import { Field } from "@/components/forms/Field";
import { Alert } from "@/components/ui/Alert";
import { buttonClass } from "@/components/ui/styles";
import type { ActionResult } from "@/lib/auth/guard";

type State = ActionResult<TempPasswordResult> | null;

/** Muestra la contraseña temporal UNA vez (no se puede volver a consultar). */
function OneTimePassword({ result }: { result: TempPasswordResult }) {
  const [copied, setCopied] = useState(false);
  if (!result.temporaryPassword) return <Alert tone="success">Usuario {result.email} listo.</Alert>;
  return (
    <Alert tone="warning" role="status" title={`Contraseña temporal de ${result.email}`}>
      <p className="font-mono text-base select-all">{result.temporaryPassword}</p>
      <p className="mt-1 text-xs">Se muestra una sola vez. Entrégala por un canal seguro; al ingresar deberá activar el segundo factor.</p>
      <button
        type="button"
        className={buttonClass("ghost", "sm", "mt-1")}
        onClick={async () => {
          await navigator.clipboard?.writeText(result.temporaryPassword ?? "");
          setCopied(true);
        }}
      >
        <Copy aria-hidden size={14} /> {copied ? "Copiada" : "Copiar"}
      </button>
    </Alert>
  );
}

export function CreateUserForm() {
  const [state, formAction] = useActionState<State, FormData>(createUserAction, null);
  const router = useRouter();
  useEffect(() => {
    if (state?.ok) router.refresh();
  }, [state, router]);
  return (
    <form action={formAction} className="space-y-3">
      {state && !state.ok ? <ErrorSummary error={state.error} /> : null}
      {state && state.ok ? <OneTimePassword result={state.data} /> : null}
      <Field label="Nombre completo" name="fullName" error={state && !state.ok ? state.error.fields?.fullName : undefined} required>
        <input className="field-input" maxLength={160} autoComplete="off" />
      </Field>
      <Field label="Correo" name="email" error={state && !state.ok ? state.error.fields?.email : undefined} required>
        <input type="email" className="field-input" maxLength={254} autoComplete="off" />
      </Field>
      <Field label="Rol" name="role" required>
        <select className="field-input" defaultValue="agent">
          <option value="agent">Asesor de ventas</option>
          <option value="operator">Operaciones</option>
          <option value="admin">Administrador</option>
        </select>
      </Field>
      <SubmitButton variant="primary" pendingLabel="Creando…">
        Crear usuario
      </SubmitButton>
    </form>
  );
}

export function ResetPasswordButton({ id, email }: { id: string; email: string }) {
  const [state, formAction] = useActionState<State, FormData>(resetPasswordAction.bind(null, id), null);
  return (
    <form
      action={formAction}
      onSubmit={(e) => {
        if (!window.confirm(`¿Generar una contraseña temporal para ${email}? Se cerrarán sus sesiones.`)) e.preventDefault();
      }}
      className="space-y-2"
    >
      {state && !state.ok ? <ErrorSummary error={state.error} focus={false} /> : null}
      {state && state.ok ? <OneTimePassword result={state.data} /> : null}
      <SubmitButton variant="outline" size="sm">
        Nueva contraseña temporal
      </SubmitButton>
    </form>
  );
}
