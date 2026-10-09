"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import type { z } from "zod";

import { recordPaymentAction } from "@/app/(panel)/reservas/actions";
import { ErrorSummary } from "@/components/forms/ActionForm";
import { Field } from "@/components/forms/Field";
import { useActionSubmit } from "@/components/forms/useActionSubmit";
import { Alert } from "@/components/ui/Alert";
import { buttonClass } from "@/components/ui/styles";
import type { Money } from "@/lib/api/types";
import { centsToInput, formatMoney } from "@/lib/format";
import { paymentSchema } from "@/lib/schemas/bookings";

type Input = z.input<typeof paymentSchema>;

/**
 * Pago manual (efectivo / transferencia). La `Idempotency-Key` la genera el servidor al renderizar
 * la página y es estable mientras el formulario siga en pantalla: un doble clic o un reintento tras
 * un corte no duplica el pago. Tras un registro exitoso la página se refresca con una clave nueva.
 */
export function PaymentForm({ code, idempotencyKey, balance }: { code: string; idempotencyKey: string; balance: Money }) {
  const { register, handleSubmit, setError, reset, formState, getValues } = useForm<Input, unknown, z.output<typeof paymentSchema>>({
    resolver: zodResolver(paymentSchema),
    defaultValues: { amount: balance.amount > 0 ? centsToInput(balance.amount) : "", method: "bank_transfer", reference: "", receivedAt: "", note: "" },
  });
  const { submit, pending, error, success } = useActionSubmit((v: Input) => recordPaymentAction(code, idempotencyKey, v), {
    setError,
    onSuccess: () => reset({ amount: "", method: "bank_transfer", reference: "", receivedAt: "", note: "" }),
  });
  const e = formState.errors;

  return (
    // Se envían los valores crudos: la Server Action vuelve a validar con el mismo esquema.
    <form
      noValidate
      className="space-y-3"
      onSubmit={handleSubmit(() => submit(getValues()))}
    >
      {error ? <ErrorSummary error={error} /> : null}
      {success ? (
        <Alert tone="success" role="status">
          {success.replayed ? "Este pago ya estaba registrado (no se duplicó)." : "Pago registrado."} Estado de la reserva actualizado.
        </Alert>
      ) : null}
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label={`Monto (${balance.currency})`} name="amount" hint={`Saldo pendiente: ${formatMoney(balance)}`} error={e.amount?.message} required>
          <input inputMode="decimal" className="field-input tabular-nums" autoComplete="off" {...register("amount")} />
        </Field>
        <Field label="Medio" name="method" error={e.method?.message} required>
          <select className="field-input" {...register("method")}>
            <option value="bank_transfer">Transferencia bancaria</option>
            <option value="cash">Efectivo</option>
          </select>
        </Field>
        <Field label="N.º de operación o recibo" name="reference" hint="Único por medio de pago." error={e.reference?.message} required>
          <input className="field-input font-mono" autoComplete="off" maxLength={80} {...register("reference")} />
        </Field>
        <Field label="Recibido el (hora de Lima)" name="receivedAt" hint="Vacío = ahora." error={e.receivedAt?.message}>
          <input type="datetime-local" className="field-input" {...register("receivedAt")} />
        </Field>
      </div>
      <Field label="Nota interna" name="note" error={e.note?.message}>
        <input className="field-input" maxLength={500} {...register("note")} />
      </Field>
      <button type="submit" disabled={pending} aria-busy={pending || undefined} className={buttonClass("primary")}>
        {pending ? "Registrando…" : "Registrar pago"}
      </button>
    </form>
  );
}
