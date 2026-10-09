import type { Metadata } from "next";

import { TranscriptionForm } from "@/components/complaints/TranscriptionForm";
import { Alert } from "@/components/ui/Alert";
import { PageHeader, Section } from "@/components/ui/Layout";
import { can, requireSession } from "@/lib/auth/guard";

export const metadata: Metadata = { title: "Transcribir hoja física" };

export default async function TranscribePage() {
  const session = await requireSession();
  return (
    <>
      <PageHeader
        title="Transcribir hoja del libro físico"
        back={{ href: "/reclamos", label: "Libro de Reclamaciones" }}
        description="Art. 4-A: cuando el libro virtual no está disponible, la hoja física se transcribe al virtual dentro de 1 día calendario."
      />
      {can(session, "complaints:manage") ? (
        <Section>
          <TranscriptionForm />
        </Section>
      ) : (
        <Alert tone="warning" title="Sin permiso">
          Transcribir hojas requiere el permiso de gestión del Libro de Reclamaciones.
        </Alert>
      )}
    </>
  );
}
