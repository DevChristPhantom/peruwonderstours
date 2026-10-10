import type { Metadata } from "next";
import Link from "next/link";

import { Badge } from "@/components/ui/Badge";
import { ErrorPanel } from "@/components/ui/ErrorPanel";
import { EmptyState, PageHeader, TableWrap } from "@/components/ui/Layout";
import { Pagination } from "@/components/ui/Pagination";
import { buttonClass } from "@/components/ui/styles";
import { api } from "@/lib/api/client";
import type { ContactListResponse, ContactStatus } from "@/lib/api/content-types";
import { load, requireSession } from "@/lib/auth/guard";
import { CONTACT_STATUS } from "@/lib/content";
import { formatDateTime } from "@/lib/format";

export const metadata: Metadata = { title: "Mensajes de contacto" };

const STATUSES: ContactStatus[] = ["new", "answered", "archived"];

/** Bandeja del formulario de contacto. El teléfono no aparece aquí: solo en el detalle (lectura auditada). */
export default async function ContactInboxPage({ searchParams }: PageProps<"/contacto">) {
  await requireSession();
  const sp = await searchParams;
  const status = sp.status === "todos" ? undefined : (STATUSES.find((s) => s === sp.status) ?? "new");
  const page = Math.max(1, Number(sp.page) || 1);
  const result = await load(() => api<ContactListResponse>("/admin/contact-messages", { query: { page, pageSize: 25, status } }));
  const counts = result.ok ? result.data.meta.counts : {};

  return (
    <>
      <PageHeader title="Mensajes de contacto" description="Consultas del formulario «Contáctanos». Responde por correo y luego marca el mensaje como respondido." />
      <nav aria-label="Filtrar por estado" className="mb-4 flex flex-wrap gap-2">
        {STATUSES.map((s) => (
          <Link key={s} href={`/contacto?status=${s}`} aria-current={status === s ? "page" : undefined} className={buttonClass(status === s ? "secondary" : "outline", "sm")}>
            {CONTACT_STATUS[s]?.label}s
            <span className="rounded-pill bg-surface-muted px-1.5 text-xs font-semibold text-foreground">{counts[s] ?? 0}</span>
          </Link>
        ))}
        <Link href="/contacto?status=todos" aria-current={!status ? "page" : undefined} className={buttonClass(!status ? "secondary" : "outline", "sm")}>
          Todos
        </Link>
      </nav>

      {!result.ok ? (
        <ErrorPanel error={result.error} />
      ) : result.data.data.length === 0 ? (
        <EmptyState>{status === "new" ? "No hay mensajes nuevos." : "No hay mensajes en este estado."}</EmptyState>
      ) : (
        <>
          <TableWrap label="Mensajes de contacto">
            <table className="data-table">
              <thead>
                <tr>
                  <th scope="col">Recibido</th>
                  <th scope="col">De</th>
                  <th scope="col">Asunto</th>
                  <th scope="col">Estado</th>
                </tr>
              </thead>
              <tbody>
                {result.data.data.map((m) => {
                  const st = CONTACT_STATUS[m.status] ?? { label: m.status, tone: "neutral" as const };
                  return (
                    <tr key={m.id}>
                      <td className="whitespace-nowrap">{formatDateTime(m.createdAt)}</td>
                      <td>
                        <span className="font-medium">{m.name}</span>
                        <span className="block text-xs text-foreground-muted">{m.email}</span>
                      </td>
                      <td className="max-w-xl">
                        <Link href={`/contacto/${m.id}`} className="font-medium">
                          {m.subject}
                        </Link>
                        <span className="block truncate text-xs text-foreground-muted">{m.preview}</span>
                        {m.tourSlug ? <span className="block text-xs">Tour: {m.tourSlug}</span> : null}
                      </td>
                      <td>
                        <Badge tone={st.tone}>{st.label}</Badge>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </TableWrap>
          <Pagination basePath="/contacto" params={{ status: status ?? "todos" }} meta={result.data.meta} />
        </>
      )}
    </>
  );
}
