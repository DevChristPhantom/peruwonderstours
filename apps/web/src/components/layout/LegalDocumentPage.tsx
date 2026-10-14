import { FileWarning, Languages } from "lucide-react";
import { getTranslations } from "next-intl/server";

import type { Locale } from "@/i18n/routing";
import { loadLegalDocument, type LegalDocumentKey } from "@/lib/legal/documents";
import { Markdown } from "@/lib/legal/markdown";
import type { Crumb } from "@/lib/seo/json-ld";

import { Breadcrumbs } from "./Breadcrumbs";

/**
 * Página legal publicada desde `docs/legal/*.md`, con aviso de BORRADOR siempre visible. Los textos
 * legales existen solo en español: en inglés se avisa y el documento se marca `lang="es"`.
 */
export async function LegalDocumentPage({ doc, crumbs, locale }: { doc: LegalDocumentKey; crumbs: Crumb[]; locale: Locale }) {
  const legal = loadLegalDocument(doc, locale);
  const documentLanguage = locale === "pt" ? "pt-BR" : "es-PE";
  const t = await getTranslations("legal");
  return (
    <div className="pwt-container-narrow pt-8 pb-20">
      <Breadcrumbs items={crumbs} />
      <h1 lang={documentLanguage} className="mt-4 font-display text-h1 font-medium">
        {legal.title}
      </h1>
      {locale === "en" ? (
        <p role="note" className="mt-6 flex gap-3 rounded-md border border-border bg-surface-muted px-4 py-3 text-sm">
          <Languages aria-hidden size={20} strokeWidth={1.5} className="mt-0.5 shrink-0" />
          {t("spanishOnly")}
        </p>
      ) : null}
      <div
        role="note"
        aria-label={t("draftLabel")}
        className="mt-6 flex gap-3 rounded-md border-2 border-dashed border-warning bg-warning-soft px-4 py-3 text-sm text-warning"
      >
        <FileWarning aria-hidden size={20} strokeWidth={1.5} className="mt-0.5 shrink-0" />
        <p>{legal.draftVersion ? t("draftWithVersion", { version: legal.draftVersion }) : t("draft")}</p>
      </div>
      <div lang={documentLanguage} className="mt-6 text-body">
        <Markdown blocks={legal.blocks} />
      </div>
    </div>
  );
}
