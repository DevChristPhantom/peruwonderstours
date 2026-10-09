"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import type { z } from "zod";

import { recordRefundAction } from "@/app/(panel)/reservas/actions";
import { ErrorSummary } from "@/components/forms/ActionForm";
import { Field } from "@/components/forms/Field";
import { useActionSubmit } from "@/components/forms/useActionSubmit";
import { Alert } from "@/components/ui/Alert";
import { buttonClass } from "@/components/ui/styles";
import type { Money } from "@/lib/api/types";
import { centsToInput, formatMoney } from "@/lib/format";
import { refundSchema } from "@/lib/schemas/bookings";

type Input = z.input<typeof refundSchema>;

export interface RefundablePayment {
  id: string;
  label: string;
}

/** Reembolso manual contra un pago exitoso (idempotente, no supera lo cobrado en ese pago). */
export function RefundForm({
  code,
  idempotencyKey,
  payments,
  suggested,
}: {
  code: string;
  idempotencyKey: string;
  payments: RefundablePayment[];
  suggested: Money | null;
}) {
  const { register, handleSubmit, setError, formState, getValues } = useForm<Input, unknown, z.output<typeof refundSchema>>({
    resolver: zodResolver(refundSchema),
    defaultValues: {
      amount: suggested && suggested.amount > 0 ? centsToInput(suggested.amount) : "",
      method: "bank_transfer",
      reference: "",
      parentPaymentId: payments[0]?.id ?? "",
      note: "",
    },
  });
  const { submit, pending, error, success } = useActionSubmit((v: Input) => recordRefundAction(code, idempotencyKey, v), { setError });
  const e = formState.errors;

  return (
    <form
      noValidate
      className="space-y-3"
      onSubmit={handleSubmit(() => {
        if (!window.confirm("¿Registrar el reembolso? Queda en la auditoría y no se puede deshacer desde el panel.")) return;
        return submit(getValues());
      })}
    >
      {error ? <ErrorSummary error={error} /> : null}
      {success ? (
        <Alert tone="success" role="status">
          {success.replayed ? "Este reembolso ya estaba registrado (no se duplicó)." : "Reembolso registrado."}
        </Alert>
      ) : null}
      {suggested ? <p className="text-xs text-foreground-muted">Reembolso adeudado según la cancelación: {formatMoney(suggested)}</p> : null}
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Pago original" name="parentPaymentId" error={e.parentPaymentId?.message} required>
          <select className="field-input" {...register("parentPaymentId")}>
            {payments.map((p) => (
              <option key={p.id} value={p.id}>
                {p.label}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Monto a reembolsar" name="amount" error={e.amount?.message} required>
          <input inputMode="decimal" className="field-input tabular-nums" autoComplete="off" {...register("amount")} />
        </Field>
        <Field label="Medio" name="method" error={e.method?.message} required>
          <select className="field-input" {...register("method")}>
            <option value="bank_transfer">Transferencia bancaria</option>
            <option value="cash">Efectivo</option>
          </select>
        </Field>
        <Field label="N.º de operación" name="reference" error={e.reference?.message} required>
          <input className="field-input font-mono" autoComplete="off" maxLength={80} {...register("reference")} />
        </Field>
      </div>
      <Field label="Nota interna" name="note" error={e.note?.message}>
        <input className="field-input" maxLength={500} {...register("note")} />
      </Field>
      <button type="submit" disabled={pending} aria-busy={pending || undefined} className={buttonClass("danger")}>
        {pending ? "Registrando…" : "Registrar reembolso"}
      </button>
    </form>
  );
}
