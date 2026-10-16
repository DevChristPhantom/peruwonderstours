import type { Metadata } from "next";

import { AuditFilters } from "@/components/audit/AuditFilters";
import { ErrorPanel } from "@/components/ui/ErrorPanel";
import { EmptyState, PageHeader, TableWrap } from "@/components/ui/Layout";
import { Pagination } from "@/components/ui/Pagination";
import { api, apiData, type Paged } from "@/lib/api/client";
import type { AuditEntry } from "@/lib/api/content-types";
import type { StaffUserSummary } from "@/lib/api/types";
import { can, load, requireSession } from "@/lib/auth/guard";
import { isCalendarDate, limaDayBoundary } from "@/lib/calendar-date";
import { formatDateTime } from "@/lib/format";

export const metadata: Metadata = { title: "Auditoría" };

const UUID = /^[0-9a-f-]{36}$/i;
const ACTOR_TYPE: Record<string, string> = { system: "Sistema", customer: "Cliente", webhook: "Pasarela (webhook)" };
const str = (v: string | string[] | undefined) => (typeof v === "string" ? v.trim() : "");

/** Bitácora de solo lectura (`audit_log`, append-only). Los motivos de texto libre no se guardan aquí. */
export default async function AuditPage({ searchParams }: PageProps<"/auditoria">) {
  const session = await requireSession();
  const sp = await searchParams;
  const entityType = /^[a-z_]{2,60}$/.test(str(sp.entityType)) ? str(sp.entityType) : undefined;
  const entityId = UUID.test(str(sp.entityId)) ? str(sp.entityId) : undefined;
  const actorId = UUID.test(str(sp.actorId)) ? str(sp.actorId) : undefined;
  const action = /^[A-Za-z_]{2,40}$/.test(str(sp.action)) ? str(sp.action).toUpperCase() : undefined;
  const from = isCalendarDate(str(sp.from)) ? str(sp.from) : undefined;
  const to = isCalendarDate(str(sp.to)) ? str(sp.to) : undefined;
  const page = Math.max(1, Number(sp.page) || 1);

  const [result, usersResult] = await Promise.all([
    load(() =>
      api<Paged<AuditEntry>>("/admin/audit", {
        query: {
          page,
          pageSize: 50,
          entityType,
          entityId,
          actorId,
          action,
          // Días de Lima (UTC-5, sin horario de verano) → instantes ISO.
          from: from ? limaDayBoundary(from) : undefined,
          to: to ? limaDayBoundary(to, true) : undefined,
        },
      }),
    ),
    can(session, "users:manage") ? load(() => apiData<StaffUserSummary[]>("/admin/users")) : Promise.resolve(null),
  ]);
  const users = usersResult && usersResult.ok ? usersResult.data.map((u) => ({ id: u.id, fullName: u.fullName })) : null;
  const userName = (id: string | null) => (id ? (users?.find((u) => u.id === id)?.fullName ?? `${id.slice(0, 8)}…`) : "—");
  const filters = { entityType, entityId, actorId, action, from, to };

  return (
    <>
      <PageHeader title="Auditoría" description="Registro inalterable de quién hizo qué y cuándo. Solo lectura." />
      <AuditFilters values={filters} users={users} />
      {!result.ok ? (
        <ErrorPanel error={result.error} />
      ) : result.data.data.length === 0 ? (
        <EmptyState>No hay registros con esos filtros.</EmptyState>
      ) : (
        <>
          <TableWrap label="Registros de auditoría">
            <table className="data-table">
              <thead>
                <tr>
                  <th scope="col">Fecha</th>
                  <th scope="col">Usuario</th>
                  <th scope="col">Acción</th>
                  <th scope="col">Entidad</th>
                  <th scope="col">Detalle</th>
                </tr>
              </thead>
              <tbody>
                {result.data.data.map((e) => (
                  <tr key={e.id}>
                    <td className="whitespace-nowrap">{formatDateTime(e.occurredAt)}</td>
                    <td>
                      {e.actorType === "user" ? userName(e.actorId) : (ACTOR_TYPE[e.actorType] ?? e.actorType)}
                      {e.ip ? <span className="block text-xs text-foreground-muted">{e.ip}</span> : null}
                    </td>
                    <td className="font-mono text-xs">{e.action}</td>
                    <td>
                      <span className="font-mono text-xs">{e.entityType}</span>
                      {e.entityId ? <span className="block font-mono text-xs text-foreground-muted">{e.entityId}</span> : null}
                    </td>
                    <td className="max-w-md">
                      {e.changedFields?.length ? <span className="block text-xs">Campos: {e.changedFields.join(", ")}</span> : null}
                      {e.before != null || e.after != null ? (
                        <details>
                          <summary className="cursor-pointer text-xs text-link">Ver antes / después</summary>
                          <pre className="mt-1 max-h-64 overflow-auto rounded-xs bg-surface-muted p-2 text-xs whitespace-pre-wrap break-all">
                            {JSON.stringify({ antes: e.before ?? null, despues: e.after ?? null }, null, 2)}
                          </pre>
                        </details>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableWrap>
          <Pagination basePath="/auditoria" params={{ ...filters }} meta={result.data.meta} />
        </>
      )}
    </>
  );
}
