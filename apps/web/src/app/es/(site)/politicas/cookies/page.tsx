import type { Metadata } from "next";

import { LegalDocumentPage } from "@/components/layout/LegalDocumentPage";
import { pageMetadata } from "@/lib/seo/metadata";

export const metadata: Metadata = pageMetadata({
  title: "Política de cookies",
  description: "Qué cookies usa el sitio de Peru Wonders Tours y cómo gestionarlas (borrador).",
  path: "/es/politicas/cookies",
});

/** Texto de docs/legal (borrador de compliance-peru-analyst) con aviso visible de BORRADOR. */
export default function CookiesPage() {
  return <LegalDocumentPage doc="cookies" path="/es/politicas/cookies" title="Política de cookies" />;
}
