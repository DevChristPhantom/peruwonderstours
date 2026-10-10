import type { Metadata } from "next";
import Link from "next/link";

import { TranslationStatusBadge } from "@/components/content/TranslationStatus";
import { Badge } from "@/components/ui/Badge";
import { ErrorPanel } from "@/components/ui/ErrorPanel";
import { EmptyState, PageHeader, TableWrap } from "@/components/ui/Layout";
import { Pagination } from "@/components/ui/Pagination";
import { buttonClass } from "@/components/ui/styles";
import { api, type Paged } from "@/lib/api/client";
import type { BlogListItem } from "@/lib/api/content-types";
import { can, load, requireSession } from "@/lib/auth/guard";
import { BLOG_STATUS } from "@/lib/content";
import { formatDate, formatDateTime } from "@/lib/format";

export const metadata: Metadata = { title: "Blog" };

const STATUSES = ["draft", "published", "archived"] as const;

export default async function BlogPage({ searchParams }: PageProps<"/blog">) {
  const session = await requireSession();
  const sp = await searchParams;
  const status = STATUSES.find((s) => s === sp.status);
  const q = typeof sp.q === "string" ? sp.q.trim().slice(0, 100) : "";
  const page = Math.max(1, Number(sp.page) || 1);
  const result = await load(() => api<Paged<BlogListItem>>("/admin/blog-posts", { query: { page, pageSize: 25, status, q: q || undefined } }));

  return (
    <>
      <PageHeader
        title="Blog"
        description="Artículos del sitio en español e inglés. Publicar exige el texto en español."
        actions={
          can(session, "content:write") ? (
            <Link href="/blog/nuevo" className={buttonClass("primary")}>
              Nuevo artículo
            </Link>
          ) : null
        }
      />
      <nav aria-label="Filtrar por estado" className="mb-3 flex flex-wrap gap-2">
        <Link href="/blog" aria-current={!status ? "page" : undefined} className={buttonClass(!status ? "secondary" : "outline", "sm")}>
          Activos
        </Link>
        {STATUSES.map((s) => (
          <Link key={s} href={`/blog?status=${s}`} aria-current={status === s ? "page" : undefined} className={buttonClass(status === s ? "secondary" : "outline", "sm")}>
            {BLOG_STATUS[s]?.label}
          </Link>
        ))}
      </nav>
      <form method="get" className="mb-4 flex flex-wrap items-end gap-2" aria-label="Buscar artículos">
        {status ? <input type="hidden" name="status" value={status} /> : null}
        <label className="text-xs font-medium">
          Buscar por título
          <input name="q" defaultValue={q} maxLength={100} className="field-input mt-1 w-72 max-w-full" />
        </label>
        <button type="submit" className={buttonClass("secondary")}>
          Buscar
        </button>
      </form>

      {!result.ok ? (
        <ErrorPanel error={result.error} />
      ) : result.data.data.length === 0 ? (
        <EmptyState>No hay artículos con esos filtros.</EmptyState>
      ) : (
        <>
          <TableWrap label="Artículos del blog">
            <table className="data-table">
              <thead>
                <tr>
                  <th scope="col">Título</th>
                  <th scope="col">Estado</th>
                  <th scope="col">Publicado</th>
                  <th scope="col">Etiquetas</th>
                  <th scope="col">Inglés</th>
                  <th scope="col">Editado</th>
                </tr>
              </thead>
              <tbody>
                {result.data.data.map((p) => {
                  const st = BLOG_STATUS[p.status] ?? { label: p.status, tone: "neutral" as const };
                  const en = p.translations.find((t) => t.locale === "en");
                  return (
                    <tr key={p.id}>
                      <td>
                        <Link href={`/blog/${p.id}`} className="font-medium">
                          {p.title ?? "(sin título)"}
                        </Link>
                      </td>
                      <td>
                        <Badge tone={st.tone}>{st.label}</Badge>
                      </td>
                      <td className="whitespace-nowrap">{p.publishedAt ? formatDate(p.publishedAt) : "—"}</td>
                      <td className="text-xs">{p.tags.length ? p.tags.join(", ") : "—"}</td>
                      <td>
                        <TranslationStatusBadge status={en ? en.translationStatus : undefined} />
                      </td>
                      <td className="whitespace-nowrap">{formatDateTime(p.updatedAt)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </TableWrap>
          <Pagination basePath="/blog" params={{ status, q: q || undefined }} meta={result.data.meta} />
        </>
      )}
    </>
  );
}
