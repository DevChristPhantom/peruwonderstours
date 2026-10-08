import type { Metadata } from "next";

import { LegalDocumentPage } from "@/components/layout/LegalDocumentPage";
import { pageMetadata } from "@/lib/seo/metadata";

export const metadata: Metadata = pageMetadata({
  title: "Términos y condiciones",
  description: "Términos y condiciones de uso y contratación de Peru Wonders Tours (borrador).",
  path: "/es/politicas/terminos-y-condiciones",
});

/** Texto de docs/legal (borrador de compliance-peru-analyst) con aviso visible de BORRADOR. */
export default function TermsPage() {
  return <LegalDocumentPage doc="terminos" path="/es/politicas/terminos-y-condiciones" title="Términos y condiciones" />;
}
