import { Star } from "lucide-react";

import { approveTestimonialAction, featureTestimonialAction, rejectTestimonialAction } from "@/app/(panel)/testimonios/actions";
import { ActionForm, SubmitButton } from "@/components/forms/ActionForm";
import { Badge } from "@/components/ui/Badge";
import { buttonClass } from "@/components/ui/styles";
import type { Testimonial } from "@/lib/api/content-types";
import { TESTIMONIAL_ORIGIN, TESTIMONIAL_STATUS } from "@/lib/content";
import { formatDate, formatDateTime } from "@/lib/format";

import { TestimonialEditForm } from "./TestimonialEditForm";

/** Tarjeta de moderación: texto completo, consentimiento y acciones según estado y permisos. */
export function TestimonialCard({ t, canPublish, canWrite }: { t: Testimonial; canPublish: boolean; canWrite: boolean }) {
  const st = TESTIMONIAL_STATUS[t.status] ?? { label: t.status, tone: "neutral" as const };
  const noConsent = t.origin === "web" && !t.publishConsent;
  return (
    <article className="space-y-3 rounded-md border border-border bg-surface p-4" aria-labelledby={`t-${t.id}-titulo`}>
      <header className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 id={`t-${t.id}-titulo`} className="text-base font-semibold">
            {t.authorName}
            {t.authorCountry ? <span className="font-normal text-foreground-muted"> · {t.authorCountry}</span> : null}
          </h2>
          <p className="text-xs text-foreground-muted">
            {formatDateTime(t.createdAt)} · {TESTIMONIAL_ORIGIN[t.origin] ?? t.origin} · {t.locale === "pt" ? "Português (Brasil)" : t.locale === "en" ? "Inglés" : "Español"}
            {t.travelDate ? ` · viajó el ${formatDate(t.travelDate)}` : ""}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-0.5 text-sm" aria-label={`${t.rating} de 5 estrellas`}>
            {Array.from({ length: 5 }, (_, i) => (
              <Star key={i} aria-hidden size={14} className={i < t.rating ? "fill-current text-warning" : "text-border-strong"} />
            ))}
          </span>
          <Badge tone={st.tone}>{st.label}</Badge>
          {t.isFeatured ? <Badge tone="accent">Destacado</Badge> : null}
          {noConsent ? <Badge tone="danger">Sin consentimiento de publicación</Badge> : null}
        </div>
      </header>

      <p className="whitespace-pre-line break-words text-sm">{t.body}</p>
      {t.source ? (
        <p className="text-xs text-foreground-muted">
          Fuente: {t.sourceUrl ? <a href={t.sourceUrl} target="_blank" rel="noopener noreferrer nofollow">{t.source}</a> : t.source}
        </p>
      ) : null}
      {t.moderationNote ? (
        <p className="text-xs">
          <span className="font-medium">Nota de moderación:</span> {t.moderationNote}
          {t.approvedBy ? ` (${t.approvedBy.fullName})` : ""}
        </p>
      ) : null}

      <div className="flex flex-wrap items-start gap-2 border-t border-border pt-3">
        {canPublish && t.status !== "approved" && !noConsent ? (
          <ActionForm action={approveTestimonialAction.bind(null, t.id)} showSuccess={false}>
            <SubmitButton variant="secondary" size="sm" pendingLabel="Aprobando…">
              Aprobar
            </SubmitButton>
          </ActionForm>
        ) : null}
        {canPublish && t.status === "approved" ? (
          <ActionForm action={featureTestimonialAction.bind(null, t.id, !t.isFeatured)} showSuccess={false}>
            <SubmitButton variant="outline" size="sm" pendingLabel="Guardando…">
              {t.isFeatured ? "Quitar de destacados" : "Destacar"}
            </SubmitButton>
          </ActionForm>
        ) : null}
        {canPublish && t.status !== "rejected" ? (
          <details>
            <summary className={buttonClass("danger", "sm", "list-none")}>Rechazar</summary>
            <ActionForm
              action={rejectTestimonialAction.bind(null, t.id)}
              confirm={`¿Rechazar el testimonio de ${t.authorName}? Dejará de mostrarse en el sitio.`}
              className="mt-2 w-80 max-w-full space-y-2 rounded-sm border border-danger p-3"
            >
              <label htmlFor={`t-${t.id}-motivo`} className="block text-sm font-medium">
                Motivo (interno) <span className="text-danger" aria-hidden>*</span>
              </label>
              <textarea id={`t-${t.id}-motivo`} name="note" required minLength={3} maxLength={500} rows={2} className="field-input" />
              <SubmitButton variant="danger" size="sm" pendingLabel="Rechazando…">
                Confirmar rechazo
              </SubmitButton>
            </ActionForm>
          </details>
        ) : null}
        {canWrite ? <TestimonialEditForm t={t} /> : null}
      </div>
    </article>
  );
}
