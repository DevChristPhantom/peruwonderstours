import { ActionForm, SubmitButton } from "@/components/forms/ActionForm";
import { buttonClass } from "@/components/ui/styles";
import { voidPaymentAction } from "@/app/(panel)/pagos-manuales/actions";
import { formatMoney } from "@/lib/format";
import type { Money } from "@/lib/api/types";

/**
 * "Anular" de un pago manual (solo admin). Se despliega en la fila: pide el motivo (obligatorio,
 * queda en el pago) y una confirmación nativa antes de enviar, porque no se puede deshacer.
 */
export function VoidPaymentForm({ code, paymentId, amount }: { code: string; paymentId: string; amount: Money }) {
  const id = `anular-${paymentId}`;
  return (
    <details className="group">
      <summary className={buttonClass("danger", "sm", "list-none")}>Anular</summary>
      <div className="mt-2 w-72 max-w-full rounded-sm border border-danger bg-surface p-3">
        <ActionForm
          action={voidPaymentAction.bind(null, code, paymentId)}
          confirm={`¿Anular el pago de ${formatMoney(amount)} de la reserva ${code}? Se registrará un contra-asiento y el saldo de la reserva aumentará. No se puede deshacer.`}
        >
          <div className="space-y-1">
            <label htmlFor={id} className="block text-sm font-medium">
              Motivo de la anulación <span className="text-danger" aria-hidden>*</span>
            </label>
            <textarea id={id} name="reason" required minLength={5} maxLength={500} rows={3} className="field-input" aria-describedby={`${id}-ayuda`} />
            <p id={`${id}-ayuda`} className="text-xs text-foreground-muted">
              Ej.: «monto digitado dos veces». Queda registrado en el pago.
            </p>
          </div>
          <SubmitButton variant="danger" size="sm" pendingLabel="Anulando…">
            Confirmar anulación
          </SubmitButton>
        </ActionForm>
      </div>
    </details>
  );
}
