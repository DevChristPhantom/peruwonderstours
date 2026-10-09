import Link from "next/link";

import { buttonClass } from "./styles";

/** Paginación por enlaces GET (enlazable, sin JS). */
export function Pagination({
  basePath,
  params,
  meta,
}: {
  basePath: string;
  params: Record<string, string | undefined>;
  meta: { page: number; totalPages: number; total: number; pageSize: number };
}) {
  const href = (page: number) => {
    const q = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) if (v) q.set(k, v);
    q.set("page", String(page));
    return `${basePath}?${q.toString()}`;
  };
  const from = meta.total === 0 ? 0 : (meta.page - 1) * meta.pageSize + 1;
  const to = Math.min(meta.total, meta.page * meta.pageSize);
  return (
    <nav aria-label="Paginación" className="mt-3 flex flex-wrap items-center justify-between gap-2 text-sm">
      <p className="text-foreground-muted">
        {from}–{to} de {meta.total}
      </p>
      <div className="flex gap-2">
        {meta.page > 1 ? (
          <Link className={buttonClass("outline", "sm")} href={href(meta.page - 1)} rel="prev">
            Anterior
          </Link>
        ) : null}
        <span className="inline-flex min-h-9 items-center px-2 text-foreground-muted">
          Página {meta.page} de {Math.max(1, meta.totalPages)}
        </span>
        {meta.page < meta.totalPages ? (
          <Link className={buttonClass("outline", "sm")} href={href(meta.page + 1)} rel="next">
            Siguiente
          </Link>
        ) : null}
      </div>
    </nav>
  );
}
