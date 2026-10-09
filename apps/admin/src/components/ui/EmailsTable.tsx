import { Badge } from "@/components/ui/Badge";
import { EmptyState, TableWrap } from "@/components/ui/Layout";
import type { EmailEvent } from "@/lib/api/types";
import { formatDateTime } from "@/lib/format";
import { EMAIL_EVENT, label } from "@/lib/labels";

/** Estado de los correos del outbox ligados a una reserva o reclamo. */
export function EmailsTable({ emails }: { emails: EmailEvent[] }) {
  if (emails.length === 0) return <EmptyState>No hay correos registrados.</EmptyState>;
  return (
    <TableWrap label="Correos">
      <table className="data-table">
        <thead>
          <tr>
            <th scope="col">Correo</th>
            <th scope="col">Encolado</th>
            <th scope="col">Estado</th>
          </tr>
        </thead>
        <tbody>
          {emails.map((m, i) => (
            <tr key={i}>
              <td>{label(EMAIL_EVENT, m.eventType)}</td>
              <td className="whitespace-nowrap">{formatDateTime(m.createdAt)}</td>
              <td>
                {m.publishedAt ? (
                  <Badge tone="success">Enviado {formatDateTime(m.publishedAt)}</Badge>
                ) : m.attempts > 0 ? (
                  <span>
                    <Badge tone="warning">Reintentando ({m.attempts})</Badge>
                    {m.lastError ? <span className="block text-xs text-foreground-muted">{m.lastError.slice(0, 160)}</span> : null}
                  </span>
                ) : (
                  <Badge tone="info">En cola</Badge>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </TableWrap>
  );
}
