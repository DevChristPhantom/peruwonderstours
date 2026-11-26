"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, useWatch } from "react-hook-form";
import type { z } from "zod";

import { cancelBookingAction } from "@/app/(panel)/reservas/actions";
import { ErrorSummary } from "@/components/forms/ActionForm";
import { Field } from "@/components/forms/Field";
import { useActionSubmit } from "@/components/forms/useActionSubmit";
import { Alert } from "@/components/ui/Alert";
import { buttonClass } from "@/components/ui/styles";
import type { CancellationQuote } from "@/lib/api/types";
import { formatMoney } from "@/lib/format";
import { cancelSchema } from "@/lib/schemas/bookings";

type Input = z.input<typeof cancelSchema>;

/**
 * Cancelación con la cotización de reembolso de la política (días HÁBILES antes del primer
 * servicio). Se puede fijar otro monto con motivo obligatorio (queda auditado).
 */
export function CancelForm({ code, quote }: { code: string; quote: CancellationQuote }) {
  const calendar = quote.policyKind === "calendar-cap";
  const { register, handleSubmit, setError, formState, getValues, control } = useForm<Input, unknown, z.output<typeof cancelSchema>>({
    resolver: zodResolver(cancelSchema),
    defaultValues: { reason: "", override: calendar, overrideAmount: "", overrideReason: "", cancellationReceivedDate: "" },
  });
  const { submit, pending, error, success } = useActionSubmit((v: Input) => cancelBookingAction(code, v), { setError });
  const override = useWatch({ control, name: "override" });
  const e = formState.errors;

  return (
    <form
      noValidate
      className="space-y-3"
      onSubmit={handleSubmit(() => {
        if (!window.confirm(`¿Cancelar la reserva ${code}? Se liberan los cupos y se envía el correo de cancelación al cliente.`)) return;
        return submit(getValues());
      })}
    >
      {error ? <ErrorSummary error={error} /> : null}
      {success ? (
        <Alert tone="success" role="status">
          Reserva cancelada. Reembolso adeudado: {formatMoney(success.refundDue)}. Regístralo cuando hagas la devolución.
        </Alert>
      ) : null}

      <div className="rounded-sm border border-border bg-surface-muted p-3 text-sm">
        <p className="font-medium">Cotización según la política</p>
        <ul className="mt-1 space-y-0.5">
          <li>
            Pagado: <strong>{formatMoney(quote.paid)}</strong>
          </li>
          {calendar ? <>
            <li>Referencia si la solicitud llegó hoy: {quote.calendarDaysBefore} días calendario.</li>
            <li>Retención máxima de referencia: {formatMoney(quote.retainedAmount)} ({quote.maximumRetentionPercent} % del total, limitada a lo abonado).</li>
            <li>Reembolso mínimo de referencia: {formatMoney(quote.refundAmount)}. No es un cargo automático.</li>
          </> : <>
            <li>Días hábiles antes del primer servicio: <strong>{quote.businessDaysBefore}</strong> → tramo de {quote.tier.refundPercent} %</li>
            <li>Reembolso: <strong>{formatMoney(quote.refundAmount)}</strong> · Retiene la agencia: {formatMoney(quote.retainedAmount)}</li>
          </>}
        </ul>
        <details className="mt-2 text-xs text-foreground-muted">
          <summary className="cursor-pointer">Ver tramos de la política</summary>
          <ul className="mt-1 list-disc pl-5">
            {calendar ? quote.calendarTiers?.map((t) => <li key={t.minDaysBefore}>{t.minDaysBefore}+ días calendario: retención máxima {t.maxRetentionPercent} % del total.</li>) : quote.tiers.map((t) => (
              <li key={t.minBusinessDaysBefore}>
                {t.minBusinessDaysBefore}+ días hábiles: {t.refundPercent} %
              </li>
            ))}
          </ul>
          <p className="mt-1">{quote.policyNote}</p>
        </details>
      </div>

      <Field label="Motivo de la cancelación" name="reason" hint="Ej.: solicitud del cliente por correo del 08/10/2026." error={e.reason?.message} required>
        <textarea className="field-input" maxLength={calendar ? 220 : 500} rows={2} {...register("reason")} />
      </Field>
      {calendar ? <Field label="Fecha de recepción de la solicitud (hora de Perú)" name="cancellationReceivedDate" hint="Usa la fecha del correo o mensaje recibido, no la fecha en que lo estás procesando. El servidor recalcula el límite con esta fecha." error={e.cancellationReceivedDate?.message} required>
        <input type="date" className="field-input" max={quote.receivedDate} {...register("cancellationReceivedDate", { required: true })} />
      </Field> : <label className="flex min-h-11 cursor-pointer items-center gap-2 text-sm">
        <input type="checkbox" className="size-5" {...register("override")} />
        Reembolsar un monto distinto al de la política
      </label>}
      {override ? (
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label={`Monto a reembolsar (${quote.paid.currency})`} name="overrideAmount" error={e.overrideAmount?.message} required>
            <input inputMode="decimal" className="field-input tabular-nums" {...register("overrideAmount")} />
          </Field>
          <Field label={calendar ? "Justificación de costos y reembolso" : "Motivo del monto distinto"} name="overrideReason" error={e.overrideReason?.message} required>
            <input className="field-input" maxLength={calendar ? 220 : 500} {...register("overrideReason")} />
          </Field>
        </div>
      ) : null}
      {calendar ? <p className="text-sm text-foreground-muted">Indica los costos reales documentados sin duplicarlos; si no existen, devuelve todo lo abonado pendiente. No uses el límite máximo como retención automática. El reembolso debe incluir los derechos y condiciones particulares aplicables.</p> : null}
      <button type="submit" disabled={pending || Boolean(success)} aria-busy={pending || undefined} className={buttonClass("danger")}>
        {pending ? "Cancelando…" : "Cancelar reserva"}
      </button>
    </form>
  );
}
