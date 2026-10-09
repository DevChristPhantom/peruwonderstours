"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import type { z } from "zod";

import { updateTourAction } from "@/app/(panel)/tours/actions";
import { ErrorSummary } from "@/components/forms/ActionForm";
import { Field } from "@/components/forms/Field";
import { useActionSubmit } from "@/components/forms/useActionSubmit";
import { Alert } from "@/components/ui/Alert";
import { buttonClass } from "@/components/ui/styles";
import type { TourDetail } from "@/lib/api/types";
import { tourFieldsSchema, type TourFieldsInput } from "@/lib/schemas/tours";

const s = (v: number | null | undefined) => (v === null || v === undefined ? "" : String(v));

export function TourFieldsForm({ tour, readOnly }: { tour: TourDetail; readOnly: boolean }) {
  const { register, handleSubmit, setError, formState, getValues } = useForm<TourFieldsInput, unknown, z.output<typeof tourFieldsSchema>>({
    resolver: zodResolver(tourFieldsSchema),
    defaultValues: {
      type: tour.type,
      code: tour.code,
      durationDays: s(tour.durationDays),
      durationNights: s(tour.durationNights),
      durationHours: s(tour.durationHours),
      minPax: tour.minPax,
      maxPax: s(tour.maxPax),
      difficulty: tour.difficulty ?? "",
      languages: tour.languages.join(", "),
      bookingCutoffHours: tour.bookingCutoffHours,
      depositPercentOverride: s(tour.depositPercentOverride),
      requiresTravelerDocument: tour.requiresTravelerDocument,
      usesInventory: tour.usesInventory,
      isFeatured: tour.isFeatured,
    },
  });
  const { submit, pending, error, success } = useActionSubmit((v: TourFieldsInput) => updateTourAction(tour.id, tour.version, v), { setError });
  const e = formState.errors;

  return (
    <form noValidate className="space-y-3" onSubmit={handleSubmit(() => submit(getValues()))}>
      {error ? <ErrorSummary error={error} /> : null}
      {success ? (
        <Alert tone="success" role="status">
          Datos generales guardados.
        </Alert>
      ) : null}
      <fieldset disabled={readOnly || pending} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Field label="Tipo" name="type" error={e.type?.message} required>
          <select className="field-input" {...register("type")}>
            <option value="tour">Tour</option>
            <option value="package">Paquete</option>
            <option value="transfer">Traslado</option>
          </select>
        </Field>
        <Field label="Código" name="code" error={e.code?.message} required>
          <input className="field-input font-mono uppercase" maxLength={40} {...register("code")} />
        </Field>
        <Field label="Duración (horas)" name="durationHours" error={e.durationHours?.message}>
          <input inputMode="decimal" className="field-input" {...register("durationHours")} />
        </Field>
        <div className="grid grid-cols-2 gap-2">
          <Field label="Días" name="durationDays" error={e.durationDays?.message}>
            <input inputMode="numeric" className="field-input" {...register("durationDays")} />
          </Field>
          <Field label="Noches" name="durationNights" error={e.durationNights?.message}>
            <input inputMode="numeric" className="field-input" {...register("durationNights")} />
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <Field label="Pax mín." name="minPax" error={e.minPax?.message} required>
            <input inputMode="numeric" className="field-input" {...register("minPax")} />
          </Field>
          <Field label="Pax máx." name="maxPax" error={e.maxPax?.message}>
            <input inputMode="numeric" className="field-input" {...register("maxPax")} />
          </Field>
        </div>
        <Field label="Dificultad" name="difficulty" error={e.difficulty?.message}>
          <select className="field-input" {...register("difficulty")}>
            <option value="">Sin indicar</option>
            <option value="easy">Fácil</option>
            <option value="moderate">Moderada</option>
            <option value="challenging">Exigente</option>
            <option value="extreme">Extrema</option>
          </select>
        </Field>
        <Field label="Idiomas" name="languages" hint="Códigos separados por coma: es, en" error={e.languages?.message}>
          <input className="field-input" {...register("languages")} />
        </Field>
        <Field label="Cierre de reservas (horas antes)" name="bookingCutoffHours" error={e.bookingCutoffHours?.message} required>
          <input inputMode="numeric" className="field-input" {...register("bookingCutoffHours")} />
        </Field>
        <Field label="Adelanto propio (%)" name="depositPercentOverride" hint="Vacío = regla general." error={e.depositPercentOverride?.message}>
          <input inputMode="numeric" className="field-input" {...register("depositPercentOverride")} />
        </Field>
        <div className="flex flex-col justify-end gap-1 sm:col-span-2 lg:col-span-3">
          <label className="flex min-h-9 cursor-pointer items-center gap-2 text-sm">
            <input type="checkbox" className="size-5" {...register("usesInventory")} /> Controla cupos (salidas con capacidad)
          </label>
          <label className="flex min-h-9 cursor-pointer items-center gap-2 text-sm">
            <input type="checkbox" className="size-5" {...register("requiresTravelerDocument")} /> Exige documento de los viajeros
          </label>
          <label className="flex min-h-9 cursor-pointer items-center gap-2 text-sm">
            <input type="checkbox" className="size-5" {...register("isFeatured")} /> Destacado en la home
          </label>
        </div>
      </fieldset>
      {!readOnly ? (
        <button type="submit" disabled={pending} aria-busy={pending || undefined} className={buttonClass("secondary")}>
          {pending ? "Guardando…" : "Guardar datos generales"}
        </button>
      ) : null}
    </form>
  );
}
