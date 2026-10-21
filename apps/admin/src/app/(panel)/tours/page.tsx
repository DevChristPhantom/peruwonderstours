import type { Metadata } from "next";
import Link from "next/link";

import { TranslationStatusBadge } from "@/components/content/TranslationStatus";
import { Badge } from "@/components/ui/Badge";
import { ErrorPanel } from "@/components/ui/ErrorPanel";
import { EmptyState, PageHeader, TableWrap } from "@/components/ui/Layout";
import { Pagination } from "@/components/ui/Pagination";
import { buttonClass } from "@/components/ui/styles";
import { api, type Paged } from "@/lib/api/client";
import type { TourListItem } from "@/lib/api/types";
import { can, load, requireSession } from "@/lib/auth/guard";
import { formatDateTime } from "@/lib/format";
import { TOUR_STATUS, TOUR_TYPE, label } from "@/lib/labels";

export const metadata: Metadata = { title: "Tours" };

const one = (v: string | string[] | undefined) => (typeof v === "string" ? v : undefined);

/** `undefined` = sin traducción al inglés; `null` = revisada por el equipo. */
function enStatus(t: TourListItem): string | null | undefined {
  const en = t.translations?.find((x) => x.locale === "en");
  return en ? en.translationStatus : undefined;
}

export default async function ToursPage({ searchParams }: PageProps<"/tours">) {
  const session = await requireSession();
  const sp = await searchParams;
  const status = one(sp.status) && one(sp.status)! in TOUR_STATUS ? one(sp.status) : undefined;
  const q = one(sp.q)?.trim().slice(0, 100) || undefined;
  const page = Math.max(1, Number(one(sp.page)) || 1);
  const result = await load(() => api<Paged<TourListItem>>("/admin/tours", { query: { page, pageSize: 25, status, q } }));

  return (
    <>
      <PageHeader
        title="Tours"
        description="Catálogo editable. Publicar exige traducción en español con título, resumen e itinerario, y una portada."
        actions={
          can(session, "tours:write") ? (
            <Link href="/tours/nuevo" className={buttonClass("secondary")}>
              Nuevo tour
            </Link>
          ) : null
        }
      />
      <form method="get" className="mb-4 flex flex-wrap items-end gap-2 rounded-md border border-border bg-surface p-3" aria-label="Filtros de tours">
        <label className="min-w-56 flex-1 text-xs font-medium">
          Buscar (código, slug o título)
          <input name="q" defaultValue={q ?? ""} className="field-input mt-1" maxLength={100} />
        </label>
        <label className="text-xs font-medium">
          Estado
          <select name="status" defaultValue={status ?? ""} className="field-input mt-1">
            <option value="">Activos</option>
            {Object.entries(TOUR_STATUS).map(([k, v]) => (
              <option key={k} value={k}>
                {v.label}
              </option>
            ))}
          </select>
        </label>
        <button type="submit" className={buttonClass("secondary")}>
          Filtrar
        </button>
      </form>

      {!result.ok ? (
        <ErrorPanel error={result.error} />
      ) : result.data.data.length === 0 ? (
        <EmptyState>No hay tours con esos filtros.</EmptyState>
      ) : (
        <>
          <TableWrap label="Listado de tours">
            <table className="data-table">
              <thead>
                <tr>
                  <th scope="col">Tour</th>
                  <th scope="col">Código</th>
                  <th scope="col">Tipo</th>
                  <th scope="col">Estado</th>
                  <th scope="col">Inglés</th>
                  <th scope="col">Actualizado</th>
                  <th scope="col">
                    <span className="sr-only">Accesos</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {result.data.data.map((t) => (
                  <tr key={t.id}>
                    <td className="min-w-72">
                      <Link href={`/tours/${t.id}`} className="font-medium">
                        {t.title ?? t.slug}
                      </Link>
                      {t.isFeatured ? <span className="ml-2"><Badge tone="accent">Destacado</Badge></span> : null}
                      <span className="block text-xs text-foreground-muted">/{t.slug}</span>
                    </td>
                    <td className="font-mono text-xs whitespace-nowrap">{t.code}</td>
                    <td>{label(TOUR_TYPE, t.type)}</td>
                    <td>
                      <Badge tone={TOUR_STATUS[t.status]?.tone ?? "neutral"}>{TOUR_STATUS[t.status]?.label ?? t.status}</Badge>
                    </td>
                    <td>
                      <Link href={`/tours/${t.id}?idioma=en#traduccion`} className="no-underline">
                        <TranslationStatusBadge status={enStatus(t)} />
                      </Link>
                    </td>
                    <td className="text-xs whitespace-nowrap">{formatDateTime(t.updatedAt)}</td>
                    <td className="text-xs whitespace-nowrap">
                      <Link href={`/precios?tourId=${t.id}`}>Precios</Link> · <Link href={`/salidas?tourId=${t.id}`}>Salidas</Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableWrap>
          <Pagination basePath="/tours" params={{ status, q }} meta={result.data.meta} />
        </>
      )}
    </>
  );
}
