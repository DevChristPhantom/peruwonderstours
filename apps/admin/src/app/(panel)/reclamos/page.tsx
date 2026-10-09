import type { Metadata } from "next";
import Link from "next/link";

import { Badge } from "@/components/ui/Badge";
import { ErrorPanel } from "@/components/ui/ErrorPanel";
import { EmptyState, PageHeader, TableWrap } from "@/components/ui/Layout";
import { Pagination } from "@/components/ui/Pagination";
import { buttonClass } from "@/components/ui/styles";
import { api, type Paged } from "@/lib/api/client";
import type { ComplaintListItem } from "@/lib/api/types";
import { can, load, requireSession } from "@/lib/auth/guard";
import { formatDate, formatDateTime } from "@/lib/format";
import { COMPLAINT_CHANNEL, COMPLAINT_STATUS, COMPLAINT_TYPE, label, TRAFFIC_LIGHT } from "@/lib/labels";

export const metadata: Metadata = { title: "Libro de Reclamaciones" };

const one = (v: string | string[] | undefined) => (typeof v === "string" ? v : undefined);
const pick = <T extends string>(v: string | undefined, allowed: Record<string, unknown>): T | undefined => (v && v in allowed ? (v as T) : undefined);

function Remaining({ c }: { c: ComplaintListItem }) {
  if (c.trafficLight === "done") return <span className="text-foreground-muted">—</span>;
  if (c.trafficLight === "overdue") return <strong className="text-danger">Vencido</strong>;
  if (c.trafficLight === "suspended") return <span>Suspendido{c.settlement?.expiresAt ? ` hasta ${formatDate(c.settlement.expiresAt)}` : ""}</span>;
  return (
    <span className={c.businessDaysRemaining <= 2 ? "font-semibold text-danger" : c.businessDaysRemaining <= 5 ? "font-semibold text-warning" : ""}>
      {c.businessDaysRemaining} {c.businessDaysRemaining === 1 ? "día hábil" : "días hábiles"}
    </span>
  );
}

/** Bandeja (HU-8.2): ordenada por vencimiento. La PII del consumidor solo se ve al abrir el detalle. */
export default async function ComplaintsPage({ searchParams }: PageProps<"/reclamos">) {
  const session = await requireSession();
  const sp = await searchParams;
  const trafficLight = pick<string>(one(sp.trafficLight), TRAFFIC_LIGHT);
  const status = pick<string>(one(sp.status), COMPLAINT_STATUS);
  const type = pick<string>(one(sp.type), COMPLAINT_TYPE);
  const channel = pick<string>(one(sp.channel), COMPLAINT_CHANNEL);
  const code = one(sp.code)?.trim().toUpperCase();
  const validCode = code && /^[A-Z0-9-]{3,20}$/.test(code) ? code : undefined;
  const page = Math.max(1, Number(one(sp.page)) || 1);

  const result = await load(() =>
    api<Paged<ComplaintListItem>>("/admin/complaints", { query: { page, pageSize: 25, trafficLight, status, type, channel, code: validCode } }),
  );

  return (
    <>
      <PageHeader
        title="Libro de Reclamaciones"
        description="Plazo legal: 15 días hábiles improrrogables (Ley 29571). Semáforo: verde < 10 días transcurridos, amarillo desde el 10.º, rojo desde el 13.º."
        actions={
          can(session, "complaints:manage") ? (
            <Link href="/reclamos/transcribir" className={buttonClass("secondary")}>
              Transcribir hoja física
            </Link>
          ) : null
        }
      />

      <nav aria-label="Filtrar por semáforo" className="mb-3 flex flex-wrap gap-2">
        <Link href="/reclamos" aria-current={!trafficLight ? "page" : undefined} className={buttonClass(!trafficLight ? "secondary" : "outline", "sm")}>
          Todos
        </Link>
        {(["overdue", "red", "yellow", "green", "suspended", "done"] as const).map((k) => (
          <Link key={k} href={`/reclamos?trafficLight=${k}`} aria-current={trafficLight === k ? "page" : undefined} className={buttonClass(trafficLight === k ? "secondary" : "outline", "sm")} title={TRAFFIC_LIGHT[k].hint}>
            {TRAFFIC_LIGHT[k].label}
          </Link>
        ))}
      </nav>

      <form method="get" className="mb-4 grid grid-cols-2 items-end gap-2 rounded-md border border-border bg-surface p-3 md:grid-cols-5" aria-label="Filtros del Libro de Reclamaciones">
        {trafficLight ? <input type="hidden" name="trafficLight" value={trafficLight} /> : null}
        <label className="text-xs font-medium">
          Estado
          <select name="status" defaultValue={status ?? ""} className="field-input mt-1">
            <option value="">Todos</option>
            {Object.entries(COMPLAINT_STATUS).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs font-medium">
          Tipo
          <select name="type" defaultValue={type ?? ""} className="field-input mt-1">
            <option value="">Todos</option>
            <option value="reclamo">Reclamo</option>
            <option value="queja">Queja</option>
          </select>
        </label>
        <label className="text-xs font-medium">
          Canal
          <select name="channel" defaultValue={channel ?? ""} className="field-input mt-1">
            <option value="">Todos</option>
            {Object.entries(COMPLAINT_CHANNEL).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs font-medium">
          Código
          <input name="code" defaultValue={validCode ?? ""} placeholder="LR-2026-" className="field-input mt-1 font-mono" maxLength={20} />
        </label>
        <button type="submit" className={buttonClass("secondary")}>
          Filtrar
        </button>
      </form>

      {!result.ok ? (
        <ErrorPanel error={result.error} />
      ) : result.data.data.length === 0 ? (
        <EmptyState>No hay hojas con esos filtros.</EmptyState>
      ) : (
        <>
          <TableWrap label="Bandeja del Libro de Reclamaciones">
            <table className="data-table">
              <thead>
                <tr>
                  <th scope="col">Semáforo</th>
                  <th scope="col">Hoja</th>
                  <th scope="col">Tipo</th>
                  <th scope="col">Estado</th>
                  <th scope="col">Canal</th>
                  <th scope="col">Presentado</th>
                  <th scope="col">Vence</th>
                  <th scope="col">Quedan</th>
                </tr>
              </thead>
              <tbody>
                {result.data.data.map((c) => (
                  <tr key={c.id}>
                    <td>
                      <Badge tone={TRAFFIC_LIGHT[c.trafficLight]?.tone ?? "neutral"} title={TRAFFIC_LIGHT[c.trafficLight]?.hint}>
                        {TRAFFIC_LIGHT[c.trafficLight]?.label ?? c.trafficLight}
                      </Badge>
                    </td>
                    <td>
                      <Link href={`/reclamos/${c.id}`} className="font-mono font-medium">
                        {c.code}
                      </Link>
                      <span className="block text-xs text-foreground-muted">Hoja {c.sheetNumber}</span>
                    </td>
                    <td>
                      {label(COMPLAINT_TYPE, c.type)}
                      {c.reclassified ? <span className="block text-xs text-foreground-muted">reclasificado</span> : null}
                    </td>
                    <td>{label(COMPLAINT_STATUS, c.status)}</td>
                    <td>
                      {label(COMPLAINT_CHANNEL, c.channel)}
                      {c.lateTranscription ? (
                        <span className="block">
                          <Badge tone="warning">Transcripción tardía</Badge>
                        </span>
                      ) : null}
                    </td>
                    <td className="whitespace-nowrap">{formatDateTime(c.submittedAt)}</td>
                    <td className="whitespace-nowrap">{formatDate(c.responseDueAt)}</td>
                    <td className="whitespace-nowrap">
                      <Remaining c={c} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableWrap>
          <Pagination basePath="/reclamos" params={{ trafficLight, status, type, channel, code: validCode }} meta={result.data.meta} />
        </>
      )}
    </>
  );
}
