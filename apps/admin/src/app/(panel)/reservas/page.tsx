import type { Metadata } from "next";
import Link from "next/link";

import { Alert } from "@/components/ui/Alert";
import { Badge } from "@/components/ui/Badge";
import { ErrorPanel } from "@/components/ui/ErrorPanel";
import { EmptyState, PageHeader, TableWrap } from "@/components/ui/Layout";
import { Pagination } from "@/components/ui/Pagination";
import { buttonClass } from "@/components/ui/styles";
import { api, type Paged } from "@/lib/api/client";
import type { BookingListItem } from "@/lib/api/types";
import { load, requireSession } from "@/lib/auth/guard";
import { readEmailFilter } from "@/lib/bookings-filter";
import { formatDate, formatDateTime, formatMoney } from "@/lib/format";
import { BOOKING_STATUS } from "@/lib/labels";

import { searchByEmailAction } from "./actions";

export const metadata: Metadata = { title: "Reservas" };

const one = (v: string | string[] | undefined) => (typeof v === "string" ? v : undefined);
const DATE = /^\d{4}-\d{2}-\d{2}$/;

export default async function BookingsPage({ searchParams }: PageProps<"/reservas">) {
  await requireSession();
  const sp = await searchParams;
  const status = one(sp.status) && BOOKING_STATUS[one(sp.status)!] ? one(sp.status) : undefined;
  const code = one(sp.code)?.trim().toUpperCase().slice(0, 20) || undefined;
  const from = one(sp.travelDateFrom) && DATE.test(one(sp.travelDateFrom)!) ? one(sp.travelDateFrom) : undefined;
  const to = one(sp.travelDateTo) && DATE.test(one(sp.travelDateTo)!) ? one(sp.travelDateTo) : undefined;
  const page = Math.max(1, Number(one(sp.page)) || 1);
  const byEmail = one(sp.por) === "correo";
  const email = byEmail ? await readEmailFilter() : null;
  const validCode = code && /^[A-Z0-9-]{3,20}$/.test(code) ? code : undefined;

  const filters = { page, pageSize: 25, status, code: validCode, travelDateFrom: from, travelDateTo: to };
  // H-15: el correo (dato personal) nunca va en la URL, tampoco hacia la API: POST /search.
  const result = await load(() =>
    email
      ? api<Paged<BookingListItem>>("/admin/bookings/search", { method: "POST", body: { ...filters, email } })
      : api<Paged<BookingListItem>>("/admin/bookings", { query: filters }),
  );
  const params = { status, code: validCode, travelDateFrom: from, travelDateTo: to, por: byEmail ? "correo" : undefined };

  return (
    <>
      <PageHeader title="Reservas" description="Filtra por estado, código o fecha del primer servicio. Abre una reserva para registrar pagos, cancelar o reenviar el voucher." />

      <div className="mb-4 grid gap-3 lg:grid-cols-[1fr_auto]">
        <form method="get" className="grid grid-cols-2 items-end gap-2 rounded-md border border-border bg-surface p-3 md:grid-cols-5" aria-label="Filtros de reservas">
          <label className="text-xs font-medium">
            Estado
            <select name="status" defaultValue={status ?? ""} className="field-input mt-1">
              <option value="">Todos</option>
              {Object.entries(BOOKING_STATUS).map(([k, v]) => (
                <option key={k} value={k}>
                  {v.label}
                </option>
              ))}
            </select>
          </label>
          <label className="text-xs font-medium">
            Código (prefijo)
            <input name="code" defaultValue={validCode ?? ""} placeholder="PWT-2026-" className="field-input mt-1 font-mono" maxLength={20} />
          </label>
          <label className="text-xs font-medium">
            Viaje desde
            <input type="date" name="travelDateFrom" defaultValue={from ?? ""} className="field-input mt-1" />
          </label>
          <label className="text-xs font-medium">
            Viaje hasta
            <input type="date" name="travelDateTo" defaultValue={to ?? ""} className="field-input mt-1" />
          </label>
          <div className="col-span-2 flex gap-2 md:col-span-1">
            <button type="submit" className={buttonClass("secondary", "md", "flex-1")}>
              Filtrar
            </button>
            <Link href="/reservas" className={buttonClass("ghost")}>
              Limpiar
            </Link>
          </div>
        </form>

        <form action={searchByEmailAction} className="flex items-end gap-2 rounded-md border border-border bg-surface p-3" aria-label="Buscar por correo">
          <label className="flex-1 text-xs font-medium">
            Correo exacto del cliente
            <input type="email" name="email" required className="field-input mt-1" maxLength={254} autoComplete="off" />
          </label>
          <button type="submit" className={buttonClass("outline")}>
            Buscar
          </button>
        </form>
      </div>

      {one(sp.correo) === "invalido" ? <Alert tone="warning">El correo no es válido.</Alert> : null}
      {byEmail ? (
        <div className="mb-3">
          {email ? (
            <Alert tone="info">
              Mostrando reservas de <strong>{email}</strong>. <Link href="/reservas">Quitar filtro</Link>
            </Alert>
          ) : (
            <Alert tone="warning">La búsqueda por correo expiró (15 min). Vuelve a buscar.</Alert>
          )}
        </div>
      ) : null}

      {!result.ok ? (
        <ErrorPanel error={result.error} />
      ) : result.data.data.length === 0 ? (
        <EmptyState>No hay reservas con esos filtros.</EmptyState>
      ) : (
        <>
          <TableWrap label="Listado de reservas">
            <table className="data-table">
              <thead>
                <tr>
                  <th scope="col">Código</th>
                  <th scope="col">Estado</th>
                  <th scope="col">Cliente</th>
                  <th scope="col">Tours</th>
                  <th scope="col">Viaje</th>
                  <th scope="col" className="num">
                    Total
                  </th>
                  <th scope="col" className="num">
                    Saldo
                  </th>
                  <th scope="col">Creada</th>
                </tr>
              </thead>
              <tbody>
                {result.data.data.map((b) => (
                  <tr key={b.id}>
                    <td>
                      <Link href={`/reservas/${b.code}`} className="font-mono font-medium">
                        {b.code}
                      </Link>
                    </td>
                    <td>
                      <Badge tone={BOOKING_STATUS[b.status]?.tone ?? "neutral"}>{BOOKING_STATUS[b.status]?.label ?? b.status}</Badge>
                    </td>
                    <td>
                      <span className="block">{b.customer.fullName}</span>
                      <span className="block text-xs text-foreground-muted">{b.customer.email}</span>
                    </td>
                    <td className="max-w-72">
                      {b.tours.map((t, i) => (
                        <span key={i} className="block truncate" title={t.title}>
                          {t.title} <span className="text-xs text-foreground-muted">· {t.paxCount} pax</span>
                        </span>
                      ))}
                    </td>
                    <td className="whitespace-nowrap">{formatDate(b.firstServiceDate)}</td>
                    <td className="num">{formatMoney(b.total)}</td>
                    <td className="num">
                      {b.balance.amount > 0 ? <span className="font-medium text-warning">{formatMoney(b.balance)}</span> : formatMoney(b.balance)}
                      {b.balanceDueAt && b.balance.amount > 0 ? <span className="block text-xs text-foreground-muted">vence {formatDate(b.balanceDueAt)}</span> : null}
                    </td>
                    <td className="whitespace-nowrap text-xs">{formatDateTime(b.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableWrap>
          <Pagination basePath="/reservas" params={params} meta={result.data.meta} />
        </>
      )}
    </>
  );
}
