import type { ReactNode } from "react";

import type { Crumb } from "@/lib/seo/json-ld";

import { Breadcrumbs } from "./Breadcrumbs";

/** Página institucional con contenido pendiente de validación del cliente (marcador visible). */
export function PendingContentPage({
  title,
  crumbs,
  notice,
  children,
}: {
  title: string;
  crumbs: Crumb[];
  notice: string;
  children?: ReactNode;
}) {
  return (
    <div className="pwt-container-narrow pt-8 pb-20">
      <Breadcrumbs items={crumbs} />
      <h1 className="mt-4 font-display text-h1 font-medium">{title}</h1>
      <p className="mt-6 rounded-md border border-dashed border-warning bg-warning-soft px-4 py-3 text-sm text-warning">{notice}</p>
      {children ? <div className="mt-8 space-y-4 text-body">{children}</div> : null}
    </div>
  );
}
