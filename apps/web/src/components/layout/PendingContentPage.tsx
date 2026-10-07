import type { ReactNode } from "react";

import { Breadcrumbs } from "./Breadcrumbs";

/** Página institucional/legal con contenido pendiente de validación. */
export function PendingContentPage({
  title,
  path,
  notice,
  children,
}: {
  title: string;
  path: string;
  notice: string;
  children?: ReactNode;
}) {
  return (
    <div className="pwt-container-narrow pt-8 pb-20">
      <Breadcrumbs
        items={[
          { name: "Inicio", path: "/es" },
          { name: title, path },
        ]}
      />
      <h1 className="mt-4 font-display text-h1 font-medium">{title}</h1>
      <p className="mt-6 rounded-md border border-dashed border-warning bg-warning-soft px-4 py-3 text-sm text-warning">{notice}</p>
      {children ? <div className="mt-8 space-y-4 text-body">{children}</div> : null}
    </div>
  );
}
