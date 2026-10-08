import type { Metadata } from "next";

import { Breadcrumbs } from "@/components/layout/Breadcrumbs";
import { ComplaintForm } from "@/components/complaints/ComplaintForm";
import { pageMetadata } from "@/lib/seo/metadata";
import { SITE } from "@/lib/site";

export const metadata: Metadata = pageMetadata({
  title: "Libro de Reclamaciones",
  description: "Libro de Reclamaciones virtual de Peru Wonders Tours (Ley 29571). Registra tu reclamo o queja sin crear una cuenta.",
  path: "/es/libro-de-reclamaciones",
});

/**
 * Libro de Reclamaciones virtual (HU-8.1): público, sin registro ni pagos previos, con la hoja en el
 * orden del Anexo I y constancia imprimible. Se envía por Server Action a `POST /api/v1/complaints`.
 */
export default function ComplaintsBookPage() {
  return (
    <div className="pwt-container-narrow pt-8 pb-20">
      <div className="print:hidden">
        <Breadcrumbs
          items={[
            { name: "Inicio", path: "/es" },
            { name: "Libro de Reclamaciones", path: "/es/libro-de-reclamaciones" },
          ]}
        />
        <h1 className="mt-4 font-display text-h1 font-medium">Libro de Reclamaciones</h1>
        <p className="mt-4 text-foreground-muted">
          Conforme al Código de Protección y Defensa del Consumidor, {SITE.name} pone a tu disposición este Libro de
          Reclamaciones virtual. No necesitas una cuenta ni una reserva para usarlo. Si necesitas ayuda para llenarlo,
          escríbenos por WhatsApp al {SITE.whatsapp.display}.
        </p>
      </div>
      <div className="mt-8">
        <ComplaintForm
          provider={{
            legalName: SITE.legal.businessName,
            ruc: SITE.legal.ruc,
            establishmentAddress: SITE.legal.address,
            establishmentCode: null,
          }}
        />
      </div>
    </div>
  );
}
