"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useForm, useWatch } from "react-hook-form";
import type { z } from "zod";

import { transcribeAction } from "@/app/(panel)/reclamos/actions";
import { ErrorSummary } from "@/components/forms/ActionForm";
import { Field } from "@/components/forms/Field";
import { useActionSubmit } from "@/components/forms/useActionSubmit";
import { Alert } from "@/components/ui/Alert";
import { buttonClass } from "@/components/ui/styles";
import { formatDateTime } from "@/lib/format";
import { transcriptionSchema, type TranscriptionInput } from "@/lib/schemas/complaints";

/** Transcripción de una hoja del libro de reclamaciones físico de respaldo (art. 4-A). */
export function TranscriptionForm() {
  const { register, handleSubmit, setError, formState, getValues, control, reset } = useForm<TranscriptionInput, unknown, z.output<typeof transcriptionSchema>>({
    resolver: zodResolver(transcriptionSchema),
    defaultValues: {
      backupSheetNumber: "",
      submittedAt: "",
      declaredType: "",
      consumer: { fullName: "", docType: "dni", docNumber: "", address: "", phone: "+51", email: "", isMinor: false },
      guardian: { fullName: "", address: "", phone: "", email: "" },
      good: { type: "service", description: "", claimedAmount: "", currency: "PEN" },
      detail: "",
      consumerRequest: "",
      responseChannel: "email",
      bookingCode: "",
    },
  });
  const { submit, pending, error, success } = useActionSubmit((v: TranscriptionInput) => transcribeAction(v), { setError, refresh: false, onSuccess: () => reset() });
  const e = formState.errors;
  const minor = useWatch({ control, name: "consumer.isMinor" });

  if (success) {
    return (
      <div className="space-y-3">
        <Alert tone="success" role="status" title={`Hoja transcrita: ${success.code}`}>
          Hoja virtual {success.sheetNumber} (física n.º {success.backupSheetNumber}). Vence el {formatDateTime(success.responseDueAt)}. Se envió la constancia al consumidor.
        </Alert>
        {success.warning ? <Alert tone="warning">{success.warning}</Alert> : null}
        <div className="flex gap-2">
          <Link href={`/reclamos/${success.id}`} className={buttonClass("secondary")}>
            Abrir la hoja
          </Link>
          <Link href="/reclamos" className={buttonClass("outline")}>
            Volver a la bandeja
          </Link>
        </div>
      </div>
    );
  }

  return (
    <form noValidate className="space-y-5" onSubmit={handleSubmit(() => submit(getValues()))}>
      {error ? <ErrorSummary error={error} /> : null}

      <fieldset className="grid gap-3 sm:grid-cols-3">
        <legend className="mb-2 text-sm font-semibold">Hoja física</legend>
        <Field label="N.º de hoja física" name="backupSheetNumber" error={e.backupSheetNumber?.message} required>
          <input className="field-input font-mono" maxLength={40} {...register("backupSheetNumber")} />
        </Field>
        <Field label="Llenada el (hora de Lima)" name="submittedAt" hint="Debe transcribirse en 1 día calendario." error={e.submittedAt?.message} required>
          <input type="datetime-local" className="field-input" {...register("submittedAt")} />
        </Field>
        <Field label="Tipo marcado por el consumidor" name="declaredType" error={e.declaredType?.message}>
          <select className="field-input" {...register("declaredType")}>
            <option value="">No marcó</option>
            <option value="reclamo">Reclamo</option>
            <option value="queja">Queja</option>
          </select>
        </Field>
      </fieldset>

      <fieldset className="grid gap-3 sm:grid-cols-2">
        <legend className="mb-2 text-sm font-semibold">1. Consumidor</legend>
        <Field label="Nombre completo" name="consumer.fullName" error={e.consumer?.fullName?.message} required>
          <input className="field-input" maxLength={200} {...register("consumer.fullName")} />
        </Field>
        <div className="grid grid-cols-[140px_1fr] gap-2">
          <Field label="Documento" name="consumer.docType" error={e.consumer?.docType?.message} required>
            <select className="field-input" {...register("consumer.docType")}>
              <option value="dni">DNI</option>
              <option value="ce">C. extranjería</option>
              <option value="passport">Pasaporte</option>
              <option value="other">Otro</option>
            </select>
          </Field>
          <Field label="Número" name="consumer.docNumber" error={e.consumer?.docNumber?.message} required>
            <input className="field-input font-mono" maxLength={20} {...register("consumer.docNumber")} />
          </Field>
        </div>
        <Field label="Domicilio" name="consumer.address" error={e.consumer?.address?.message} required>
          <input className="field-input" maxLength={300} {...register("consumer.address")} />
        </Field>
        <Field label="Teléfono" name="consumer.phone" hint="Con código de país: +51987654321" error={e.consumer?.phone?.message} required>
          <input type="tel" className="field-input" maxLength={16} {...register("consumer.phone")} />
        </Field>
        <Field label="Correo" name="consumer.email" error={e.consumer?.email?.message} required>
          <input type="email" className="field-input" maxLength={254} {...register("consumer.email")} />
        </Field>
        <label className="flex min-h-11 cursor-pointer items-center gap-2 self-end text-sm">
          <input type="checkbox" className="size-5" {...register("consumer.isMinor")} />
          Es menor de edad
        </label>
      </fieldset>

      {minor ? (
        <fieldset className="grid gap-3 sm:grid-cols-2">
          <legend className="mb-2 text-sm font-semibold">Padre, madre o apoderado</legend>
          <Field label="Nombre" name="guardian.fullName" error={e.guardian?.fullName?.message} required>
            <input className="field-input" {...register("guardian.fullName")} />
          </Field>
          <Field label="Domicilio" name="guardian.address" error={e.guardian?.address?.message} required>
            <input className="field-input" {...register("guardian.address")} />
          </Field>
          <Field label="Teléfono" name="guardian.phone" error={e.guardian?.phone?.message} required>
            <input type="tel" className="field-input" {...register("guardian.phone")} />
          </Field>
          <Field label="Correo" name="guardian.email" error={e.guardian?.email?.message} required>
            <input type="email" className="field-input" {...register("guardian.email")} />
          </Field>
        </fieldset>
      ) : null}

      <fieldset className="grid gap-3 sm:grid-cols-4">
        <legend className="mb-2 text-sm font-semibold">2. Bien contratado</legend>
        <Field label="Tipo" name="good.type" error={e.good?.type?.message} required>
          <select className="field-input" {...register("good.type")}>
            <option value="service">Servicio</option>
            <option value="product">Producto</option>
          </select>
        </Field>
        <Field label="Monto reclamado" name="good.claimedAmount" error={e.good?.claimedAmount?.message}>
          <input inputMode="decimal" className="field-input" {...register("good.claimedAmount")} />
        </Field>
        <Field label="Moneda" name="good.currency">
          <select className="field-input" {...register("good.currency")}>
            <option value="PEN">PEN</option>
            <option value="USD">USD</option>
          </select>
        </Field>
        <Field label="N.º de reserva (opcional)" name="bookingCode" error={e.bookingCode?.message}>
          <input className="field-input font-mono uppercase" maxLength={20} {...register("bookingCode")} />
        </Field>
        <Field label="Descripción" name="good.description" error={e.good?.description?.message} required className="sm:col-span-4">
          <input className="field-input" maxLength={500} {...register("good.description")} />
        </Field>
      </fieldset>

      <fieldset className="space-y-3">
        <legend className="mb-2 text-sm font-semibold">3. Detalle y pedido</legend>
        <Field label="Detalle" name="detail" error={e.detail?.message} required>
          <textarea className="field-input" rows={5} maxLength={5000} {...register("detail")} />
        </Field>
        <Field label="Pedido del consumidor" name="consumerRequest" error={e.consumerRequest?.message} required>
          <textarea className="field-input" rows={3} maxLength={2000} {...register("consumerRequest")} />
        </Field>
        <Field label="Respuesta por" name="responseChannel" error={e.responseChannel?.message} required>
          <select className="field-input max-w-xs" {...register("responseChannel")}>
            <option value="email">Correo electrónico</option>
            <option value="letter">Carta</option>
          </select>
        </Field>
      </fieldset>

      <button type="submit" disabled={pending} aria-busy={pending || undefined} className={buttonClass("primary")}>
        {pending ? "Transcribiendo…" : "Transcribir hoja"}
      </button>
    </form>
  );
}
