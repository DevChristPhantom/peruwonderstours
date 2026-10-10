import type { Metadata } from "next";
import Link from "next/link";

import { VoidPaymentForm } from "@/components/payments/VoidPaymentForm";
import { Alert } from "@/components/ui/Alert";
import { Badge } from "@/components/ui/Badge";
import { ErrorPanel } from "@/components/ui/ErrorPanel";
import { EmptyState, PageHeader, Section, TableWrap } from "@/components/ui/Layout";
import { buttonClass } from "@/components/ui/styles";
import { apiData } from "@/lib/api/client";
import type { ManualPaymentsReport } from "@/lib/api/content-types";
import type { Money } from "@/lib/api/types";
import { can, load, requireSession } from "@/lib/auth/guard";
import { addDaysIso, formatDate, formatDateTime, formatMoney, todayInLima } from "@/lib/format";
import { label, PAYMENT_KIND, PAYMENT_METHOD } from "@/lib/labels";

export const metadata: Metadata = { title: "Pagos manuales del día" };

const list = (items: Money[]) => (items.length ? items.map(formatMoney).join(" · ") : "—");

/**
 * Pagos manuales del día (ADR-0003, sin doble control): control posterior por usuario. El admin
 * puede anular un registro equivocado con contra-asiento auditado.
 */
export default async function ManualPaymentsPage({ searchParams }: PageProps<"/pagos-manuales">) {
  const session = await requireSession();
  const sp = await searchParams;
  const raw = typeof sp.date === "string" ? sp.date : "";
  const today = todayInLima();
  const date = /^\d{4}-\d{2}-\d{2}$/.test(raw) && raw <= today ? raw : today;
  const canVoid = can(session, "payments:void");
  const result = await load(() => apiData<ManualPaymentsReport>("/admin/manual-payments", { query: { date } }));

  return (
    <>
      <PageHeader
        title="Pagos manuales"
        description="Efectivo, transferencias, Yape y Plin registrados por el equipo, por día de Lima. Revisa cada registro contra el comprobante o el extracto."
        actions={
          <form method="get" className="flex items-end gap-2" aria-label="Elegir día">
            <label className="text-xs font-medium">
              Día
              <input type="date" name="date" defaultValue={date} max={today} className="field-input mt-1" />
            </label>
            <button type="submit" className={buttonClass("secondary")}>
              Ver
            </button>
          </form>
        }
        meta={
          <>
            <Link href={`/pagos-manuales?date=${addDaysIso(date, -1)}`} className={buttonClass("outline", "sm")}>
              Día anterior
            </Link>
            {date < today ? (
              <Link href={`/pagos-manuales?date=${addDaysIso(date, 1)}`} className={buttonClass("outline", "sm")}>
                Día siguiente
              </Link>
            ) : null}
            <span className="text-sm font-medium">{formatDate(date)}</span>
          </>
        }
      />

      {!result.ok ? (
        <ErrorPanel error={result.error} />
      ) : (
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-3">
            <Alert tone="success" title="Recibido">
              {list(result.data.totals.received)}
            </Alert>
            <Alert tone="info" title="Reembolsado">
              {list(result.data.totals.refunded)}
            </Alert>
            <Alert tone="warning" title="Anulado (contra-asientos)">
              {list(result.data.totals.voided)}
            </Alert>
          </div>

          <Section title="Por usuario" description="Quién registró cada movimiento del día.">
            {result.data.byUser.length === 0 ? (
              <EmptyState>Nadie registró pagos manuales este día.</EmptyState>
            ) : (
              <TableWrap label="Pagos manuales por usuario">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th scope="col">Usuario</th>
                      <th scope="col" className="num">
                        Movimientos
                      </th>
                      <th scope="col">Recibido</th>
                      <th scope="col">Reembolsado</th>
                      <th scope="col">Anulado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.data.byUser.map((u) => (
                      <tr key={u.user?.id ?? "desconocido"}>
                        <td>{u.user?.fullName ?? "Sin usuario (sistema)"}</td>
                        <td className="num">{u.count}</td>
                        <td>{list(u.received)}</td>
                        <td>{list(u.refunded)}</td>
                        <td>{list(u.voided)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </TableWrap>
            )}
          </Section>

          <Section title="Detalle" description={canVoid ? "Anular solo corrige errores de registro: un cobro real que se devuelve es un reembolso." : undefined}>
            {result.data.items.length === 0 ? (
              <EmptyState>Sin movimientos.</EmptyState>
            ) : (
              <TableWrap label="Detalle de pagos manuales">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th scope="col">Hora</th>
                      <th scope="col">Reserva</th>
                      <th scope="col">Tipo</th>
                      <th scope="col">Medio</th>
                      <th scope="col" className="num">
                        Monto
                      </th>
                      <th scope="col">Referencia</th>
                      <th scope="col">Registró</th>
                      <th scope="col">Estado</th>
                      {canVoid ? <th scope="col">Acción</th> : null}
                    </tr>
                  </thead>
                  <tbody>
                    {result.data.items.map((p) => {
                      const voidable = canVoid && !p.isReversal && !p.voidedAt && p.kind !== "refund";
                      return (
                        <tr key={p.id}>
                          <td className="whitespace-nowrap">{formatDateTime(p.receivedAt)}</td>
                          <td>
                            <Link href={`/reservas/${p.bookingCode}`} className="font-mono font-medium">
                              {p.bookingCode}
                            </Link>
                          </td>
                          <td>{p.isReversal ? "Contra-asiento" : label(PAYMENT_KIND, p.kind)}</td>
                          <td>{p.method ? label(PAYMENT_METHOD, p.method) : "—"}</td>
                          <td className="num">{formatMoney(p.amount)}</td>
                          <td className="max-w-48 break-words text-xs">{p.reference ?? "—"}</td>
                          <td>{p.recordedBy?.fullName ?? "—"}</td>
                          <td>
                            {p.voidedAt ? (
                              <>
                                <Badge tone="danger">Anulado</Badge>
                                <span className="block text-xs text-foreground-muted">{formatDateTime(p.voidedAt)}</span>
                                {p.voidReason ? <span className="block max-w-56 text-xs">{p.voidReason}</span> : null}
                              </>
                            ) : p.isReversal ? (
                              <Badge tone="warning">Anulación</Badge>
                            ) : (
                              <Badge tone="success">Vigente</Badge>
                            )}
                          </td>
                          {canVoid ? <td>{voidable ? <VoidPaymentForm code={p.bookingCode} paymentId={p.id} amount={p.amount} /> : null}</td> : null}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </TableWrap>
            )}
          </Section>
        </div>
      )}
    </>
  );
}
