import type { Metadata } from "next";

import { LegalDocumentPage } from "@/components/layout/LegalDocumentPage";
import { pageMetadata } from "@/lib/seo/metadata";

export const metadata: Metadata = pageMetadata({
  title: "Protección de datos personales",
  description: "Política de privacidad de Peru Wonders Tours, Ley 29733 (borrador).",
  path: "/es/politicas/proteccion-de-datos-personales",
});

/** Texto de docs/legal (borrador de compliance-peru-analyst) con aviso visible de BORRADOR. */
export default function PrivacyPage() {
  return <LegalDocumentPage doc="privacidad" path="/es/politicas/proteccion-de-datos-personales" title="Protección de datos personales" />;
}
