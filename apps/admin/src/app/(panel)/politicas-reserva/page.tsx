import type { Metadata } from "next";

import { ActionForm, SubmitButton } from "@/components/forms/ActionForm";
import { Field } from "@/components/forms/Field";
import { ErrorPanel } from "@/components/ui/ErrorPanel";
import { PageHeader, Section } from "@/components/ui/Layout";
import { apiData } from "@/lib/api/client";
import { can, load, requireSession } from "@/lib/auth/guard";
import { env } from "@/lib/env";

import { saveBookingPolicyAction } from "./actions";

export const metadata: Metadata = { title: "Políticas de reserva" };

interface PolicyDocument {
  version: string;
  revision: number;
  updatedAt: string;
  translations: Record<"es" | "en" | "pt", { title: string; body: string }>;
}

const LANGS = [
  { locale: "es", label: "Español", path: "/es/politicas-de-reserva-y-cancelacion" },
  { locale: "en", label: "Inglés", path: "/en/booking-and-cancellation-policy" },
  { locale: "pt", label: "Portugués", path: "/pt/politicas-de-reserva-e-cancelamento" },
] as const;

/** PWT-LEG-001: texto público de las políticas, versionado (cada guardado = revisión inmutable). */
export default async function BookingPolicyPage() {
  const session = await requireSession();
  const result = can(session, "content:read") ? await load(() => apiData<PolicyDocument>("/admin/booking-policy")) : null;
  const canEdit = can(session, "content:write");
  const web = env().PUBLIC_WEB_BASE_URL.replace(/\/$/, "");
  return (
    <>
      <PageHeader
        title="Políticas de reserva, pago y cancelación"
        description="Texto que se publica en la web y que el cliente acepta antes de pagar. Cada vez que guardas se crea una versión nueva: las reservas ya hechas conservan la versión que aceptaron."
      />
      {!result ? (
        <ErrorPanel error={{ status: 403, code: "insufficient-permissions", message: "No tienes permiso para consultar las políticas." }} />
      ) : !result.ok ? (
        <ErrorPanel error={result.error} />
      ) : (
        <ActionForm action={saveBookingPolicyAction.bind(null, result.data.revision)} confirm={canEdit ? "¿Publicar esta versión nueva de las políticas? Los clientes la aceptarán desde ahora." : undefined}>
          <p className="text-sm text-foreground-muted">
            Versión vigente: <strong>{result.data.version}</strong> · {result.data.revision === 0 ? "texto base aprobado (25-11-2026)" : `guardada el ${new Date(result.data.updatedAt).toLocaleString("es-PE", { timeZone: "America/Lima" })}`}
          </p>
          <p className="text-sm text-foreground-muted">
            Formato Markdown: <code>## Título de sección</code>, <code>- elemento de lista</code>, <code>**negrita**</code>, tablas con <code>|</code>. Si cambias plazos o porcentajes, avisa al desarrollador: el cálculo del sistema (saldo a 15 días y topes de cancelación) no cambia solo con editar el texto.
          </p>
          {LANGS.map(({ locale, label, path }) => (
            <Section key={locale} title={label} description={<a className="underline" href={`${web}${path}`} target="_blank" rel="noreferrer">Ver en la web</a>}>
              <div className="space-y-3 p-4 sm:p-5">
                <Field label="Título" name={`${locale}.title`} required>
                  <input className="field-input" maxLength={200} defaultValue={result.data.translations[locale].title} disabled={!canEdit} />
                </Field>
                <Field label="Texto" name={`${locale}.body`} required>
                  <textarea className="field-input font-mono text-sm" rows={22} maxLength={60000} defaultValue={result.data.translations[locale].body} disabled={!canEdit} />
                </Field>
              </div>
            </Section>
          ))}
          {canEdit ? <SubmitButton variant="primary" pendingLabel="Guardando…">Guardar versión nueva</SubmitButton> : null}
        </ActionForm>
      )}
    </>
  );
}
