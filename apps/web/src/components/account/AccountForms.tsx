"use client";

import { useLocale, useTranslations } from "next-intl";
import { useActionState, useEffect, useId, useRef } from "react";
import { useFormStatus } from "react-dom";

import { buttonClass, type ButtonVariant } from "@/components/ui/button-styles";
import { exchangeLoginLinkAction, requestLoginLinkAction } from "@/lib/account/actions";
import { ACCOUNT_IDLE, type AccountState } from "@/lib/account/types";

const inputClass = "mt-1 block min-h-12 w-full rounded-md border border-border-strong bg-surface px-3 text-body";

/** Estado anunciado (role=status / alert) y enfocado para lectores de pantalla. */
function StateMessage({ state }: { state: AccountState }) {
  const t = useTranslations("account.states");
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

/** Botón de envío con estado pendiente (para formularios con Server Action). */
export function PendingButton({ label, pendingLabel, variant = "primary", className, ariaLabel }: {
  label: string;
  /** Nombre accesible cuando la etiqueta visible se repite (p. ej. "Abrir" en cada reserva). */
  ariaLabel?: string;
  pendingLabel: string;
  variant?: ButtonVariant;
  className?: string;
}) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} aria-disabled={pending} aria-label={ariaLabel} className={buttonClass(variant, "lg", className)}>
      {pending ? pendingLabel : label}
    </button>
  );
}

/** "Envíame el enlace": solo el correo. La respuesta es la misma exista o no una cuenta. */
export function LoginRequestForm() {
  const t = useTranslations("account.access");
  const locale = useLocale();
  const id = useId();
  const [state, formAction, pending] = useActionState(requestLoginLinkAction, ACCOUNT_IDLE);
  return (
    <form action={formAction} className="space-y-5">
      <input type="hidden" name="locale" value={locale} />
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

/** Botón que canjea el token del correo (POST): abrir la página no lo consume. */
export function LoginExchangeForm({ token }: { token: string }) {
  const t = useTranslations("account.access");
  const locale = useLocale();
  const [state, formAction, pending] = useActionState(exchangeLoginLinkAction, ACCOUNT_IDLE);
  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="locale" value={locale} />
      <input type="hidden" name="token" value={token} />
      <StateMessage state={state} />
      <button type="submit" disabled={pending} aria-disabled={pending} className={buttonClass("primary", "lg", "w-full sm:w-auto")}>
        {pending ? t("opening") : t("open")}
      </button>
    </form>
  );
}
