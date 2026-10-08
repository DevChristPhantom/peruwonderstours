import type { Metadata } from "next";

import { LegalDocumentPage } from "@/components/layout/LegalDocumentPage";
import { pageMetadata } from "@/lib/seo/metadata";

export const metadata: Metadata = pageMetadata({
  title: "Condiciones de pago y cancelación",
  description: "Pagos, saldo, cancelación, cambios y reembolsos de Peru Wonders Tours (borrador).",
  path: "/es/politicas/condiciones-de-pago",
});

/** Texto de docs/legal (borrador de compliance-peru-analyst) con aviso visible de BORRADOR. */
export default function PaymentTermsPage() {
  return <LegalDocumentPage doc="cancelacion" path="/es/politicas/condiciones-de-pago" title="Condiciones de pago y cancelación" />;
}
