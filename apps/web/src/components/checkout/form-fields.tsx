"use client";

import { useTranslations } from "next-intl";
import { forwardRef, useCallback, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes } from "react";
import type { FieldError, FieldErrors } from "react-hook-form";

/**
 * Traduce un mensaje de validación: los esquemas (checkout, Libro de Reclamaciones) usan claves de
 * `formErrors` (`clave` o `clave|n`). Un texto que no es clave (p. ej. ya traducido por el servidor)
 * se muestra tal cual.
 */
export function useErrorText(): (message: string | undefined) => string | undefined {
  const t = useTranslations("formErrors");
  return useCallback(
    (message: string | undefined) => {
      if (!message) return message;
      const [key, n] = message.split("|");
      const k = key as Parameters<typeof t>[0];
      return t.has(k) ? t(k, { n: Number(n ?? 0), count: 0 }) : message;
    },
    [t],
  );
}

/** Id estable de un campo a partir de su ruta ("lines.0.travelers.1.fullName" → "f-lines-0-travelers-1-fullName"). */
export function fieldId(path: string): string {
  return `f-${path.replace(/\./g, "-")}`;
}

export const inputClass =
  "mt-1 block min-h-12 w-full rounded-md border border-border-strong bg-surface px-3 text-body text-foreground " +
  "aria-invalid:border-danger focus-visible:border-primary";

interface FieldShellProps {
  id: string;
  label: ReactNode;
  error?: string;
  hint?: ReactNode;
  children: ReactNode;
  optional?: boolean;
}

export function FieldShell({ id, label, error: rawError, hint, children, optional }: FieldShellProps) {
  const t = useTranslations("formErrors");
  const error = useErrorText()(rawError);
  return (
    <div>
      <label htmlFor={id} className="block text-sm font-medium text-foreground">
        {label}
        {optional ? <span className="font-normal text-foreground-muted"> {t("optional")}</span> : null}
      </label>
      {children}
      {hint && !error ? (
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

type TextFieldProps = InputHTMLAttributes<HTMLInputElement> & {
  path: string;
  label: ReactNode;
  error?: string;
  hint?: ReactNode;
  optional?: boolean;
};

export const TextField = forwardRef<HTMLInputElement, TextFieldProps>(function TextField(
  { path, label, error, hint, optional, className, ...rest },
  ref,
) {
  const id = fieldId(path);
  const describedBy = error ? `${id}-error` : hint ? `${id}-hint` : undefined;
  return (
    <FieldShell id={id} label={label} error={error} hint={hint} optional={optional}>
      <input
        ref={ref}
        id={id}
        aria-invalid={!!error}
        aria-describedby={describedBy}
        className={`${inputClass} ${className ?? ""}`}
        {...rest}
      />
    </FieldShell>
  );
});

type SelectFieldProps = SelectHTMLAttributes<HTMLSelectElement> & {
  path: string;
  label: ReactNode;
  error?: string;
  children: ReactNode;
};

export const SelectField = forwardRef<HTMLSelectElement, SelectFieldProps>(function SelectField(
  { path, label, error, children, className, ...rest },
  ref,
) {
  const id = fieldId(path);
  return (
    <FieldShell id={id} label={label} error={error}>
      <select
        ref={ref}
        id={id}
        aria-invalid={!!error}
        aria-describedby={error ? `${id}-error` : undefined}
        className={`${inputClass} ${className ?? ""}`}
        {...rest}
      >
        {children}
      </select>
    </FieldShell>
  );
});

export interface FlatError {
  path: string;
  message: string;
}

/** Aplana el árbol de errores de RHF en una lista ordenada (para el resumen de errores). */
export function flattenErrors(errors: FieldErrors, prefix = ""): FlatError[] {
  const out: FlatError[] = [];
  for (const [key, value] of Object.entries(errors)) {
    if (!value || key === "root" || key === "ref") continue;
    const path = prefix ? `${prefix}.${key}` : key;
    const fe = value as FieldError;
    if (typeof fe.message === "string" && fe.message) {
      out.push({ path, message: fe.message });
    } else if (typeof value === "object") {
      out.push(...flattenErrors(value as FieldErrors, path));
    }
  }
  return out;
}

/** Resumen de errores enfocable (checkout.md · Estados y errores). */
export const ErrorSummary = forwardRef<
  HTMLDivElement,
  { errors: FlatError[]; labels?: Record<string, string>; title?: string; children?: ReactNode }
>(function ErrorSummary({ errors, labels, title, children }, ref) {
    const t = useTranslations("formErrors");
    const errorText = useErrorText();
    if (!errors.length) return null;
    return (
      <div ref={ref} role="alert" tabIndex={-1} className="mb-6 rounded-md border border-danger bg-danger-soft p-4 text-danger focus:outline-2">
        <p className="font-medium">
          {title ?? t("summaryTitle", { count: errors.length })}
        </p>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-sm">
          {errors.map((e) => (
            <li key={e.path}>
              <a
                href={`#${fieldId(e.path)}`}
                className="underline underline-offset-2"
                onClick={(ev) => {
                  ev.preventDefault();
                  document.getElementById(fieldId(e.path))?.focus();
                }}
              >
                {labels?.[e.path] ? `${labels[e.path]}: ` : ""}
                {errorText(e.message)}
              </a>
            </li>
          ))}
        </ul>
        {children}
      </div>
    );
});
