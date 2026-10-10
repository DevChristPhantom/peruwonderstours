import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { ActionForm, SubmitButton } from "@/components/forms/ActionForm";
import { Field } from "@/components/forms/Field";
import { Alert } from "@/components/ui/Alert";
import { Badge } from "@/components/ui/Badge";
import { ErrorPanel } from "@/components/ui/ErrorPanel";
import { KeyValues, PageHeader, Section } from "@/components/ui/Layout";
import { apiData } from "@/lib/api/client";
import type { ContactMessage } from "@/lib/api/content-types";
import { can, load, requireSession } from "@/lib/auth/guard";
import { CONTACT_ACTION_LABEL, CONTACT_STATUS, contactTargets } from "@/lib/content";
import { formatDateTime } from "@/lib/format";

import { setContactStatusAction } from "../actions";

export const metadata: Metadata = { title: "Mensaje de contacto" };

/**
 * Detalle del mensaje. La API descifra el teléfono y registra la lectura en la auditoría; aquí se
 * muestra solo en el HTML del servidor (no pasa a componentes de cliente ni a ninguna caché).
 */
export default async function ContactMessagePage({ params }: PageProps<"/contacto/[id]">) {
  const session = await requireSession();
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const back = { href: "/contacto", label: "Mensajes de contacto" };
  const result = await load(() => apiData<ContactMessage>(`/admin/contact-messages/${id}`));
  if (!result.ok) {
    return (
      <>
        <PageHeader title="Mensaje" back={back} />
        <ErrorPanel error={result.error} />
      </>
    );
  }
  const m = result.data;
  const st = CONTACT_STATUS[m.status] ?? { label: m.status, tone: "neutral" as const };
  const targets = contactTargets(m.status);
  const canManage = can(session, "contact:manage");
  const replySubject = encodeURIComponent(`Re: ${m.subject}`);

  return (
    <>
      <PageHeader title={m.subject} back={back} description={`Recibido ${formatDateTime(m.createdAt)}`} meta={<Badge tone={st.tone}>{st.label}</Badge>} />
      <div className="grid gap-4 lg:grid-cols-[2fr_1fr]">
        <div className="space-y-4">
          <Section title="Mensaje">
            <p className="whitespace-pre-line break-words text-sm">{m.message}</p>
          </Section>
          <Section title="Remitente" description="Datos personales: úsalos solo para responder esta consulta. Tu acceso queda registrado.">
            <KeyValues
              items={[
                ["Nombre", m.name],
                ["Correo", <a key="mail" href={`mailto:${m.email}?subject=${replySubject}`}>{m.email}</a>],
                ["Teléfono", m.phone ? <a key="tel" href={`tel:${m.phone.replace(/[^\d+]/g, "")}`}>{m.phone}</a> : "No indicó"],
                ["Idioma", m.locale === "en" ? "Inglés" : "Español"],
                ["Tour de interés", m.tourSlug ?? "—"],
                ["Aviso de privacidad aceptado", m.privacyNoticeVersion ?? "—"],
              ]}
            />
          </Section>
        </div>
        <Section title="Seguimiento">
          <KeyValues
            columns={1}
            items={[
              ["Respondido", m.answeredAt ? formatDateTime(m.answeredAt) : "—"],
              ["Archivado", m.archivedAt ? formatDateTime(m.archivedAt) : "—"],
            ]}
          />
          {canManage && targets.length > 0 ? (
            <ActionForm action={setContactStatusAction.bind(null, m.id)} className="mt-4 space-y-3">
              <Field label="Nuevo estado" name="status" required>
                <select className="field-input" defaultValue={targets[0]}>
                  {targets.map((s) => (
                    <option key={s} value={s}>
                      {CONTACT_ACTION_LABEL[s] ?? s}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Nota interna" name="internalNote" hint="Solo la ve el equipo. Ej.: «respondido por correo con cotización». Máx. 2000.">
                <textarea className="field-input" rows={4} maxLength={2000} defaultValue={m.internalNote ?? ""} />
              </Field>
              <SubmitButton variant="secondary" pendingLabel="Guardando…">
                Guardar
              </SubmitButton>
            </ActionForm>
          ) : m.internalNote ? (
            <Alert tone="neutral" title="Nota interna">
              {m.internalNote}
            </Alert>
          ) : null}
        </Section>
      </div>
    </>
  );
}
