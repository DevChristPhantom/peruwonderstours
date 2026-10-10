"use client";

import { useEffect, useRef, type InputHTMLAttributes, type ReactNode } from "react";

import type { FormState } from "@/lib/content/form-state";

export const inputClass =
  "mt-1 block min-h-12 w-full rounded-md border border-border-strong bg-surface px-3 text-body aria-[invalid=true]:border-danger";

/** Campo con etiqueta, ayuda y error enlazados (`aria-describedby`, `aria-invalid`). */
export function Field({
  id,
  label,
  hint,
  error,
  multiline,
  ...input
}: { id: string; label: string; hint?: string; error?: string | null; multiline?: boolean } & InputHTMLAttributes<HTMLInputElement>) {
  const described = [hint ? `${id}-hint` : null, error ? `${id}-error` : null].filter(Boolean).join(" ") || undefined;
  const common = { id, "aria-describedby": described, "aria-invalid": error ? true : undefined };
  return (
    <div>
      <label htmlFor={id} className="block text-sm font-medium">
        {label}
      </label>
      {multiline ? (
        <textarea
          {...common}
          name={input.name}
          required={input.required}
          maxLength={input.maxLength}
          rows={6}
          className={`${inputClass} py-3`}
        />
      ) : (
        <input {...input} {...common} className={inputClass} />
      )}
      {hint ? (
        <p id={`${id}-hint`} className="mt-1 text-sm text-foreground-muted">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p id={`${id}-error`} className="mt-1 text-sm text-danger">
          {error}
        </p>
      ) : null}
    </div>
  );
}

/** Casilla de consentimiento (objetivo táctil de 44 px). */
export function Consent({ id, name, children, error }: { id: string; name: string; children: ReactNode; error?: boolean }) {
  return (
    <div className="flex min-h-11 items-start gap-3">
      <input id={id} name={name} type="checkbox" required aria-invalid={error ? true : undefined} className="mt-1 size-5 shrink-0 accent-primary" />
      <label htmlFor={id} className="text-sm">
        {children}
      </label>
    </div>
  );
}

/** Mensaje de resultado, enfocado al cambiar para que lo lean los lectores de pantalla. */
export function FormMessage({ state, text }: { state: FormState; text: (status: Exclude<FormState["status"], "idle">) => string }) {
  const ref = useRef<HTMLParagraphElement>(null);
  useEffect(() => {
    if (state.status !== "idle") ref.current?.focus();
  }, [state]);
  if (state.status === "idle") return null;
  const ok = state.status === "success";
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
      {text(state.status)}
    </p>
  );
}
