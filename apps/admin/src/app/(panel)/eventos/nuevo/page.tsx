import type { Metadata } from "next";

import { ActionForm, SubmitButton } from "@/components/forms/ActionForm";
import { PromotionSettingsFields } from "@/components/promotions/PromotionSettingsFields";
import { PromotionTextFields } from "@/components/promotions/PromotionTextFields";
import { Alert } from "@/components/ui/Alert";
import { PageHeader, Section } from "@/components/ui/Layout";
import { can, requireSession } from "@/lib/auth/guard";

import { createPromotionAction } from "../actions";
import { loadTourOptions } from "../tour-options";

export const metadata: Metadata = { title: "Nuevo evento" };

/** Alta de un evento en borrador con su texto en español y su configuración. */
export default async function NewPromotionPage() {
  const session = await requireSession();
  const back = { href: "/eventos", label: "Eventos y promociones" };
  if (!can(session, "content:write")) {
    return (
      <>
        <PageHeader title="Nuevo evento" back={back} />
        <Alert tone="warning" title="Sin permiso">
          Tu rol puede ver los eventos pero no crearlos.
        </Alert>
      </>
    );
  }
  const tours = await loadTourOptions().catch(() => []);
  return (
    <>
      <PageHeader title="Nuevo evento" back={back} description="Se crea como borrador: revisa la vista y pulsa «Publicar» cuando esté listo. Después puedes añadir inglés y portugués." />
      <ActionForm action={createPromotionAction} refresh={false} className="space-y-4">
        <Section title="Texto en español">
          <PromotionTextFields locale="es" />
        </Section>
        <Section title="Botón, fechas e imagen">
          <PromotionSettingsFields tours={tours} mediaUrl={null} canUpload={can(session, "media:upload")} />
        </Section>
        <SubmitButton variant="primary" pendingLabel="Creando…">
          Crear borrador
        </SubmitButton>
      </ActionForm>
    </>
  );
}
