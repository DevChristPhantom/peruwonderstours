"use client";

import clsx from "clsx";
import { Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { createContext, useActionState, useContext, useEffect, useRef } from "react";
import { useFormStatus } from "react-dom";

import { Alert } from "@/components/ui/Alert";
import { buttonClass, type ButtonSize, type ButtonVariant } from "@/components/ui/styles";
import { fieldLabel, type UserError } from "@/lib/api/errors";
import type { ActionResult } from "@/lib/auth/guard";

/** 409 por bloqueo optimista: hay que recargar para ver la versión vigente. */
const CONFLICT_CODES = new Set(["tour-version-conflict", "concurrency-conflict"]);

/* ------------------------------------------------------------------ Errores por campo */

const FieldErrors = createContext<Record<string, string> | undefined>(undefined);

export function useFieldError(name?: string): string | undefined {
  const errors = useContext(FieldErrors);
  return name ? errors?.[name] : undefined;
}

/**
 * Resumen de errores enfocable al fallar el envío (WCAG 3.3.1): enlaza cada error con su campo.
 * Mensajes de la API en español; los problemas sin campo se listan igual.
 */
export function ErrorSummary({ error, focus = true }: { error: UserError; focus?: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (focus) ref.current?.focus();
  }, [error, focus]);
  const fieldItems = Object.entries(error.fields ?? {}).map(([field, message]) => (
    <a key={field} href={`#f-${field.replace(/[^\w-]/g, "-")}`} className="underline">
      {fieldLabel(field)}: {message}
    </a>
  ));
  return (
    <div ref={ref} tabIndex={-1} className="outline-none focus-visible:outline-2">
      <Alert tone={error.status === 403 ? "warning" : "danger"} role="alert" title={error.message} items={[...(error.items ?? []), ...fieldItems]} />
      {CONFLICT_CODES.has(error.code) ? (
        <button type="button" className={buttonClass("outline", "sm", "mt-2")} onClick={() => window.location.reload()}>
          Recargar datos (se pierden los cambios no guardados)
        </button>
      ) : null}
    </div>
  );
}

/* ------------------------------------------------------------------ Botón de envío */

export function SubmitButton({
  children,
  variant = "secondary",
  size = "md",
  pendingLabel = "Procesando…",
  className,
  name,
  value,
  disabled,
}: {
  children: React.ReactNode;
  variant?: ButtonVariant;
  size?: ButtonSize;
  pendingLabel?: string;
  className?: string;
  name?: string;
  value?: string;
  disabled?: boolean;
}) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" name={name} value={value} disabled={pending || disabled} aria-busy={pending || undefined} className={buttonClass(variant, size, className)}>
      {pending ? <Loader2 aria-hidden size={16} className="animate-spin motion-reduce:animate-none" /> : null}
      {pending ? pendingLabel : children}
    </button>
  );
}

/* ------------------------------------------------------------------ Formulario con Server Action */

export type FormAction = (prev: ActionResult<unknown> | null, formData: FormData) => Promise<ActionResult<unknown>>;

/**
 * Formulario simple con Server Action (`useActionState`): funciona sin JS (mejora progresiva),
 * muestra resumen de errores enfocable y mensajes por campo, y refresca la página al terminar bien.
 */
export function ActionForm({
  action,
  children,
  className,
  successMessage,
  resetOnSuccess = false,
  refresh = true,
  confirm,
  onSuccess,
  showSuccess = true,
}: {
  action: FormAction;
  /** false en formularios compactos (filas de tablas): el cambio ya se ve en los datos. */
  showSuccess?: boolean;
  children: React.ReactNode;
  className?: string;
  successMessage?: string;
  resetOnSuccess?: boolean;
  refresh?: boolean;
  /** Texto de confirmación nativa antes de acciones irreversibles. */
  confirm?: string;
  onSuccess?: (data: unknown) => void;
}) {
  const [state, formAction] = useActionState(action, null);
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const handled = useRef<unknown>(null);

  useEffect(() => {
    if (!state || handled.current === state) return;
    handled.current = state;
    if (state.ok) {
      if (resetOnSuccess) formRef.current?.reset();
      onSuccess?.(state.data);
      if (refresh) router.refresh();
    }
  }, [state, resetOnSuccess, refresh, router, onSuccess]);

  return (
    <FieldErrors.Provider value={state && !state.ok ? state.error.fields : undefined}>
      <form
        ref={formRef}
        action={formAction}
        noValidate={false}
        className={clsx("space-y-3", className)}
        onSubmit={(e) => {
          if (confirm && !window.confirm(confirm)) e.preventDefault();
        }}
      >
        {state && !state.ok ? <ErrorSummary error={state.error} /> : null}
        {showSuccess && state && state.ok && (state.message || successMessage) ? (
          <Alert tone="success" role="status">
            {state.message ?? successMessage}
          </Alert>
        ) : null}
        {children}
      </form>
    </FieldErrors.Provider>
  );
}

/* ------------------------------------------------------------------ Error de campo */

/**
 * Mensaje de error del campo `name` según el último envío del `ActionForm` que lo contiene.
 * Marca el control con `aria-invalid` (el control se renderiza en el servidor, por eso el efecto).
 */
export function FieldError({ name, controlId, errorId, explicit }: { name?: string; controlId: string; errorId: string; explicit?: string }) {
  const contextError = useFieldError(name);
  const message = explicit ?? contextError;
  useEffect(() => {
    const el = document.getElementById(controlId);
    if (!el) return;
    if (message) el.setAttribute("aria-invalid", "true");
    else el.removeAttribute("aria-invalid");
  }, [controlId, message]);
  if (!message) return null;
  return (
    <p id={errorId} className="text-xs font-medium text-danger">
      {message}
    </p>
  );
}
