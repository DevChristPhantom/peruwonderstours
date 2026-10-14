"use client";

import { useLocale, useTranslations } from "next-intl";
import { useCallback, type ReactNode, type TextareaHTMLAttributes } from "react";

import { COMPLAINT_LABELS, type ComplaintLabelKey } from "@/lib/complaints/schema";
import { INTL_LOCALE, type Locale } from "@/i18n/routing";
import { fieldId, inputClass, useErrorText } from "@/components/checkout/form-fields";

/**
 * Piezas del formulario del Libro de Reclamaciones. Los rótulos legales (Anexo I) van en español en
 * todos los idiomas; fuera de `/es` se agrega debajo una ayuda en el idioma del visitante.
 */

/** Ayuda localizada (solo fuera de `/es`) para un texto legal que se mantiene en español. */
export function EnglishHelp({ children, block = true }: { children: ReactNode; block?: boolean }) {
  const locale = useLocale() as Locale;
  return (
    <span lang={INTL_LOCALE[locale]} className={`${block ? "block" : ""} text-xs font-normal text-foreground-muted`}>
      {children}
    </span>
  );
}

/** Rótulo legal en español + ayuda en el idioma del visitante en `/en` y `/pt`. */
export function useLegalLabel(): (key: ComplaintLabelKey) => ReactNode {
  const locale = useLocale();
  const t = useTranslations("complaints.form.help");
  return useCallback(
    (key: ComplaintLabelKey) =>
      locale === "es" ? (
        COMPLAINT_LABELS[key]
      ) : (
        <>
          {COMPLAINT_LABELS[key]}
          <EnglishHelp>{t(key)}</EnglishHelp>
        </>
      ),
    [locale, t],
  );
}

/** Texto de ayuda en el idioma del visitante (no es rótulo legal). */
export function useHint(): (key: Parameters<ReturnType<typeof useTranslations<"complaints.form.hints">>>[0]) => ReactNode {
  const locale = useLocale();
  const t = useTranslations("complaints.form.hints");
  return useCallback((key) => <span lang={locale}>{t(key)}</span>, [locale, t]);
}

export function Section({ n, title, children }: { n: number; title: ReactNode; children: ReactNode }) {
  return (
    <fieldset className="mt-8 rounded-lg border border-border p-5">
      <legend className="px-2 font-medium">
        {n}. {title}
      </legend>
      <div className="grid gap-5 md:grid-cols-2">{children}</div>
    </fieldset>
  );
}

export function TextArea({
  path,
  label,
  error: rawError,
  hint,
  rows = 4,
  ...rest
}: { path: string; label: ReactNode; error?: string; hint?: ReactNode; rows?: number } & TextareaHTMLAttributes<HTMLTextAreaElement>) {
  const id = fieldId(path);
  const error = useErrorText()(rawError);
  return (
    <div className="md:col-span-2">
      <label htmlFor={id} className="block text-sm font-medium">
        {label}
      </label>
      {hint ? (
        <p id={`${id}-hint`} className="mt-1 text-sm text-foreground-muted">
          {hint}
        </p>
      ) : null}
      <textarea
        id={id}
        rows={rows}
        className={`${inputClass} py-3`}
        aria-invalid={!!error}
        aria-describedby={[error ? `${id}-error` : null, hint ? `${id}-hint` : null].filter(Boolean).join(" ") || undefined}
        {...rest}
      />
      {error ? (
        <p id={`${id}-error`} className="mt-1 text-sm text-danger">
          {error}
        </p>
      ) : null}
    </div>
  );
}
