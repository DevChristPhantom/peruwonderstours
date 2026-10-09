import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { ActionForm, SubmitButton } from "@/components/forms/ActionForm";
import { Field } from "@/components/forms/Field";
import { Alert } from "@/components/ui/Alert";
import { Badge } from "@/components/ui/Badge";
import { EmailsTable } from "@/components/ui/EmailsTable";
import { ErrorPanel } from "@/components/ui/ErrorPanel";
import { KeyValues, PageHeader, Section } from "@/components/ui/Layout";
import { apiData } from "@/lib/api/client";
import type { ComplaintDetail } from "@/lib/api/types";
import { can, load, requireSession } from "@/lib/auth/guard";
import { formatDate, formatDateTime, formatMoney } from "@/lib/format";
import { COMPLAINT_CHANNEL, COMPLAINT_STATUS, COMPLAINT_TYPE, DOC_TYPE, label, TRAFFIC_LIGHT } from "@/lib/labels";

import {
  acceptSettlementAction,
  markInReviewAction,
  offerSettlementAction,
  reclassifyAction,
  rejectSettlementAction,
  respondAction,
} from "../actions";

export const metadata: Metadata = { title: "Hoja de reclamación" };

const OPEN = ["received", "in_review"];

export default async function ComplaintDetailPage({ params }: PageProps<"/reclamos/[id]">) {
  const session = await requireSession();
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  // Abrir el detalle descifra la PII y la API lo registra en audit_log (COMPLAINT_PII_VIEWED).
  const result = await load(() => apiData<ComplaintDetail>(`/admin/complaints/${id}`));
  if (!result.ok) {
    return (
      <>
        <PageHeader title="Hoja de reclamación" back={{ href: "/reclamos", label: "Libro de Reclamaciones" }} />
        <ErrorPanel error={result.error} />
      </>
    );
  }
  const c = result.data;
  const light = TRAFFIC_LIGHT[c.trafficLight];
  const open = OPEN.includes(c.status);
  const settlementPending = c.settlement && !c.settlement.acceptedAt && !c.settlement.rejectedAt;
  const canRespond = can(session, "complaints:respond") && open;
  const canManage = can(session, "complaints:manage") && open;

  return (
    <>
      <PageHeader
        title={<span className="font-mono">{c.code}</span>}
        back={{ href: "/reclamos", label: "Libro de Reclamaciones" }}
        description={`Hoja ${c.sheetNumber} · ${label(COMPLAINT_CHANNEL, c.channel)}${c.backupSheetNumber ? ` · hoja física n.º ${c.backupSheetNumber}` : ""}`}
        meta={
          <>
            <Badge tone={light?.tone ?? "neutral"} title={light?.hint}>
              {light?.label ?? c.trafficLight}
            </Badge>
            <Badge>{label(COMPLAINT_TYPE, c.type)}</Badge>
            <Badge>{label(COMPLAINT_STATUS, c.status)}</Badge>
            <span className="text-xs text-foreground-muted">
              Vence {formatDateTime(c.responseDueAt)}
              {open && c.trafficLight !== "overdue" ? ` · quedan ${c.businessDaysRemaining} días hábiles (${c.businessDaysElapsed} transcurridos)` : ""}
            </span>
          </>
        }
        actions={
          canRespond && c.status === "received" ? (
            <ActionForm action={markInReviewAction.bind(null, c.id)}>
              <SubmitButton variant="outline">Marcar en revisión</SubmitButton>
            </ActionForm>
          ) : null
        }
      />

      <Alert tone="info">Consulta de datos personales registrada en la auditoría. No copies estos datos fuera del panel.</Alert>
      {c.lateTranscription ? (
        <div className="mt-3">
          <Alert tone="warning">La transcripción superó el día calendario del art. 4-A: documenta la causa.</Alert>
        </div>
      ) : null}

      <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1fr)_420px]">
        <div className="min-w-0 space-y-4">
          <Section title="Consumidor" id="consumidor">
            <KeyValues
              items={[
                ["Nombre", c.consumer.fullName],
                ["Documento", `${label(DOC_TYPE, c.consumer.docType)} ${c.consumer.docNumber}`],
                ["Domicilio", c.consumer.address],
                ["Correo", c.consumer.email],
                ["Teléfono", c.consumer.phone],
                ["Menor de edad", c.consumer.isMinor ? "Sí" : "No"],
              ]}
            />
            {c.guardian ? (
              <div className="mt-3 border-t border-border pt-3">
                <p className="mb-2 text-xs font-semibold">Padre, madre o apoderado</p>
                <KeyValues
                  items={[
                    ["Nombre", c.guardian.fullName],
                    ["Domicilio", c.guardian.address],
                    ["Correo", c.guardian.email],
                    ["Teléfono", c.guardian.phone],
                  ]}
                />
              </div>
            ) : null}
          </Section>

          <Section title="Detalle" id="detalle">
            <KeyValues
              items={[
                ["Bien contratado", c.good.type === "product" ? "Producto" : "Servicio"],
                ["Monto reclamado", c.good.claimedAmount ? formatMoney(c.good.claimedAmount) : "—"],
                ["Descripción", c.good.description],
                ["Tipo declarado por el consumidor", label(COMPLAINT_TYPE, c.declaredType)],
                ["Presentado", formatDateTime(c.submittedAt)],
                ["Respuesta por", c.responseChannel === "email" ? "Correo electrónico" : "Carta"],
                ["Reserva vinculada", c.bookingId ? "Sí (verificada)" : "No"],
                ...(c.declaredBookingCode
                  ? ([["Reserva declarada", <span key="d"><span className="font-mono">{c.declaredBookingCode}</span> <Badge tone="warning">No verificada</Badge></span>]] as [string, React.ReactNode][])
                  : []),
              ]}
            />
            <div className="mt-3 space-y-3 text-sm">
              <div>
                <p className="text-xs text-foreground-muted">Detalle del reclamo o queja</p>
                <p className="whitespace-pre-wrap">{c.detail}</p>
              </div>
              <div>
                <p className="text-xs text-foreground-muted">Pedido del consumidor</p>
                <p className="whitespace-pre-wrap">{c.consumerRequest}</p>
              </div>
            </div>
          </Section>

          <Section title="Seguimiento" id="seguimiento">
            <KeyValues
              items={[
                ["Constancia enviada", formatDateTime(c.acknowledgment.sentAt)],
                ["Vencimiento original", formatDateTime(c.originalResponseDueAt)],
                ["Respondido", c.response.respondedAt ? `${formatDateTime(c.response.respondedAt)} por ${c.response.respondedBy?.fullName ?? "—"}` : "—"],
                ["Respuesta comunicada", c.response.sentAt ? `${formatDateTime(c.response.sentAt)}${c.response.deliveryRef ? ` (${c.response.deliveryRef})` : ""}` : "—"],
                ["Reclasificación", c.reclassification ? `${formatDateTime(c.reclassification.at)} · ${c.reclassification.by?.fullName ?? ""}: ${c.reclassification.reason ?? ""}` : "—"],
              ]}
            />
            {c.response.text ? (
              <div className="mt-3 text-sm">
                <p className="text-xs text-foreground-muted">Respuesta</p>
                <p className="whitespace-pre-wrap">{c.response.text}</p>
              </div>
            ) : null}
            {c.settlement ? (
              <div className="mt-3 rounded-sm border border-border p-3 text-sm">
                <p className="font-medium">Solución directa (art. 6-A)</p>
                <p className="text-xs text-foreground-muted">
                  Ofrecida {formatDateTime(c.settlement.offeredAt)} · suspensión hasta {formatDateTime(c.settlement.expiresAt)}
                  {c.settlement.acceptedAt ? ` · aceptada ${formatDateTime(c.settlement.acceptedAt)}` : ""}
                  {c.settlement.rejectedAt ? ` · rechazada ${formatDateTime(c.settlement.rejectedAt)}` : ""}
                </p>
                {c.settlement.offerText ? <p className="mt-1 whitespace-pre-wrap">{c.settlement.offerText}</p> : null}
                {c.settlement.acceptanceEvidence ? <p className="mt-1 text-xs">Evidencia: {c.settlement.acceptanceEvidence}</p> : null}
              </div>
            ) : null}
          </Section>

          <Section title="Correos" id="correos">
            <EmailsTable emails={c.emails} />
          </Section>

          <Section title="Proveedor y avisos legales" id="legal">
            <KeyValues
              items={[
                ["Razón social", c.provider.legalName],
                ["RUC", c.provider.ruc],
                ["Establecimiento", c.provider.establishmentAddress],
                ["Código", c.provider.establishmentCode],
              ]}
            />
            <ul className="mt-3 list-disc space-y-1 pl-5 text-xs text-foreground-muted">
              {c.legalNotices.map((n, i) => (
                <li key={i}>{n}</li>
              ))}
            </ul>
          </Section>
        </div>

        <aside className="min-w-0 space-y-4" aria-label="Acciones del reclamo">
          {!open ? <p className="text-sm text-foreground-muted">Estado de la hoja: {label(COMPLAINT_STATUS, c.status)}. No admite más acciones.</p> : null}

          {canRespond && !settlementPending ? (
            <Section title="Responder" id="responder" description={c.responseChannel === "email" ? "Se envía por correo al consumidor." : "Canal carta: registra el envío y el cargo."}>
              <ActionForm action={respondAction.bind(null, c.id)} confirm="¿Registrar la respuesta? Se comunicará al consumidor y cierra el plazo.">
                <Field label="Respuesta" name="responseText" hint="Mínimo 10 caracteres." required>
                  <textarea className="field-input" rows={6} maxLength={10000} />
                </Field>
                {c.responseChannel === "letter" ? (
                  <>
                    <Field label="Fecha de envío de la carta (hora de Lima)" name="letterSentAt" required>
                      <input type="datetime-local" className="field-input" />
                    </Field>
                    <Field label="N.º de cargo o guía" name="letterDeliveryRef" required>
                      <input className="field-input" maxLength={150} />
                    </Field>
                  </>
                ) : null}
                <SubmitButton variant="primary">Enviar respuesta</SubmitButton>
              </ActionForm>
            </Section>
          ) : null}

          {canManage ? (
            <Section title="Reclasificar" id="reclasificar" description="Queja ↔ reclamo. Se conserva el tipo declarado; el plazo no cambia.">
              <ActionForm action={reclassifyAction.bind(null, c.id)}>
                <Field label="Nuevo tipo" name="type" required>
                  <select className="field-input" defaultValue={c.type === "reclamo" ? "queja" : "reclamo"}>
                    <option value="reclamo">Reclamo (disconformidad con el producto o servicio)</option>
                    <option value="queja">Queja (malestar con la atención)</option>
                  </select>
                </Field>
                <Field label="Motivo" name="reason" required>
                  <input className="field-input" maxLength={500} />
                </Field>
                <SubmitButton variant="outline">Reclasificar</SubmitButton>
              </ActionForm>
            </Section>
          ) : null}

          {canManage && !c.settlement ? (
            <Section title="Solución directa" id="solucion" description="Art. 6-A: suspende el plazo hasta 5 días hábiles mientras el consumidor responde.">
              <ActionForm action={offerSettlementAction.bind(null, c.id)} confirm="¿Enviar la oferta de solución directa al consumidor?">
                <Field label="Propuesta" name="offerText" hint="Se envía por correo con la frase de aceptación." required>
                  <textarea className="field-input" rows={4} maxLength={5000} />
                </Field>
                <SubmitButton variant="outline">Enviar oferta</SubmitButton>
              </ActionForm>
            </Section>
          ) : null}

          {canManage && settlementPending ? (
            <Section title="Respuesta del consumidor a la oferta" id="oferta">
              <ActionForm action={acceptSettlementAction.bind(null, c.id)} confirm="¿Registrar la aceptación? El reclamo queda solucionado.">
                <Field label="Evidencia de la aceptación expresa" name="evidence" hint="Ej.: correo del consumidor con la frase de aceptación." required>
                  <textarea className="field-input" rows={3} maxLength={5000} />
                </Field>
                <Field label="Aceptada el (hora de Lima)" name="acceptedAt" hint="Vacío = ahora.">
                  <input type="datetime-local" className="field-input" />
                </Field>
                <SubmitButton variant="outline">Registrar aceptación</SubmitButton>
              </ActionForm>
              <div className="my-4 border-t border-border" />
              <ActionForm action={rejectSettlementAction.bind(null, c.id)} confirm="¿Registrar rechazo o silencio? El plazo se reanuda.">
                <Field label="Nota (rechazo o silencio)" name="note">
                  <input className="field-input" maxLength={500} />
                </Field>
                <SubmitButton variant="outline">Registrar rechazo</SubmitButton>
              </ActionForm>
            </Section>
          ) : null}
        </aside>
      </div>
      <p className="mt-4 text-xs text-foreground-muted">Fechas en hora de Lima. Presentado {formatDate(c.submittedAt)}.</p>
    </>
  );
}
