import type { Metadata } from "next";
import Link from "next/link";

import { TestimonialCard } from "@/components/testimonials/TestimonialCard";
import { ErrorPanel } from "@/components/ui/ErrorPanel";
import { EmptyState, PageHeader } from "@/components/ui/Layout";
import { Pagination } from "@/components/ui/Pagination";
import { buttonClass } from "@/components/ui/styles";
import { api, type Paged } from "@/lib/api/client";
import type { Testimonial } from "@/lib/api/content-types";
import { can, load, requireSession } from "@/lib/auth/guard";
import { TESTIMONIAL_STATUS } from "@/lib/content";

export const metadata: Metadata = { title: "Testimonios" };

const STATUSES = ["pending", "approved", "rejected"] as const;

/** Cola de moderación: por defecto los pendientes (moderación previa a la publicación). */
export default async function TestimonialsPage({ searchParams }: PageProps<"/testimonios">) {
  const session = await requireSession();
  const sp = await searchParams;
  const status = sp.status === "todos" ? undefined : (STATUSES.find((s) => s === sp.status) ?? "pending");
  const page = Math.max(1, Number(sp.page) || 1);
  const result = await load(() => api<Paged<Testimonial>>("/admin/testimonials", { query: { page, pageSize: 20, status } }));
  const canPublish = can(session, "content:publish");
  const canWrite = can(session, "content:write");

  return (
    <>
      <PageHeader
        title="Testimonios"
        description="Nada se publica sin aprobación. Los enviados por la web solo se aprueban si el autor autorizó publicarlos."
      />
      <nav aria-label="Filtrar por estado" className="mb-4 flex flex-wrap gap-2">
        {STATUSES.map((s) => (
          <Link key={s} href={`/testimonios?status=${s}`} aria-current={status === s ? "page" : undefined} className={buttonClass(status === s ? "secondary" : "outline", "sm")}>
            {TESTIMONIAL_STATUS[s]?.label}s
          </Link>
        ))}
        <Link href="/testimonios?status=todos" aria-current={!status ? "page" : undefined} className={buttonClass(!status ? "secondary" : "outline", "sm")}>
          Todos
        </Link>
      </nav>

      {!result.ok ? (
        <ErrorPanel error={result.error} />
      ) : result.data.data.length === 0 ? (
        <EmptyState>{status === "pending" ? "No hay testimonios por moderar." : "No hay testimonios en este estado."}</EmptyState>
      ) : (
        <>
          <div className="space-y-3">
            {result.data.data.map((t) => (
              <TestimonialCard key={t.id} t={t} canPublish={canPublish} canWrite={canWrite} />
            ))}
          </div>
          <Pagination basePath="/testimonios" params={{ status: status ?? "todos" }} meta={result.data.meta} />
        </>
      )}
    </>
  );
}
