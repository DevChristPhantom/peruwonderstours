"use client";

import { useLocale, useTranslations } from "next-intl";
import { useActionState, useEffect, useId, useRef } from "react";

import { buttonClass } from "@/components/ui/button-styles";
import { ACCESS_IDLE, type AccessKind, type AccessState } from "@/lib/access/types";

type Action = (prev: AccessState, formData: FormData) => Promise<AccessState>;

const inputClass = "mt-1 block min-h-12 w-full rounded-md border border-border-strong bg-surface px-3 text-body";

/** Mensaje de estado anunciado (role=status / alert) y enfocado para lectores de pantalla. */
function StateMessage({ state }: { state: AccessState }) {
  const t = useTranslations("access");
  const ref = useRef<HTMLParagraphElement>(null);
  useEffect(() => {
    if (state.status !== "idle") ref.current?.focus();
  }, [state]);
  if (state.status === "idle") return null;
  const ok = state.status === "sent";
  return (
    <p
      ref={ref}
      tabIndex={-1}
      role={ok ? "status" : "alert"}
      className={
        ok
          ? "rounded-md border border-success bg-success-soft p-4 text-sm text-success"
          : "rounded-md border border-danger bg-danger-soft p-4 text-sm text-danger"
      }
    >
      {t(state.status)}
    </p>
  );
}

/** Formulario "envíame el enlace": código + correo. La respuesta es genérica (no revela si existe). */
export function AccessRequestForm({ kind, action }: { kind: AccessKind; action: Action }) {
  const t = useTranslations("access");
  const locale = useLocale();
  const id = useId();
  const [state, formAction, pending] = useActionState(action, ACCESS_IDLE);
  return (
    <form action={formAction} className="space-y-5" noValidate={false}>
      <input type="hidden" name="locale" value={locale} />
      <div>
        <label htmlFor={`${id}-code`} className="block text-sm font-medium">
          {t("codeLabel")}
        </label>
        <input
          id={`${id}-code`}
          name="code"
          required
          autoComplete="off"
          autoCapitalize="characters"
          spellCheck={false}
          maxLength={40}
          placeholder={t(`${kind}.codePlaceholder`)}
          className={inputClass}
        />
      </div>
      <div>
        <label htmlFor={`${id}-email`} className="block text-sm font-medium">
          {t("emailLabel")}
        </label>
        <input
          id={`${id}-email`}
          name="email"
          type="email"
          required
          autoComplete="email"
          maxLength={254}
          aria-describedby={`${id}-email-hint`}
          className={inputClass}
        />
        <p id={`${id}-email-hint`} className="mt-1 text-sm text-foreground-muted">
          {t("emailHint")}
        </p>
      </div>
      <StateMessage state={state} />
      <button type="submit" disabled={pending} aria-disabled={pending} className={buttonClass("primary", "lg", "w-full sm:w-auto")}>
        {pending ? t("sending") : t("submit")}
      </button>
    </form>
  );
}

/** Botón que canjea el token del enlace del correo (POST; abrir la página no lo consume). */
export function AccessExchangeForm({ kind, token, action }: { kind: AccessKind; token: string; action: Action }) {
  const t = useTranslations("access");
  const locale = useLocale();
  const [state, formAction, pending] = useActionState(action, ACCESS_IDLE);
  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="locale" value={locale} />
      <input type="hidden" name="token" value={token} />
      <StateMessage state={state} />
      <button type="submit" disabled={pending} aria-disabled={pending} className={buttonClass("primary", "lg", "w-full sm:w-auto")}>
        {pending ? t("opening") : t(`${kind}.open`)}
      </button>
    </form>
  );
}
