import type { Metadata } from "next";

import { PendingContentPage } from "@/components/layout/PendingContentPage";
import { pageMetadata } from "@/lib/seo/metadata";
import { SITE } from "@/lib/site";

export const metadata: Metadata = pageMetadata({
  title: "Libro de Reclamaciones",
  description: "Libro de Reclamaciones virtual de Peru Wonders Tours (Ley 29571).",
  path: "/es/libro-de-reclamaciones",
});

export default function ComplaintsBookPage() {
  return (
    <PendingContentPage
      title="Libro de Reclamaciones"
      path="/es/libro-de-reclamaciones"
      notice="Formulario en implementación (épica E8). Debe publicarse antes del lanzamiento, con los datos legales de la agencia."
    >
      {/* TODO(E8): formulario con hoja de reclamación (Ley 29571 y reglamento), envío de copia y plazo de respuesta. */}
      <p>
        Conforme al Código de Protección y Defensa del Consumidor, {SITE.name} pone a tu disposición un Libro de
        Reclamaciones virtual. Mientras se habilita el formulario, puedes escribirnos por WhatsApp al {SITE.whatsapp.display}.
      </p>
      <p className="text-sm text-foreground-muted">RUC y razón social: por confirmar.</p>
    </PendingContentPage>
  );
}
