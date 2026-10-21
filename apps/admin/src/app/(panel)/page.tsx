import type { Metadata } from "next";
import Link from "next/link";

import { ActionForm, SubmitButton } from "@/components/forms/ActionForm";
import { Badge } from "@/components/ui/Badge";
import { ErrorPanel } from "@/components/ui/ErrorPanel";
import { EmptyState, PageHeader, Section, TableWrap } from "@/components/ui/Layout";
import { apiData } from "@/lib/api/client";
import type { Dashboard, MoneyTotal } from "@/lib/api/types";
import { can, load, requireSession } from "@/lib/auth/guard";
import { formatDate, formatDateTime, formatMoney, formatWeekday } from "@/lib/format";
import { BOOKING_STATUS, TRAFFIC_LIGHT } from "@/lib/labels";

import { reconcilePaymentsAction } from "./actions";

export const metadata: Metadata = { title: "Tablero" };

function Totals({ values, empty = "S/ 0.00" }: { values: MoneyTotal[]; empty?: string }) {
  if (values.length === 0) return <span>{empty}</span>;
  return (
    <span className="flex flex-col">
      {values.map((v) => (
        <span key={v.currency}>
          {formatMoney(v)}
          <span className="ml-1 text-xs font-normal text-foreground-muted">({v.count})</span>
        </span>
      ))}
    </span>
  );
}

function Kpi({ label, children, hint }: { label: string; children: React.ReactNode; hint?: string }) {
  return (
    <div className="rounded-md border border-border bg-surface p-3">
      <p className="text-xs text-foreground-muted">{label}</p>
      <div className="mt-1 text-lg font-semibold tabular-nums">{children}</div>
      {hint ? <p className="mt-0.5 text-xs text-foreground-muted">{hint}</p> : null}
    </div>
  );
}

export default async function DashboardPage() {
  const session = await requireSession();
  if (!can(session, "dashboard:read")) {
    return (
      <>
        <PageHeader title={`Hola, ${session.user.fullName}`} />
        <p className="text-sm">No tienes acceso al tablero. Usa el menú para ir a tus secciones.</p>
      </>
    );
  }
  const result = await load(() => apiData<Dashboard>("/admin/dashboard"));
  if (!result.ok) {
    return (
      <>
        <PageHeader title="Tablero" />
        <ErrorPanel error={result.error} />
      </>
    );
  }
  const d = result.data;
  const lights = d.complaints.byTrafficLight;
  const outboxTone = d.emailOutbox.failed > 0 ? "danger" : d.emailOutbox.retrying > 0 ? "warning" : "success";
  // Con decenas de tours hay cientos de salidas en 14 días: el tablero muestra las que ya tienen
  // movimiento (ventas, cupos retenidos o ventas cerradas); el detalle completo está en Salidas.
  const busyDepartures = d.upcomingDepartures.filter((dep) => dep.booked + dep.held > 0 || dep.isClosed);
  const shownDepartures = (busyDepartures.length ? busyDepartures : d.upcomingDepartures).slice(0, 12);

  return (
    <>
      <PageHeader
        title="Tablero"
        description={`Actualizado ${formatDateTime(d.generatedAt)} (hora de Lima). Montos por moneda, sin conversión.`}
        actions={
          can(session, "payments:refund") ? (
            <ActionForm action={reconcilePaymentsAction} confirm="¿Conciliar ahora los cobros en línea pendientes con la pasarela?">
              <SubmitButton variant="outline" pendingLabel="Conciliando…">
                Conciliar pagos en línea
              </SubmitButton>
            </ActionForm>
          ) : null
        }
      />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Kpi label="Ventas de hoy" hint="Cobros exitosos (n.º de pagos)">
          <Totals values={d.sales.today} />
        </Kpi>
        <Kpi label="Ventas del mes" hint="Adelantos, totales y saldos">
          <Totals values={d.sales.month} />
        </Kpi>
        <Kpi label="Reembolsos del mes">
          <Totals values={d.sales.refundsMonth} />
        </Kpi>
        <Kpi label="Saldos vencidos" hint="Reservas con adelanto y saldo impago">
          <Totals values={d.balances.overdue} />
        </Kpi>
      </div>

      <div className="mt-4 grid items-start gap-4 lg:grid-cols-2 min-[1280px]:grid-cols-3">
        <Section title="Reservas por estado" id="estados">
          <ul className="divide-y divide-border text-sm">
            {Object.entries(BOOKING_STATUS).map(([status, meta]) => (
              <li key={status} className="flex items-center justify-between py-1.5">
                <Link href={`/reservas?status=${status}`} className="no-underline hover:underline">
                  <Badge tone={meta.tone}>{meta.label}</Badge>
                </Link>
                <span className="font-semibold tabular-nums">{d.bookingsByStatus[status] ?? 0}</span>
              </li>
            ))}
          </ul>
        </Section>

        <Section
          title="Libro de Reclamaciones"
          id="reclamos"
          description={`${d.complaints.open} abiertos · ${d.complaints.dueSoon} por vencer (amarillo + rojo)`}
          actions={
            <Link href="/reclamos" className="text-sm">
              Ver bandeja
            </Link>
          }
        >
          <ul className="grid grid-cols-2 gap-2 text-sm">
            {(["overdue", "red", "yellow", "green", "suspended"] as const).map((key) => (
              <li key={key}>
                <Link href={`/reclamos?trafficLight=${key}`} className="flex min-h-11 items-center justify-between gap-2 rounded-sm border border-border px-3 no-underline hover:bg-surface-muted" title={TRAFFIC_LIGHT[key].hint}>
                  <Badge tone={TRAFFIC_LIGHT[key].tone}>{TRAFFIC_LIGHT[key].label}</Badge>
                  <span className="font-semibold text-foreground tabular-nums">{lights[key]}</span>
                </Link>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-xs text-foreground-muted">
            ARCO: {d.privacyRequests.open} abiertas
            {d.privacyRequests.overdue ? <strong className="text-danger"> · {d.privacyRequests.overdue} vencidas</strong> : null}
          </p>
        </Section>

        <Section title="Correo transaccional" id="correo" description="Outbox de la API (confirmaciones, vouchers, reclamos)">
          <ul className="space-y-2 text-sm">
            <li className="flex justify-between">
              <span>En cola</span>
              <span className="font-semibold tabular-nums">{d.emailOutbox.pending}</span>
            </li>
            <li className="flex justify-between">
              <span>Reintentando</span>
              <span className="font-semibold tabular-nums">{d.emailOutbox.retrying}</span>
            </li>
            <li className="flex justify-between">
              <span>Fallidos (sin más reintentos)</span>
              <span className="font-semibold tabular-nums">{d.emailOutbox.failed}</span>
            </li>
          </ul>
          <p className="mt-3">
            <Badge tone={outboxTone}>{outboxTone === "success" ? "Funcionando" : outboxTone === "warning" ? "Con reintentos" : "Hay correos fallidos"}</Badge>
          </p>
        </Section>
      </div>

      <div className="mt-4 grid items-start gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
        <Section title="Saldos por vencer (7 días)" id="saldos" description={d.balances.dueNext7Days.totals.map((t) => formatMoney(t)).join(" · ") || "Sin saldos por vencer"}>
          {d.balances.dueNext7Days.bookings.length === 0 ? (
            <EmptyState>No hay saldos por vencer en los próximos 7 días.</EmptyState>
          ) : (
            <TableWrap label="Saldos por vencer">
              <table className="data-table">
                <thead>
                  <tr>
                    <th scope="col">Reserva</th>
                    <th scope="col">Vence</th>
                    <th scope="col" className="num">
                      Saldo
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {d.balances.dueNext7Days.bookings.map((b) => (
                    <tr key={b.code}>
                      <td>
                        <Link href={`/reservas/${b.code}`} className="font-mono">
                          {b.code}
                        </Link>
                      </td>
                      <td>{formatDateTime(b.balanceDueAt)}</td>
                      <td className="num">{formatMoney(b.balance)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </TableWrap>
          )}
        </Section>

        <Section
          title="Ocupación de salidas (14 días)"
          id="ocupacion"
          description={
            d.upcomingDepartures.length === 0
              ? undefined
              : busyDepartures.length
                ? `${d.upcomingDepartures.length} salidas programadas · se muestran las que tienen ventas o cupos retenidos`
                : `${d.upcomingDepartures.length} salidas programadas, todavía sin ventas`
          }
          actions={
            d.upcomingDepartures.length > shownDepartures.length ? (
              <Link href="/salidas" className="text-sm">
                Ver todas
              </Link>
            ) : null
          }
        >
          {d.upcomingDepartures.length === 0 ? (
            <EmptyState>No hay salidas programadas en los próximos 14 días.</EmptyState>
          ) : (
            <TableWrap label="Ocupación de salidas próximas">
              <table className="data-table">
                <thead>
                  <tr>
                    <th scope="col">Fecha</th>
                    <th scope="col">Tour</th>
                    <th scope="col" className="num">
                      Vendidos / cupo
                    </th>
                    <th scope="col">Ocupación</th>
                  </tr>
                </thead>
                <tbody>
                  {shownDepartures.map((dep) => (
                    <tr key={dep.departureId}>
                      <td className="whitespace-nowrap">
                        {formatWeekday(dep.departureDate)} {formatDate(dep.departureDate)}
                        {dep.startTime !== "00:00" ? <span className="text-foreground-muted"> {dep.startTime}</span> : null}
                      </td>
                      <td>
                        <Link href={`/salidas?tourId=${dep.tourId}`}>{dep.tourTitle ?? dep.tourCode}</Link>
                        {dep.isClosed ? (
                          <span className="ml-2">
                            <Badge tone="neutral">Ventas cerradas</Badge>
                          </span>
                        ) : null}
                      </td>
                      <td className="num">
                        {dep.booked}
                        {dep.held ? <span className="text-foreground-muted"> +{dep.held}</span> : null} / {dep.capacity}
                      </td>
                      <td className="min-w-32">
                        <meter className="occupancy" min={0} max={100} low={60} high={90} optimum={50} value={dep.occupancyPercent} aria-label={`Ocupación ${dep.occupancyPercent} %`} />
                        <span className="text-xs tabular-nums">{dep.occupancyPercent} %</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </TableWrap>
          )}
        </Section>
      </div>
      <p className="mt-3 text-xs text-foreground-muted">{d.sales.note}</p>
    </>
  );
}
