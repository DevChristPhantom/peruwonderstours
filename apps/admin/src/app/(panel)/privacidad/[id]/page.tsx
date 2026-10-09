import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { ActionForm, SubmitButton } from "@/components/forms/ActionForm";
import { Field } from "@/components/forms/Field";
import { Alert } from "@/components/ui/Alert";
import { Badge } from "@/components/ui/Badge";
import { ErrorPanel } from "@/components/ui/ErrorPanel";
import { KeyValues, PageHeader, Section } from "@/components/ui/Layout";
import { apiData } from "@/lib/api/client";
import type { PrivacyRequest } from "@/lib/api/types";
import { can, load, requireSession } from "@/lib/auth/guard";
import { formatDateTime } from "@/lib/format";
import { DSR_CHANNEL, DSR_STATUS, DSR_TYPE, label } from "@/lib/labels";

import { extendDsrAction, respondDsrAction, setDsrStatusAction } from "../actions";

export const metadata: Metadata = { title: "Solicitud ARCO" };

export default async function PrivacyRequestPage({ params }: PageProps<"/privacidad/[id]">) {
  const session = await requireSession();
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const result = await load(() => apiData<PrivacyRequest>(`/admin/privacy/requests/${id}`));
  if (!result.ok) {
    return (
      <>
        <PageHeader title="Solicitud ARCO" back={{ href: "/privacidad", label: "Protección de datos" }} />
        <ErrorPanel error={result.error} />
      </>
    );
  }
  const r = result.data;
  const open = r.status === "received" || r.status === "in_progress";
  const canManage = can(session, "privacy:manage") && open;
  const extendable = !r.extended && r.type !== "information" && r.type !== "revoke_consent";

  return (
    <>
      <PageHeader
        title={<span className="font-mono">{r.code}</span>}
        back={{ href: "/privacidad", label: "Protección de datos" }}
        description={`Derecho de ${label(DSR_TYPE, r.type).toLowerCase()} · canal ${label(DSR_CHANNEL, r.channel).toLowerCase()}`}
        meta={
          <>
            <Badge tone={DSR_STATUS[r.status]?.tone ?? "neutral"}>{DSR_STATUS[r.status]?.label ?? r.status}</Badge>
            {r.overdue ? <Badge tone="danger">Vencida</Badge> : null}
            {r.extended ? <Badge tone="info">Plazo ampliado</Badge> : null}
          </>
        }
        actions={
          canManage ? (
            <>
              {r.status === "received" ? (
                <ActionForm action={setDsrStatusAction.bind(null, r.id, r.version, "in_progress")} showSuccess={false}>
                  <SubmitButton variant="outline">Marcar en trámite</SubmitButton>
                </ActionForm>
              ) : null}
              <ActionForm action={setDsrStatusAction.bind(null, r.id, r.version, "withdrawn")} showSuccess={false} confirm="¿Registrar que el titular desistió de la solicitud?">
                <SubmitButton variant="ghost">Desistimiento</SubmitButton>
              </ActionForm>
            </>
          ) : null
        }
      />
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_400px]">
        <div className="min-w-0 space-y-4">
          <Section title="Solicitud" id="solicitud">
            <KeyValues
              items={[
                ["Titular", r.subjectName],
                ["Correo", r.subjectEmail],
                ["Cliente registrado", r.customerId ? "Sí" : "No"],
                ["Recibida", formatDateTime(r.receivedAt)],
                ["Vence", formatDateTime(r.dueAt)],
                ["Ampliación", r.extendedAt ? `${formatDateTime(r.extendedAt)}: ${r.extensionReason ?? ""}` : "—"],
              ]}
            />
            <p className="mt-3 text-xs text-foreground-muted">Detalle</p>
            <p className="text-sm whitespace-pre-wrap">{r.detail}</p>
          </Section>
          {r.response ? (
            <Section title="Respuesta" id="respuesta">
              <p className="text-xs text-foreground-muted">
                {formatDateTime(r.response.respondedAt)} · {r.response.respondedBy?.fullName ?? "—"}
              </p>
              <p className="mt-1 text-sm whitespace-pre-wrap">{r.response.text}</p>
            </Section>
          ) : null}
        </div>
        <aside className="min-w-0 space-y-4" aria-label="Acciones de la solicitud">
          {!open ? <Alert tone="info">La solicitud está cerrada.</Alert> : null}
          {canManage ? (
            <Section title="Responder" id="responder">
              <ActionForm action={respondDsrAction.bind(null, r.id, r.version)} confirm="¿Registrar la respuesta y cerrar la solicitud?">
                <Field label="Resultado" name="status" required>
                  <select className="field-input">
                    <option value="answered">Atendida</option>
                    <option value="rejected">Denegada (con fundamento)</option>
                  </select>
                </Field>
                <Field label="Respuesta al titular" name="responseText" required>
                  <textarea className="field-input" rows={6} />
                </Field>
                <SubmitButton variant="primary">Registrar respuesta</SubmitButton>
              </ActionForm>
            </Section>
          ) : null}
          {canManage && extendable ? (
            <Section title="Ampliar plazo" id="ampliar" description="Una sola vez, por igual plazo, comunicándolo al titular.">
              <ActionForm action={extendDsrAction.bind(null, r.id, r.version)} confirm="¿Ampliar el plazo? Solo se puede una vez.">
                <Field label="Motivo" name="reason" required>
                  <textarea className="field-input" rows={3} maxLength={1000} />
                </Field>
                <SubmitButton variant="outline">Ampliar plazo</SubmitButton>
              </ActionForm>
            </Section>
          ) : null}
        </aside>
      </div>
    </>
  );
}
