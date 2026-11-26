import { FileWarning, Languages } from "lucide-react";
import { getTranslations } from "next-intl/server";

import type { Locale } from "@/i18n/routing";
import { getBookingPolicy } from "@/lib/api/booking-policy";
import { hasEnglishVersion, loadLegalDocument, type LegalDocument, type LegalDocumentKey } from "@/lib/legal/documents";
import { Markdown, parseMarkdown } from "@/lib/legal/markdown";
import type { Crumb } from "@/lib/seo/json-ld";

import { Breadcrumbs } from "./Breadcrumbs";

/**
 * Página legal publicada desde `docs/legal/*.md`, con aviso de BORRADOR siempre visible. Los textos
 * legales existen solo en español: en inglés se avisa y el documento se marca `lang="es"`.
 */
export async function LegalDocumentPage({ doc, crumbs, locale }: { doc: LegalDocumentKey; crumbs: Crumb[]; locale: Locale }) {
  let legal: LegalDocument = loadLegalDocument(doc, locale);
  // PWT-LEG-001: si el panel guardó una revisión (r1, r2…), se publica esa en lugar del texto base.
  if (doc === "cancelacion") {
    const revision = await getBookingPolicy(locale);
    if (revision && revision.revision > 0) legal = { title: revision.title, draft: false, draftVersion: null, blocks: parseMarkdown(revision.body) };
  }
  const english = locale === "en" && hasEnglishVersion(doc);
  const documentLanguage = locale === "pt" ? "pt-BR" : english ? "en" : "es-PE";
  const t = await getTranslations("legal");
  return (
    <div className="pwt-container-narrow pt-8 pb-20">
      <Breadcrumbs items={crumbs} />
      <h1 lang={documentLanguage} className="mt-4 font-display text-h1 font-medium">
        {legal.title}
      </h1>
      {locale === "en" && !english ? (
        <p role="note" className="mt-6 flex gap-3 rounded-md border border-border bg-surface-muted px-4 py-3 text-sm">
          <Languages aria-hidden size={20} strokeWidth={1.5} className="mt-0.5 shrink-0" />
          {t("spanishOnly")}
        </p>
      ) : null}
      {legal.draft ? (
        <div
          role="note"
          aria-label={t("draftLabel")}
          className="mt-6 flex gap-3 rounded-md border-2 border-dashed border-warning bg-warning-soft px-4 py-3 text-sm text-warning"
        >
          <FileWarning aria-hidden size={20} strokeWidth={1.5} className="mt-0.5 shrink-0" />
          <p>{legal.draftVersion ? t("draftWithVersion", { version: legal.draftVersion }) : t("draft")}</p>
        </div>
      ) : null}
      <div lang={documentLanguage} className="mt-6 text-body">
        <Markdown blocks={legal.blocks} />
      </div>
    </div>
  );
}
