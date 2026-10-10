"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { AlertTriangle } from "lucide-react";
import { useRef, type Ref } from "react";
import { useForm } from "react-hook-form";

import { useTravelersText } from "@/hooks/useTravelersText";
import { travelerCount, type CartLine } from "@/lib/cart/types";
import { DOC_TYPES, travelersSchema, type ContactValues, type TravelersValues } from "@/lib/checkout/schemas";
import { formatDate } from "@/lib/format";
import { buttonClass } from "@/components/ui/button-styles";
import { ErrorSummary, fieldId, flattenErrors, inputClass, SelectField, TextField } from "./form-fields";

function emptyTraveler() {
  return { fullName: "", docType: "dni" as const, docNumber: "", nationality: "" };
}

/** Valores iniciales: un bloque por tour con tantos viajeros como haya elegido. */
export function buildTravelerDefaults(lines: CartLine[], contact: ContactValues, previous: TravelersValues | null): TravelersValues {
  const contactName = `${contact.firstName} ${contact.lastName}`.trim();
  return {
    useContactForFirst: previous?.useContactForFirst ?? true,
    hotel: previous?.hotel ?? "",
    notes: previous?.notes ?? "",
    lines: lines.map((line) => {
      const prev = previous?.lines.find((l) => l.lineId === line.id);
      const n = Math.max(1, travelerCount(line.travelers));
      return {
        lineId: line.id,
        travelers: Array.from({ length: n }, (_, i) => {
          const base = prev?.travelers[i] ?? emptyTraveler();
          if (i === 0 && (previous?.useContactForFirst ?? true) && !base.fullName) {
            return { ...base, fullName: contactName, nationality: contact.country === "Perú" ? "Peruana" : base.nationality };
          }
          return base;
        }),
      };
    }),
  };
}

export function TravelersStep({
  lines,
  contact,
  defaultValues,
  onSubmit,
  onBack,
  headingRef,
}: {
  lines: CartLine[];
  contact: ContactValues;
  defaultValues: TravelersValues;
  onSubmit: (values: TravelersValues) => void;
  onBack: () => void;
  headingRef: Ref<HTMLHeadingElement>;
}) {
  const travelersText = useTravelersText();
  const summaryRef = useRef<HTMLDivElement>(null);
  const {
    register,
    handleSubmit,
    setValue,
    getValues,
    formState: { errors, submitCount },
  } = useForm<TravelersValues>({ resolver: zodResolver(travelersSchema), defaultValues, mode: "onBlur" });
  const flat = flattenErrors(errors);
  const contactName = `${contact.firstName} ${contact.lastName}`.trim();
  const needsExactDocs = lines.some((l) => l.paymentPolicy.depositPercent >= 100);

  return (
    <form
      noValidate
      aria-labelledby="step-travelers-title"
      onSubmit={(e) => handleSubmit(onSubmit, () => requestAnimationFrame(() => summaryRef.current?.focus()))(e)}
    >
      <h2 id="step-travelers-title" ref={headingRef} tabIndex={-1} className="font-display text-h2 font-medium focus:outline-none">
        Viajeros
      </h2>
      <p className="mt-2 mb-6 text-foreground-muted">Datos de cada persona, tal como figuran en su documento.</p>

      {submitCount > 0 ? <ErrorSummary ref={summaryRef} errors={flat} /> : null}

      {needsExactDocs ? (
        <p className="mb-6 flex gap-3 rounded-md bg-warning-soft p-4 text-sm text-warning">
          <AlertTriangle aria-hidden size={20} strokeWidth={1.5} className="shrink-0" />
          Los boletos de Machu Picchu y tren se emiten con el nombre y documento exactos. Revísalos bien.
        </p>
      ) : null}

      <label className="mb-6 flex cursor-pointer items-start gap-3">
        <input
          type="checkbox"
          className="mt-1 size-5 shrink-0"
          {...register("useContactForFirst", {
            onChange: (e: { target: { checked: boolean } }) => {
              const checked = e.target.checked;
              getValues("lines").forEach((_, li) => {
                setValue(`lines.${li}.travelers.0.fullName`, checked ? contactName : "", { shouldValidate: false });
              });
            },
          })}
        />
        <span>Usar mis datos para el viajero 1 ({contactName || "quien reserva"})</span>
      </label>

      <div className="space-y-8">
        {lines.map((line, li) => (
          <fieldset key={line.id} className="rounded-lg border border-border p-5">
            <legend className="px-2 font-medium">
              {line.title}
              <span className="block text-sm font-normal text-foreground-muted">
                {formatDate(line.date)} · {travelersText(line.travelers)}
              </span>
            </legend>
            <input type="hidden" {...register(`lines.${li}.lineId`)} />
            <div className="space-y-6">
              {defaultValues.lines[li]?.travelers.map((_, ti) => {
                const base = `lines.${li}.travelers.${ti}` as const;
                const err = errors.lines?.[li]?.travelers?.[ti];
                return (
                  <div key={ti} className="grid gap-4 md:grid-cols-2">
                    <p className="text-sm font-medium text-foreground-muted md:col-span-2">Viajero {ti + 1}</p>
                    <div className="md:col-span-2">
                      <TextField
                        path={`${base}.fullName`}
                        label="Nombres y apellidos"
                        autoComplete={ti === 0 ? "name" : "off"}
                        error={err?.fullName?.message}
                        {...register(`${base}.fullName`)}
                      />
                    </div>
                    <SelectField path={`${base}.docType`} label="Tipo de documento" {...register(`${base}.docType`)}>
                      {DOC_TYPES.map((d) => (
                        <option key={d.value} value={d.value}>
                          {d.label}
                        </option>
                      ))}
                    </SelectField>
                    <TextField
                      path={`${base}.docNumber`}
                      label="Número de documento"
                      autoComplete="off"
                      error={err?.docNumber?.message}
                      {...register(`${base}.docNumber`)}
                    />
                    <div className="md:col-span-2">
                      <TextField
                        path={`${base}.nationality`}
                        label="Nacionalidad"
                        autoComplete="off"
                        error={err?.nationality?.message}
                        {...register(`${base}.nationality`)}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </fieldset>
        ))}
      </div>

      <div className="mt-8 grid gap-5">
        <TextField path="hotel" label="Hotel para el recojo" optional autoComplete="off" {...register("hotel")} />
        <div>
          <label htmlFor={fieldId("notes")} className="block text-sm font-medium">
            Necesidades especiales o alimentación <span className="font-normal text-foreground-muted">(opcional)</span>
          </label>
          <textarea
            id={fieldId("notes")}
            rows={3}
            className={`${inputClass} py-3`}
            aria-invalid={!!errors.notes}
            aria-describedby={errors.notes ? `${fieldId("notes")}-error` : undefined}
            {...register("notes")}
          />
          {errors.notes ? (
            <p id={`${fieldId("notes")}-error`} className="mt-1 text-sm text-danger">
              {errors.notes.message}
            </p>
          ) : null}
        </div>
      </div>

      <div className="mt-8 flex flex-col-reverse gap-3 md:flex-row md:items-center">
        <button type="button" className={buttonClass("ghost", "lg")} onClick={onBack}>
          Volver a tus datos
        </button>
        <button type="submit" className={buttonClass("primary", "lg", "md:ml-auto")}>
          Continuar al pago
        </button>
      </div>
    </form>
  );
}
