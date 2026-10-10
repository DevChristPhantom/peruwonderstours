"use client";

import { Minus, Plus } from "lucide-react";
import { useTranslations } from "next-intl";
import { useId } from "react";

interface CounterProps {
  label: string;
  hint?: string;
  value: number;
  min?: number;
  max?: number;
  onChange: (value: number) => void;
  /** Nombre en singular para los aria-label: "Quitar un adulto" / "Remove an adult". */
  unitName: string;
}

/** Contador −/+ con botones de 44 px (tour-detalle.md · Viajeros). */
export function Counter({ label, hint, value, min = 0, max = 20, onChange, unitName }: CounterProps) {
  const id = useId();
  const t = useTranslations("travelersPicker");
  const btn =
    "inline-flex size-11 items-center justify-center rounded-pill border border-border-strong text-foreground " +
    "transition-colors duration-150 hover:bg-surface-muted disabled:opacity-40";
  return (
    <div className="flex items-center justify-between gap-4 py-2" role="group" aria-labelledby={`${id}-label`}>
      <div>
        <p id={`${id}-label`} className="font-medium text-foreground">
          {label}
        </p>
        {hint ? <p className="text-sm text-foreground-muted">{hint}</p> : null}
      </div>
      <div className="flex items-center gap-3">
        <button
          type="button"
          className={btn}
          onClick={() => onChange(Math.max(min, value - 1))}
          disabled={value <= min}
          aria-label={t("remove", { unit: unitName })}
        >
          <Minus aria-hidden size={18} strokeWidth={1.5} />
        </button>
        <output className="tabular w-6 text-center text-body font-medium" aria-live="polite" aria-label={t("value", { label, value })}>
          {value}
        </output>
        <button
          type="button"
          className={btn}
          onClick={() => onChange(Math.min(max, value + 1))}
          disabled={value >= max}
          aria-label={t("add", { unit: unitName })}
        >
          <Plus aria-hidden size={18} strokeWidth={1.5} />
        </button>
      </div>
    </div>
  );
}
