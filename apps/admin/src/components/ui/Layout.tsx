import clsx from "clsx";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";

export function PageHeader({
  title,
  description,
  back,
  actions,
  meta,
}: {
  title: React.ReactNode;
  description?: React.ReactNode;
  back?: { href: string; label: string };
  actions?: React.ReactNode;
  meta?: React.ReactNode;
}) {
  return (
    <header className="admin-page-header mb-6 flex flex-wrap items-end justify-between gap-4 border-b border-border pb-5">
      <div className="min-w-0">
        {back ? (
          <Link href={back.href} className="mb-1 inline-flex min-h-11 items-center gap-1 text-sm text-link hover:underline">
            <ChevronLeft aria-hidden size={14} /> {back.label}
          </Link>
        ) : null}
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">{title}</h1>
        {description ? <p className="mt-2 max-w-2xl text-sm leading-relaxed text-foreground-muted">{description}</p> : null}
        {meta ? <div className="mt-2 flex flex-wrap items-center gap-2">{meta}</div> : null}
      </div>
      {actions ? <div className="flex max-w-full flex-wrap items-center gap-2">{actions}</div> : null}
    </header>
  );
}

export function Section({
  title,
  description,
  actions,
  children,
  className,
  id,
}: {
  title?: React.ReactNode;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  id?: string;
}) {
  const headingId = id ? `${id}-titulo` : undefined;
  return (
    <section id={id} aria-labelledby={title ? headingId : undefined} className={clsx("admin-section min-w-0 rounded-lg border border-border bg-surface", className)}>
      {title ? (
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-4 sm:px-5">
          <div>
            <h2 id={headingId} className="text-base font-semibold">
              {title}
            </h2>
            {description ? <p className="mt-1 text-sm text-foreground-muted">{description}</p> : null}
          </div>
          {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
        </div>
      ) : null}
      <div className="p-4 sm:p-5">{children}</div>
    </section>
  );
}

/** Tabla con scroll horizontal propio (la página nunca hace scroll lateral). */
export function TableWrap({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="admin-table-wrap overflow-x-auto rounded-md border border-border bg-surface" role="region" aria-label={label} tabIndex={0}>
      {children}
    </div>
  );
}

export function KeyValues({ items, columns = 2 }: { items: [React.ReactNode, React.ReactNode][]; columns?: 1 | 2 | 3 }) {
  return (
    <dl className={clsx("grid gap-x-6 gap-y-2 text-sm", columns === 3 ? "sm:grid-cols-3" : columns === 2 ? "sm:grid-cols-2" : "")}>
      {items.map(([k, v], i) => (
        <div key={i} className="min-w-0">
          <dt className="text-xs text-foreground-muted">{k}</dt>
          <dd className="break-words">{v ?? "—"}</dd>
        </div>
      ))}
    </dl>
  );
}

export function EmptyState({ children }: { children: React.ReactNode }) {
  return <p className="rounded-sm border border-dashed border-border-strong p-6 text-center text-sm text-foreground-muted">{children}</p>;
}
