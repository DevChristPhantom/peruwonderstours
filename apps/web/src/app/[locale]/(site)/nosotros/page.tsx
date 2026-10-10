import type { Metadata } from "next";

import { PendingContentPage } from "@/components/layout/PendingContentPage";
import { pageMetadata } from "@/lib/seo/metadata";
import { SITE } from "@/lib/site";

export const metadata: Metadata = pageMetadata({
  title: "Nosotros",
  description: `${SITE.name}: agencia de viajes con oficina en Puno.`,
  path: "/es/nosotros",
});

export default function AboutPage() {
  return (
    <PendingContentPage
      title="Nosotros"
      path="/es/nosotros"
      notice="Contenido en preparación: la historia, el equipo y los datos de registro de la agencia se publicarán cuando el cliente los confirme."
    >
      {/* TODO(contenido): migrar y reescribir "quienes-somos" con la marca nueva. */}
      <p>
        {SITE.name} organiza tours y paquetes por el sur del Perú desde su oficina en Puno: lago Titicaca, Cusco y Machu
        Picchu, Arequipa y el Colca.
      </p>
    </PendingContentPage>
  );
}
