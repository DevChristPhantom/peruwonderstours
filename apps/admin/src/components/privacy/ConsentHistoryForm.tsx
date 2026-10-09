"use client";

import { useActionState } from "react";

import { consentHistoryAction, type ConsentHistory } from "@/app/(panel)/privacidad/actions";
import { ErrorSummary, SubmitButton } from "@/components/forms/ActionForm";
import { Field } from "@/components/forms/Field";
import { Badge } from "@/components/ui/Badge";
import type { ActionResult } from "@/lib/auth/guard";
import { formatDateTime } from "@/lib/format";

const PURPOSE: Record<string, string> = {
  marketing_email: "Marketing por correo",
  marketing_whatsapp: "Marketing por WhatsApp",
  privacy_notice: "Aviso de privacidad",
  terms: "Términos y condiciones",
};

/** Historial de consentimientos de un titular (la consulta queda en la auditoría). */
export function ConsentHistoryForm() {
  const [state, formAction] = useActionState<ActionResult<ConsentHistory> | null, FormData>(consentHistoryAction, null);
  return (
    <div className="space-y-3">
      <form action={formAction} className="space-y-3">
        {state && !state.ok ? <ErrorSummary error={state.error} /> : null}
        <Field label="Correo del titular" name="email" required>
          <input type="email" className="field-input" maxLength={254} autoComplete="off" />
        </Field>
        <SubmitButton variant="outline">Consultar</SubmitButton>
      </form>
      {state?.ok ? (
        <div className="space-y-2 text-sm" role="status">
          <p className="flex flex-wrap gap-1">
            {Object.keys(state.data.current).length === 0 ? <span className="text-foreground-muted">Sin consentimientos registrados.</span> : null}
            {Object.entries(state.data.current).map(([k, v]) => (
              <Badge key={k} tone={v ? "success" : "neutral"}>
                {PURPOSE[k] ?? k}: {v ? "vigente" : "revocado"}
              </Badge>
            ))}
          </p>
          <ol className="space-y-1 text-xs">
            {state.data.consents.map((c, i) => (
              <li key={i}>
                {formatDateTime(c.createdAt)} · {PURPOSE[c.purpose] ?? c.purpose} · {c.granted ? "otorgado" : "revocado"} ({c.method}, {c.source})
              </li>
            ))}
            {state.data.legalAcceptances.map((a, i) => (
              <li key={`a${i}`}>
                {formatDateTime(a.createdAt)} · aceptó {a.document} v{a.documentVersion} ({a.source})
              </li>
            ))}
          </ol>
        </div>
      ) : null}
    </div>
  );
}
