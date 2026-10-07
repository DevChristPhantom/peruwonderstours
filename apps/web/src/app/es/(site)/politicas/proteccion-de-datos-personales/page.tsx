import type { Metadata } from "next";

import { PendingContentPage } from "@/components/layout/PendingContentPage";
import { pageMetadata } from "@/lib/seo/metadata";

export const metadata: Metadata = pageMetadata({
  title: "Protección de datos personales",
  description: "Política de privacidad y protección de datos personales (Ley 29733).",
  path: "/es/politicas/proteccion-de-datos-personales",
});

export default function PrivacyPage() {
  return (
    <PendingContentPage
      title="Protección de datos personales"
      path="/es/politicas/proteccion-de-datos-personales"
      notice="Política en redacción por cumplimiento (Ley 29733 y su reglamento): finalidades, banco de datos registrado, transferencias y derechos ARCO."
    >
      {/* TODO(cumplimiento): texto completo, responsable del tratamiento (razón social y RUC) y canal ARCO. */}
      <p>
        Usamos tus datos solo para gestionar tu reserva y, si lo autorizas por separado, para enviarte novedades. Podrás
        ejercer tus derechos de acceso, rectificación, cancelación y oposición.
      </p>
    </PendingContentPage>
  );
}
