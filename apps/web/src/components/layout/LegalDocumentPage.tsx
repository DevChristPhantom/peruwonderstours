import { FileWarning } from "lucide-react";

import { loadLegalDocument, type LegalDocumentKey } from "@/lib/legal/documents";
import { Markdown } from "@/lib/legal/markdown";

import { Breadcrumbs } from "./Breadcrumbs";

/** Página legal publicada desde `docs/legal/*.md`, con aviso de BORRADOR siempre visible. */
export function LegalDocumentPage({ doc, path, title }: { doc: LegalDocumentKey; path: string; title: string }) {
  const legal = loadLegalDocument(doc);
  return (
    <div className="pwt-container-narrow pt-8 pb-20">
      <Breadcrumbs
        items={[
          { name: "Inicio", path: "/es" },
          { name: title, path },
        ]}
      />
      <h1 className="mt-4 font-display text-h1 font-medium">{legal.title}</h1>
      <div
        role="note"
        aria-label="Documento en borrador"
        className="mt-6 flex gap-3 rounded-md border-2 border-dashed border-warning bg-warning-soft px-4 py-3 text-sm text-warning"
      >
        <FileWarning aria-hidden size={20} strokeWidth={1.5} className="mt-0.5 shrink-0" />
        <p>
          <strong>BORRADOR</strong> pendiente de revisión legal y de los datos de la agencia
          {legal.draftVersion ? ` (versión ${legal.draftVersion})` : ""}. Los textos marcados como
          &quot;POR CONFIRMAR&quot; aún no son definitivos.
        </p>
      </div>
      <div className="mt-6 text-body">
        <Markdown blocks={legal.blocks} />
      </div>
    </div>
  );
}
