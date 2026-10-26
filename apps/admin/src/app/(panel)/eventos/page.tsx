import type { Metadata } from "next";
import Link from "next/link";

import { Badge } from "@/components/ui/Badge";
import { ErrorPanel } from "@/components/ui/ErrorPanel";
import { EmptyState, PageHeader, TableWrap } from "@/components/ui/Layout";
import { buttonClass } from "@/components/ui/styles";
import { apiData } from "@/lib/api/client";
import type { Promotion } from "@/lib/api/content-types";
import { can, load, requireSession } from "@/lib/auth/guard";
import { BLOG_STATUS } from "@/lib/content";
import { formatDate, formatDateTime } from "@/lib/format";
import type { Tone } from "@/lib/labels";
import { instantToLimaDay } from "@/lib/schemas/promotions";

export const metadata: Metadata = { title: "Eventos y promociones" };

const CTA_LABEL = { tour: "Paquete", page: "Página", whatsapp: "WhatsApp" } as const;

/** Estado visible del evento: publicado puede estar aún programado o ya vencido por su ventana. */
function visibility(p: Promotion): { label: string; tone: Tone } {
  const now = Date.now();
  if (p.status !== "published") return BLOG_STATUS[p.status] ?? { label: p.status, tone: "neutral" };
  if (p.startsAt && Date.parse(p.startsAt) > now) return { label: "Programado", tone: "warning" };
  if (p.endsAt && Date.parse(p.endsAt) <= now) return { label: "Finalizado", tone: "neutral" };
  return { label: "En el sitio", tone: "success" };
}

export default async function PromotionsPage() {
  const session = await requireSession();
  const result = await load(() => apiData<Promotion[]>("/admin/promotions"));
  return (
    <>
      <PageHeader
        title="Eventos y promociones"
        description="Fiestas y campañas como la Candelaria: aparecen en «Lo más relevante» de la portada y, si lo marcas, como anuncio a los 3 segundos de entrar."
        actions={
          can(session, "content:write") ? (
            <Link href="/eventos/nuevo" className={buttonClass("primary")}>
              Nuevo evento
            </Link>
          ) : null
        }
      />
      {!result.ok ? (
        <ErrorPanel error={result.error} />
      ) : result.data.length === 0 ? (
        <EmptyState>Aún no hay eventos. Crea el primero, por ejemplo la Festividad de la Candelaria.</EmptyState>
      ) : (
        <TableWrap label="Eventos y promociones">
          <table className="data-table">
            <thead>
              <tr>
                <th scope="col">Evento</th>
                <th scope="col">Estado</th>
                <th scope="col">Fechas del evento</th>
                <th scope="col">Se muestra</th>
                <th scope="col">Botón</th>
                <th scope="col">Anuncio</th>
                <th scope="col">Orden</th>
                <th scope="col">Editado</th>
              </tr>
            </thead>
            <tbody>
              {result.data.map((p) => {
                const st = visibility(p);
                const es = p.translations.find((t) => t.locale === "es");
                const window = p.startsAt || p.endsAt ? `${p.startsAt ? formatDate(instantToLimaDay(p.startsAt)) : "ya"} – ${p.endsAt ? formatDate(instantToLimaDay(p.endsAt, true)) : "sin fin"}` : "Siempre";
                return (
                  <tr key={p.id}>
                    <td>
                      <Link href={`/eventos/${p.id}`} className="font-medium">
                        {es?.title ?? "(sin título)"}
                      </Link>
                    </td>
                    <td>
                      <Badge tone={st.tone}>{st.label}</Badge>
                    </td>
                    <td className="whitespace-nowrap">
                      {p.eventStartsOn ? `${formatDate(p.eventStartsOn)}${p.eventEndsOn && p.eventEndsOn !== p.eventStartsOn ? ` – ${formatDate(p.eventEndsOn)}` : ""}` : "—"}
                    </td>
                    <td className="whitespace-nowrap text-xs">{window}</td>
                    <td>{CTA_LABEL[p.ctaKind]}</td>
                    <td>{p.showPopup ? <Badge tone="success">Sí</Badge> : "—"}</td>
                    <td>{p.sortOrder}</td>
                    <td className="whitespace-nowrap">{formatDateTime(p.updatedAt)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </TableWrap>
      )}
    </>
  );
}
