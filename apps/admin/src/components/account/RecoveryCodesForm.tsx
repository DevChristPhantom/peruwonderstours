"use client";

import { Copy } from "lucide-react";
import { useActionState, useState } from "react";

import { regenerateRecoveryCodesAction } from "@/app/(panel)/cuenta/actions";
import { ErrorSummary, SubmitButton } from "@/components/forms/ActionForm";
import { Field } from "@/components/forms/Field";
import { Alert } from "@/components/ui/Alert";
import { buttonClass } from "@/components/ui/styles";
import type { ActionResult } from "@/lib/auth/guard";

type State = ActionResult<{ recoveryCodes: string[] }> | null;

/** Regenera los 10 códigos (exige un TOTP vigente). Los anteriores dejan de servir; se muestran una vez. */
export function RecoveryCodesForm() {
  const [state, formAction] = useActionState<State, FormData>(regenerateRecoveryCodesAction, null);
  const [copied, setCopied] = useState(false);
  if (state?.ok) {
    return (
      <div className="space-y-3">
        <Alert tone="warning" title="Nuevos códigos de recuperación (se muestran una sola vez)">
          Los anteriores ya no sirven. Guárdalos en un gestor de contraseñas.
        </Alert>
        <ul aria-label="Códigos de recuperación" className="grid grid-cols-2 gap-2 rounded-sm border border-border bg-surface-muted p-3 font-mono text-sm">
          {state.data.recoveryCodes.map((c) => (
            <li key={c}>{c}</li>
          ))}
        </ul>
        <button
          type="button"
          className={buttonClass("outline", "sm")}
          onClick={async () => {
            await navigator.clipboard?.writeText(state.data.recoveryCodes.join("\n"));
            setCopied(true);
          }}
        >
          <Copy aria-hidden size={14} /> {copied ? "Copiados" : "Copiar códigos"}
        </button>
      </div>
    );
  }
  return (
    <form action={formAction} className="space-y-3">
      {state && !state.ok ? <ErrorSummary error={state.error} /> : null}
      <Field label="Código actual de tu app (6 dígitos)" name="code" error={state && !state.ok ? state.error.fields?.code : undefined} required>
        <input inputMode="numeric" autoComplete="one-time-code" maxLength={6} pattern="\d{6}" className="field-input max-w-48 font-mono tracking-[0.3em]" />
      </Field>
      <SubmitButton variant="outline">Generar códigos nuevos</SubmitButton>
    </form>
  );
}
