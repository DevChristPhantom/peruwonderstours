import type { Metadata } from "next";

import { ActionForm, SubmitButton } from "@/components/forms/ActionForm";
import { Field } from "@/components/forms/Field";
import { Alert } from "@/components/ui/Alert";
import { PageHeader, Section } from "@/components/ui/Layout";
import { can, requireSession } from "@/lib/auth/guard";

import { createTourAction } from "../actions";

export const metadata: Metadata = { title: "Nuevo tour" };

export default async function NewTourPage() {
  const session = await requireSession();
  return (
    <>
      <PageHeader title="Nuevo tour" back={{ href: "/tours", label: "Tours" }} description="Se crea en borrador. Luego completa la traducción, el itinerario y la portada para publicarlo." />
      {!can(session, "tours:write") ? (
        <Alert tone="warning" title="Sin permiso">
          Crear tours requiere el permiso de edición de tours.
        </Alert>
      ) : (
        <Section className="max-w-3xl">
          <ActionForm action={createTourAction} refresh={false}>
            <div className="grid gap-3 sm:grid-cols-3">
              <Field label="Tipo" name="type" required>
                <select className="field-input" defaultValue="tour">
                  <option value="tour">Tour</option>
                  <option value="package">Paquete (días y noches)</option>
                  <option value="transfer">Traslado</option>
                </select>
              </Field>
              <Field label="Código" name="code" hint="Ej.: PUN-UROS-01" required>
                <input className="field-input font-mono uppercase" maxLength={40} autoComplete="off" />
              </Field>
              <Field label="Slug (URL en español)" name="slug" hint="minúsculas-y-guiones" required>
                <input className="field-input font-mono" maxLength={160} autoComplete="off" />
              </Field>
              <Field label="Duración (horas)" name="durationHours" hint="Tours y traslados.">
                <input inputMode="numeric" className="field-input" />
              </Field>
              <Field label="Días" name="durationDays" hint="Paquetes: días >= 1.">
                <input inputMode="numeric" className="field-input" />
              </Field>
              <Field label="Noches" name="durationNights" hint="Paquetes: días − 1 o igual.">
                <input inputMode="numeric" className="field-input" />
              </Field>
              <Field label="Pasajeros mínimos" name="minPax">
                <input inputMode="numeric" className="field-input" defaultValue="1" />
              </Field>
            </div>
            <SubmitButton variant="primary" pendingLabel="Creando…">
              Crear borrador
            </SubmitButton>
          </ActionForm>
        </Section>
      )}
    </>
  );
}
