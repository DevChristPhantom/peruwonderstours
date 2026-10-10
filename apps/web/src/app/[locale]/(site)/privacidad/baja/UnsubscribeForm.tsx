"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import { buttonClass } from "@/components/ui/button-styles";

import { unsubscribeAction, type UnsubscribeResult } from "./actions";

const LABELS: Record<string, string> = {
  marketing_email: "Correos con ofertas y novedades",
  marketing_whatsapp: "Mensajes de WhatsApp con ofertas",
};

function Submit() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} aria-busy={pending || undefined} className={buttonClass("primary", "lg")}>
      {pending ? "Procesando…" : "Confirmar la baja"}
    </button>
  );
}

export function UnsubscribeForm({ token, purposes }: { token: string; purposes: { purpose: string; granted: boolean }[] }) {
  const [state, action] = useActionState<UnsubscribeResult | null, FormData>(unsubscribeAction, null);
  const active = purposes.filter((p) => p.granted);

  if (state?.ok) {
    const done = [...state.revoked, ...state.alreadyRevoked].map((p) => LABELS[p] ?? p);
    return (
      <div role="status" className="rounded-md border border-success bg-success-soft p-4 text-success">
        <p className="font-semibold">Listo: te dimos de baja.</p>
        <p className="mt-1 text-sm text-foreground">Ya no recibirás: {done.join(" y ").toLowerCase() || "comunicaciones comerciales"}.</p>
        <p className="mt-1 text-sm text-foreground">Seguirás recibiendo los correos necesarios de tus reservas (confirmaciones, vouchers y avisos de pago).</p>
      </div>
    );
  }

  if (active.length === 0) {
    return (
      <p role="status" className="rounded-md border border-border bg-surface-muted p-4 text-sm">
        Ya no estás suscrito a comunicaciones comerciales con este correo. No necesitas hacer nada más.
      </p>
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
      <fieldset className="space-y-2">
        <legend className="mb-1 font-medium">¿De qué quieres darte de baja?</legend>
        {active.map((p) => (
          <label key={p.purpose} className="flex min-h-11 cursor-pointer items-center gap-3 rounded-md border border-border bg-surface px-3">
            <input type="checkbox" name="purposes" value={p.purpose} defaultChecked className="size-5" />
            {LABELS[p.purpose] ?? p.purpose}
          </label>
        ))}
      </fieldset>
      <Submit />
    </form>
  );
}
