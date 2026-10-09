import type { Metadata } from "next";
import Link from "next/link";

import { ActionForm, SubmitButton } from "@/components/forms/ActionForm";
import { ConsentHistoryForm } from "@/components/privacy/ConsentHistoryForm";
import { Field } from "@/components/forms/Field";
import { Badge } from "@/components/ui/Badge";
import { ErrorPanel } from "@/components/ui/ErrorPanel";
import { EmptyState, PageHeader, Section, TableWrap } from "@/components/ui/Layout";
import { Pagination } from "@/components/ui/Pagination";
import { buttonClass } from "@/components/ui/styles";
import { api, type Paged } from "@/lib/api/client";
import type { PrivacyRequest } from "@/lib/api/types";
import { can, load, requireSession } from "@/lib/auth/guard";
import { formatDate, formatDateTime } from "@/lib/format";
import { DSR_CHANNEL, DSR_STATUS, DSR_TYPE, label } from "@/lib/labels";

import { createDsrAction } from "./actions";

export const metadata: Metadata = { title: "Protección de datos" };

const one = (v: string | string[] | undefined) => (typeof v === "string" ? v : undefined);

export default async function PrivacyPage({ searchParams }: PageProps<"/privacidad">) {
  const session = await requireSession();
  const sp = await searchParams;
  const status = one(sp.status) && one(sp.status)! in DSR_STATUS ? one(sp.status) : undefined;
  const type = one(sp.type) && one(sp.type)! in DSR_TYPE ? one(sp.type) : undefined;
  const overdue = one(sp.overdue) === "1" ? true : undefined;
  const page = Math.max(1, Number(one(sp.page)) || 1);
  const result = await load(() => api<Paged<PrivacyRequest>>("/admin/privacy/requests", { query: { page, pageSize: 25, status, type, overdue } }));

  return (
    <>
      <PageHeader
        title="Protección de datos (ARCO)"
        description="Solicitudes de derechos del titular (Ley 29733). Plazos en días hábiles: información 8, acceso y portabilidad 20, demás 10; ampliación única por igual plazo."
      />
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_380px]">
        <div className="min-w-0">
          <form method="get" className="mb-4 flex flex-wrap items-end gap-2 rounded-md border border-border bg-surface p-3" aria-label="Filtros ARCO">
            <label className="text-xs font-medium">
              Estado
              <select name="status" defaultValue={status ?? ""} className="field-input mt-1">
                <option value="">Todos</option>
                {Object.entries(DSR_STATUS).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-xs font-medium">
              Derecho
              <select name="type" defaultValue={type ?? ""} className="field-input mt-1">
                <option value="">Todos</option>
                {Object.entries(DSR_TYPE).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex min-h-11 items-center gap-2 text-sm">
              <input type="checkbox" name="overdue" value="1" defaultChecked={overdue} className="size-5" /> Solo vencidas
            </label>
            <button type="submit" className={buttonClass("secondary")}>
              Filtrar
            </button>
          </form>
          {!result.ok ? (
            <ErrorPanel error={result.error} />
          ) : result.data.data.length === 0 ? (
            <EmptyState>No hay solicitudes con esos filtros.</EmptyState>
          ) : (
            <>
              <TableWrap label="Solicitudes ARCO">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th scope="col">Código</th>
                      <th scope="col">Derecho</th>
                      <th scope="col">Estado</th>
                      <th scope="col">Recibida</th>
                      <th scope="col">Vence</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.data.data.map((r) => (
                      <tr key={r.id}>
                        <td>
                          <Link href={`/privacidad/${r.id}`} className="font-mono font-medium">
                            {r.code}
                          </Link>
                        </td>
                        <td>{label(DSR_TYPE, r.type)}</td>
                        <td>
                          <Badge tone={DSR_STATUS[r.status]?.tone ?? "neutral"}>{DSR_STATUS[r.status]?.label ?? r.status}</Badge>
                          {r.overdue ? (
                            <span className="ml-1">
                              <Badge tone="danger">Vencida</Badge>
                            </span>
                          ) : null}
                          {r.extended ? <span className="block text-xs text-foreground-muted">ampliada</span> : null}
                        </td>
                        <td className="whitespace-nowrap">{formatDateTime(r.receivedAt)}</td>
                        <td className="whitespace-nowrap">{formatDate(r.dueAt)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </TableWrap>
              <Pagination basePath="/privacidad" params={{ status, type, overdue: overdue ? "1" : undefined }} meta={result.data.meta} />
            </>
          )}
        </div>

        <div className="min-w-0 space-y-4">
        {can(session, "privacy:read") ? (
          <Section title="Historial de consentimientos" id="consentimientos" description="Por correo del titular. La consulta queda auditada.">
            <ConsentHistoryForm />
          </Section>
        ) : null}
        {can(session, "privacy:manage") ? (
          <Section title="Registrar solicitud" id="registrar" description="Recibida por cualquier canal.">
            <ActionForm action={createDsrAction} refresh={false}>
              <Field label="Derecho" name="type" required>
                <select className="field-input">
                  {Object.entries(DSR_TYPE).map(([k, v]) => (
                    <option key={k} value={k}>
                      {v}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Nombre del titular" name="subjectName" required>
                <input className="field-input" maxLength={200} autoComplete="off" />
              </Field>
              <Field label="Correo del titular" name="subjectEmail" required>
                <input type="email" className="field-input" maxLength={254} autoComplete="off" />
              </Field>
              <Field label="Canal" name="channel" required>
                <select className="field-input">
                  {Object.entries(DSR_CHANNEL).map(([k, v]) => (
                    <option key={k} value={k}>
                      {v}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Recibida el (hora de Lima)" name="receivedAt" hint="Vacío = ahora.">
                <input type="datetime-local" className="field-input" />
              </Field>
              <Field label="Detalle del pedido" name="detail" required>
                <textarea className="field-input" rows={4} maxLength={5000} />
              </Field>
              <SubmitButton variant="primary">Registrar</SubmitButton>
            </ActionForm>
          </Section>
        ) : null}
        </div>
      </div>
    </>
  );
}
