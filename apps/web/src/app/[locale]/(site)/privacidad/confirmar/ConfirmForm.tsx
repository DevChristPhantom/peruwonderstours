"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import { buttonClass } from "@/components/ui/button-styles";

import { confirmMarketingAction, type ConfirmResult } from "./actions";

const LABELS: Record<string, string> = {
  marketing_email: "ofertas y novedades por correo",
  marketing_whatsapp: "ofertas por WhatsApp",
};

function Submit() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} aria-busy={pending || undefined} className={buttonClass("primary", "lg")}>
      {pending ? "Confirmando…" : "Sí, quiero recibirlas"}
    </button>
  );
}

export function ConfirmForm({ token, pending }: { token: string; pending: string[] }) {
  const [state, action] = useActionState<ConfirmResult | null, FormData>(confirmMarketingAction, null);

  if (state?.ok) {
    const done = [...state.confirmed, ...state.alreadyConfirmed].map((p) => LABELS[p] ?? p);
    return (
      <div role="status" className="rounded-md border border-success bg-success-soft p-4">
        <p className="font-semibold text-success">{done.length ? "Suscripción confirmada." : "No había nada pendiente de confirmar."}</p>
        {done.length ? <p className="mt-1 text-sm">Recibirás {done.join(" y ")}. Puedes darte de baja cuando quieras desde el enlace de cada mensaje.</p> : null}
      </div>
    );
  }

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="token" value={token} />
      {state && !state.ok ? (
        <p role="alert" className="rounded-md border border-danger bg-danger-soft p-3 text-sm text-danger">
          {state.message}
        </p>
      ) : null}
      <p>
        Pediste recibir <strong>{pending.map((p) => LABELS[p] ?? p).join(" y ")}</strong>. Confirma que fuiste tú:
      </p>
      <Submit />
      <p className="text-sm text-foreground-muted">Si no lo pediste, ignora este mensaje: sin tu confirmación no te enviaremos publicidad.</p>
    </form>
  );
}
