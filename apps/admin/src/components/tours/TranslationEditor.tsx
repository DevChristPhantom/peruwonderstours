"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react";
import { useFieldArray, useForm } from "react-hook-form";
import type { z } from "zod";

import { saveTranslationAction } from "@/app/(panel)/tours/actions";
import { ErrorSummary } from "@/components/forms/ActionForm";
import { Field } from "@/components/forms/Field";
import { useActionSubmit } from "@/components/forms/useActionSubmit";
import { Alert } from "@/components/ui/Alert";
import { buttonClass } from "@/components/ui/styles";
import type { TourTranslation } from "@/lib/api/types";
import { translationSchema, type TranslationFormInput } from "@/lib/schemas/tours";

function toForm(t: TourTranslation | undefined, fallbackSlug: string): TranslationFormInput {
  return {
    slug: t?.slug ?? fallbackSlug,
    title: t?.title ?? "",
    summary: t?.summary ?? "",
    description: t?.description ?? "",
    itinerary: (t?.itinerary ?? []).map((d) => ({ title: d.title ?? "", description: d.description ?? "", meals: (d.meals ?? []).join(", "), overnight: d.overnight ?? "" })),
    includes: (t?.includes ?? []).join("\n"),
    notIncluded: (t?.notIncluded ?? []).join("\n"),
    recommendations: (t?.recommendations ?? []).join("\n"),
    importantNotes: (t?.importantNotes ?? []).join("\n"),
    faqs: t?.faqs ?? [],
    policies: t?.policies ?? "",
    meetingPoint: t?.meetingPoint ?? "",
    seoTitle: t?.seoTitle ?? "",
    seoDescription: t?.seoDescription ?? "",
  };
}

/**
 * Traducción canónica en español con editor de itinerario por días (agregar, reordenar, quitar).
 * Guarda con la `version` del tour: si otro usuario guardó antes, la API responde 409 y se pide recargar.
 */
export function TranslationEditor({ tourId, version, translation, fallbackSlug, readOnly }: { tourId: string; version: number; translation?: TourTranslation; fallbackSlug: string; readOnly: boolean }) {
  const { register, control, handleSubmit, setError, formState, getValues } = useForm<TranslationFormInput, unknown, z.output<typeof translationSchema>>({
    resolver: zodResolver(translationSchema),
    defaultValues: toForm(translation, fallbackSlug),
  });
  const days = useFieldArray({ control, name: "itinerary" });
  const faqs = useFieldArray({ control, name: "faqs" });
  const { submit, pending, error, success } = useActionSubmit((v: TranslationFormInput) => saveTranslationAction(tourId, version, v), { setError });
  const e = formState.errors;

  return (
    <form noValidate className="space-y-4" onSubmit={handleSubmit(() => submit(getValues()))}>
      {error ? <ErrorSummary error={error} /> : null}
      {success ? (
        <Alert tone="success" role="status">
          Traducción guardada.
        </Alert>
      ) : null}
      <fieldset disabled={readOnly || pending} className="space-y-4">
        <div className="grid gap-3 md:grid-cols-2">
          <Field label="Título" name="title" error={e.title?.message} required>
            <input className="field-input" maxLength={200} {...register("title")} />
          </Field>
          <Field label="Slug" name="slug" hint="Cambiarlo en un tour publicado crea un 301 automático." error={e.slug?.message} required>
            <input className="field-input font-mono" maxLength={160} {...register("slug")} />
          </Field>
        </div>
        <Field label="Resumen" name="summary" hint="Máx. 600 caracteres." error={e.summary?.message} required>
          <textarea className="field-input" rows={3} maxLength={600} {...register("summary")} />
        </Field>
        <Field label="Descripción" name="description" error={e.description?.message}>
          <textarea className="field-input" rows={6} {...register("description")} />
        </Field>

        <fieldset className="rounded-sm border border-border p-3">
          <legend className="px-1 text-sm font-semibold">Itinerario por días</legend>
          {e.itinerary?.message ? <p className="text-xs text-danger">{e.itinerary.message}</p> : null}
          {days.fields.length === 0 ? <p className="text-sm text-foreground-muted">Sin días. Agrega al menos uno para poder publicar.</p> : null}
          <ol className="space-y-3">
            {days.fields.map((field, i) => (
              <li key={field.id} className="rounded-sm border border-border bg-surface-muted p-3">
                <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm font-semibold">Día {i + 1}</p>
                  <div className="flex gap-1">
                    <button type="button" className={buttonClass("ghost", "sm")} onClick={() => days.move(i, i - 1)} disabled={i === 0} aria-label={`Subir el día ${i + 1}`}>
                      <ArrowUp aria-hidden size={16} />
                    </button>
                    <button type="button" className={buttonClass("ghost", "sm")} onClick={() => days.move(i, i + 1)} disabled={i === days.fields.length - 1} aria-label={`Bajar el día ${i + 1}`}>
                      <ArrowDown aria-hidden size={16} />
                    </button>
                    <button type="button" className={buttonClass("ghost", "sm", "text-danger")} onClick={() => days.remove(i)} aria-label={`Quitar el día ${i + 1}`}>
                      <Trash2 aria-hidden size={16} />
                    </button>
                  </div>
                </div>
                <div className="grid gap-3 md:grid-cols-2">
                  <Field label="Título del día" name={`itinerary.${i}.title`} error={e.itinerary?.[i]?.title?.message}>
                    <input className="field-input" maxLength={200} {...register(`itinerary.${i}.title`)} />
                  </Field>
                  <Field label="Alojamiento" name={`itinerary.${i}.overnight`} error={e.itinerary?.[i]?.overnight?.message}>
                    <input className="field-input" maxLength={120} {...register(`itinerary.${i}.overnight`)} />
                  </Field>
                  <Field label="Descripción" name={`itinerary.${i}.description`} error={e.itinerary?.[i]?.description?.message} required className="md:col-span-2">
                    <textarea className="field-input" rows={3} maxLength={5000} {...register(`itinerary.${i}.description`)} />
                  </Field>
                  <Field label="Comidas" name={`itinerary.${i}.meals`} hint="Separadas por coma: desayuno, almuerzo" error={e.itinerary?.[i]?.meals?.message}>
                    <input className="field-input" maxLength={200} {...register(`itinerary.${i}.meals`)} />
                  </Field>
                </div>
              </li>
            ))}
          </ol>
          <button type="button" className={buttonClass("outline", "sm", "mt-3")} onClick={() => days.append({ title: "", description: "", meals: "", overnight: "" })}>
            <Plus aria-hidden size={16} /> Agregar día
          </button>
        </fieldset>

        <div className="grid gap-3 md:grid-cols-2">
          <Field label="Incluye" name="includes" hint="Uno por línea.">
            <textarea className="field-input" rows={5} {...register("includes")} />
          </Field>
          <Field label="No incluye" name="notIncluded" hint="Uno por línea.">
            <textarea className="field-input" rows={5} {...register("notIncluded")} />
          </Field>
          <Field label="Recomendaciones" name="recommendations" hint="Una por línea.">
            <textarea className="field-input" rows={4} {...register("recommendations")} />
          </Field>
          <Field label="Notas importantes" name="importantNotes" hint="Una por línea.">
            <textarea className="field-input" rows={4} {...register("importantNotes")} />
          </Field>
          <Field label="Punto de encuentro" name="meetingPoint" error={e.meetingPoint?.message}>
            <textarea className="field-input" rows={2} maxLength={2000} {...register("meetingPoint")} />
          </Field>
          <Field label="Políticas" name="policies" error={e.policies?.message}>
            <textarea className="field-input" rows={2} {...register("policies")} />
          </Field>
          <Field label="Título SEO" name="seoTitle" hint="Máx. 70." error={e.seoTitle?.message}>
            <input className="field-input" maxLength={70} {...register("seoTitle")} />
          </Field>
          <Field label="Descripción SEO" name="seoDescription" hint="Máx. 170." error={e.seoDescription?.message}>
            <input className="field-input" maxLength={170} {...register("seoDescription")} />
          </Field>
        </div>

        <fieldset className="rounded-sm border border-border p-3">
          <legend className="px-1 text-sm font-semibold">Preguntas frecuentes</legend>
          <ol className="space-y-3">
            {faqs.fields.map((field, i) => (
              <li key={field.id} className="grid gap-2 md:grid-cols-[1fr_2fr_auto]">
                <Field label={`Pregunta ${i + 1}`} name={`faqs.${i}.question`} error={e.faqs?.[i]?.question?.message}>
                  <input className="field-input" maxLength={500} {...register(`faqs.${i}.question`)} />
                </Field>
                <Field label="Respuesta" name={`faqs.${i}.answer`} error={e.faqs?.[i]?.answer?.message}>
                  <input className="field-input" maxLength={4000} {...register(`faqs.${i}.answer`)} />
                </Field>
                <button type="button" className={buttonClass("ghost", "sm", "self-end text-danger")} onClick={() => faqs.remove(i)} aria-label={`Quitar la pregunta ${i + 1}`}>
                  <Trash2 aria-hidden size={16} />
                </button>
              </li>
            ))}
          </ol>
          <button type="button" className={buttonClass("outline", "sm", "mt-3")} onClick={() => faqs.append({ question: "", answer: "" })}>
            <Plus aria-hidden size={16} /> Agregar pregunta
          </button>
        </fieldset>
      </fieldset>
      {!readOnly ? (
        <button type="submit" disabled={pending} aria-busy={pending || undefined} className={buttonClass("secondary")}>
          {pending ? "Guardando…" : "Guardar traducción"}
        </button>
      ) : null}
    </form>
  );
}
