import type { Metadata } from "next";
import { randomUUID } from "node:crypto";
import { notFound } from "next/navigation";

import { resendVoucherAction } from "@/app/(panel)/reservas/actions";
import { CancelForm } from "@/components/bookings/CancelForm";
import { PaymentForm } from "@/components/bookings/PaymentForm";
import { RefundForm } from "@/components/bookings/RefundForm";
import { ActionForm, SubmitButton } from "@/components/forms/ActionForm";
import { Badge } from "@/components/ui/Badge";
import { ErrorPanel } from "@/components/ui/ErrorPanel";
import { EmailsTable } from "@/components/ui/EmailsTable";
import { EmptyState, KeyValues, PageHeader, Section, TableWrap } from "@/components/ui/Layout";
import { apiData } from "@/lib/api/client";
import type { BookingDetail } from "@/lib/api/types";
import { can, load, requireSession } from "@/lib/auth/guard";
import { formatDate, formatDateTime, formatMoney } from "@/lib/format";
import { BOOKING_STATUS, label, PAX_TYPE, PAYMENT_KIND, PAYMENT_METHOD, PAYMENT_STATUS, RESIDENCY } from "@/lib/labels";

export async function generateMetadata({ params }: PageProps<"/reservas/[code]">): Promise<Metadata> {
  return { title: `Reserva ${(await params).code}` };
}

const PAYABLE = ["held", "confirmed", "partially_paid", "pending"];
const VOUCHER = ["confirmed", "partially_paid", "paid", "completed"];

export default async function BookingDetailPage({ params }: PageProps<"/reservas/[code]">) {
  const session = await requireSession();
  const code = (await params).code.toUpperCase();
  if (!/^PWT-\d{4}-\d{6}$/.test(code)) notFound();
  const result = await load(() => apiData<BookingDetail>(`/admin/bookings/${code}`));
  if (!result.ok) {
    return (
      <>
        <PageHeader title={`Reserva ${code}`} back={{ href: "/reservas", label: "Reservas" }} />
        <ErrorPanel error={result.error} />
      </>
    );
  }
  const b = result.data;
  const status = BOOKING_STATUS[b.status] ?? { label: b.status, tone: "neutral" as const };
  const succeeded = b.payments.filter((p) => p.kind !== "refund" && p.status === "succeeded");
  const canPay = can(session, "payments:record") && PAYABLE.includes(b.status) && b.balance.amount > 0;
  const canRefund = can(session, "payments:refund") && succeeded.length > 0;
  const canCancel = can(session, "bookings:cancel") && b.cancellationQuote !== null;
  const canVoucher = can(session, "bookings:resend-voucher") && VOUCHER.includes(b.status);
  const pendingRefund = b.refundDue ? { amount: Math.max(0, b.refundDue.amount - b.refunded.amount), currency: b.refundDue.currency } : null;

  return (
    <>
      <PageHeader
        title={<span className="font-mono">{b.code}</span>}
        back={{ href: "/reservas", label: "Reservas" }}
        description={`${b.customer.fullName} · ${b.customer.email}`}
        meta={
          <>
            <Badge tone={status.tone}>{status.label}</Badge>
            <span className="text-xs text-foreground-muted">
              Creada {formatDateTime(b.createdAt)} · origen {b.source} · idioma {b.locale}
            </span>
          </>
        }
        actions={
          canVoucher ? (
            <ActionForm action={resendVoucherAction.bind(null, b.code)} refresh>
              <SubmitButton variant="outline" pendingLabel="Encolando…">
                Reenviar voucher
              </SubmitButton>
            </ActionForm>
          ) : null
        }
      />

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_380px]">
        <div className="min-w-0 space-y-4">
          <Section title="Resumen" id="resumen">
            <KeyValues
              columns={3}
              items={[
                ["Total", <strong key="t">{formatMoney(b.total)}</strong>],
                ["Pagado", formatMoney(b.paid)],
                ["Saldo", b.balance.amount > 0 ? <strong key="s" className="text-warning">{formatMoney(b.balance)}</strong> : formatMoney(b.balance)],
                ["Opción de pago", b.paymentOption === "deposit" ? `Adelanto ${b.depositPercent ?? ""} % (${formatMoney(b.deposit)})` : "Pago total"],
                ["Vence el saldo", formatDateTime(b.balanceDueAt)],
                ["Reembolsado", formatMoney(b.refunded)],
                ["Primer servicio", formatDate(b.firstServiceDate)],
                ["Último servicio", formatDate(b.lastServiceDate)],
                ["Retención de cupo hasta", formatDateTime(b.holdExpiresAt)],
                ...(b.cancelledAt
                  ? ([
                      ["Cancelada", formatDateTime(b.cancelledAt)],
                      ["Motivo", b.cancellationReason],
                      ["Reembolso adeudado", formatMoney(b.refundDue)],
                    ] as [string, React.ReactNode][])
                  : []),
              ]}
            />
            {b.customerNotes ? <p className="mt-3 text-sm"><span className="text-xs text-foreground-muted">Notas del cliente: </span>{b.customerNotes}</p> : null}
          </Section>

          <Section title="Ítems" id="items">
            <TableWrap label="Ítems de la reserva">
              <table className="data-table">
                <thead>
                  <tr>
                    <th scope="col">Tour</th>
                    <th scope="col">Fecha</th>
                    <th scope="col">Pasajeros</th>
                    <th scope="col" className="num">
                      Subtotal
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {b.items.map((i) => (
                    <tr key={i.id}>
                      <td>
                        {i.tourTitle}
                        {i.status !== "active" ? <span className="ml-2"><Badge tone="neutral">{i.status === "cancelled" ? "Cancelado" : i.status}</Badge></span> : null}
                      </td>
                      <td className="whitespace-nowrap">{formatDate(i.travelDate)}</td>
                      <td>
                        {i.lines.map((l, k) => (
                          <span key={k} className="block text-xs">
                            {l.quantity} × {label(PAX_TYPE, l.paxType)} {label(RESIDENCY, l.residency).toLowerCase()} ({formatMoney({ amount: l.unitAmount, currency: i.subtotal.currency })})
                          </span>
                        ))}
                      </td>
                      <td className="num">{formatMoney(i.subtotal)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </TableWrap>
          </Section>

          <Section title="Viajeros" id="viajeros">
            {b.travelers.length === 0 ? (
              <EmptyState>Sin viajeros registrados.</EmptyState>
            ) : (
              <TableWrap label="Viajeros">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th scope="col">Nombre</th>
                      <th scope="col">Tipo</th>
                      <th scope="col">Residencia</th>
                      <th scope="col">Nacionalidad</th>
                      <th scope="col">Documento</th>
                    </tr>
                  </thead>
                  <tbody>
                    {b.travelers.map((t) => (
                      <tr key={t.id}>
                        <td>
                          {t.firstName} {t.lastName} {t.isLead ? <Badge tone="info">Titular</Badge> : null}
                        </td>
                        <td>{label(PAX_TYPE, t.paxType)}</td>
                        <td>{label(RESIDENCY, t.residency)}</td>
                        <td>{t.nationality ?? "—"}</td>
                        <td>{t.documentType ?? "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </TableWrap>
            )}
          </Section>

          <Section title="Pagos y reembolsos" id="pagos">
            {b.payments.length === 0 ? (
              <EmptyState>Sin pagos.</EmptyState>
            ) : (
              <TableWrap label="Pagos">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th scope="col">Fecha</th>
                      <th scope="col">Tipo</th>
                      <th scope="col">Medio</th>
                      <th scope="col">Estado</th>
                      <th scope="col">Referencia</th>
                      <th scope="col">Registró</th>
                      <th scope="col" className="num">
                        Monto
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {b.payments.map((p) => (
                      <tr key={p.id}>
                        <td className="whitespace-nowrap">{formatDateTime(p.succeededAt ?? p.createdAt)}</td>
                        <td>{label(PAYMENT_KIND, p.kind)}</td>
                        <td>
                          {p.provider === "manual" ? "Manual · " : `${p.provider} · `}
                          {label(PAYMENT_METHOD, p.method)}
                        </td>
                        <td>
                          <Badge tone={p.status === "succeeded" ? "success" : p.status === "failed" ? "danger" : "neutral"}>{label(PAYMENT_STATUS, p.status)}</Badge>
                        </td>
                        <td className="font-mono text-xs">{p.providerPaymentId ?? "—"}</td>
                        <td>{p.recordedBy?.fullName ?? "—"}</td>
                        <td className="num">{p.kind === "refund" ? `− ${formatMoney(p.amount)}` : formatMoney(p.amount)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </TableWrap>
            )}
          </Section>

          <Section title="Historial de estados" id="historial">
            <ol className="space-y-1.5 text-sm">
              {b.statusHistory.map((h, i) => (
                <li key={i} className="flex flex-wrap gap-x-2">
                  <span className="text-xs whitespace-nowrap text-foreground-muted">{formatDateTime(h.at)}</span>
                  <span>
                    {h.from ? `${BOOKING_STATUS[h.from]?.label ?? h.from} → ` : ""}
                    <strong>{BOOKING_STATUS[h.to]?.label ?? h.to}</strong>
                  </span>
                  <span className="text-xs text-foreground-muted">
                    ({h.actorType}
                    {h.reason ? ` · ${h.reason}` : ""})
                  </span>
                </li>
              ))}
            </ol>
            {b.legalAcceptances.length > 0 ? (
              <p className="mt-3 text-xs text-foreground-muted">
                Aceptaciones legales: {b.legalAcceptances.map((a) => `${a.document} v${a.documentVersion} (${formatDateTime(a.createdAt)})`).join(" · ")}
              </p>
            ) : null}
          </Section>

          <Section title="Correos" id="correos">
            <EmailsTable emails={b.emails} />
          </Section>
        </div>

        <aside className="min-w-0 space-y-4" aria-label="Acciones de la reserva">
          {canPay ? (
            <Section title="Registrar pago" id="registrar-pago" description="Efectivo o transferencia recibidos fuera de la pasarela.">
              <PaymentForm code={b.code} idempotencyKey={randomUUID()} balance={b.balance} />
            </Section>
          ) : null}
          {canCancel && b.cancellationQuote ? (
            <Section title="Cancelar reserva" id="cancelar">
              <CancelForm code={b.code} quote={b.cancellationQuote} />
            </Section>
          ) : null}
          {canRefund ? (
            <Section title="Registrar reembolso" id="reembolso" description="Devolución hecha por transferencia o en efectivo.">
              <RefundForm
                code={b.code}
                idempotencyKey={randomUUID()}
                suggested={pendingRefund}
                payments={succeeded.map((p) => ({ id: p.id, label: `${label(PAYMENT_KIND, p.kind)} ${formatMoney(p.amount)} · ${formatDate(p.succeededAt ?? p.createdAt)}` }))}
              />
            </Section>
          ) : null}
          {!canPay && !canCancel && !canRefund ? <p className="text-sm text-foreground-muted">No hay acciones disponibles para esta reserva con tu rol.</p> : null}
        </aside>
      </div>
    </>
  );
}
