import clsx from "clsx";
import { cloneElement, isValidElement } from "react";

import { FieldError } from "./ActionForm";

/**
 * Etiqueta visible + ayuda + error enlazado (`aria-describedby`). Sin hooks: sirve en Server y
 * Client Components (el control se clona aquí, del lado donde se crea). `name` coincide con el
 * `field` que devuelve la API para mostrar su error junto al control.
 */
export function Field({
  label,
  name,
  hint,
  error,
  required,
  children,
  className,
  idPrefix,
}: {
  label: React.ReactNode;
  name: string;
  hint?: React.ReactNode;
  /** Error explícito (formularios con React Hook Form). */
  error?: string;
  required?: boolean;
  /** Un único control (`input`, `select`, `textarea`). */
  children: React.ReactElement<Record<string, unknown>>;
  className?: string;
  /** Prefijo para formularios repetidos en la misma página (ids únicos: cada etiqueta apunta a su campo). */
  idPrefix?: string;
}) {
  const id = `f-${idPrefix ? `${idPrefix}-` : ""}${name.replace(/[^\w-]/g, "-")}`;
  const hintId = hint ? `${id}-ayuda` : undefined;
  const errorId = `${id}-error`;
  return (
    <div className={clsx("min-w-0 space-y-1", className)}>
      <label htmlFor={id} className="block text-sm font-medium">
        {label}
        {required ? (
          <span className="text-danger" aria-hidden>
            {" "}
            *
          </span>
        ) : null}
      </label>
      {isValidElement(children)
        ? cloneElement(children, {
            id,
            name: children.props.name ?? name,
            required: children.props.required ?? required,
            "aria-describedby": [hintId, errorId].filter(Boolean).join(" "),
            ...(error ? { "aria-invalid": true } : {}),
          })
        : children}
      {hint ? (
        <p id={hintId} className="text-xs text-foreground-muted">
          {hint}
        </p>
      ) : null}
      <FieldError name={name} controlId={id} errorId={errorId} explicit={error} />
    </div>
  );
}
