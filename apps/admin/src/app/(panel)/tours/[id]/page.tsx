import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { ActionForm, SubmitButton } from "@/components/forms/ActionForm";
import { Field } from "@/components/forms/Field";
import { TourFieldsForm } from "@/components/tours/TourFieldsForm";
import { TranslationEditor } from "@/components/tours/TranslationEditor";
import { Alert } from "@/components/ui/Alert";
import { Badge } from "@/components/ui/Badge";
import { ErrorPanel } from "@/components/ui/ErrorPanel";
import { EmptyState, PageHeader, Section } from "@/components/ui/Layout";
import { apiData } from "@/lib/api/client";
import { fieldLabel } from "@/lib/api/errors";
import type { TourDetail } from "@/lib/api/types";
import { can, load, requireSession } from "@/lib/auth/guard";
import { formatDateTime } from "@/lib/format";
import { TOUR_STATUS, TOUR_TYPE, label } from "@/lib/labels";

import { addMediaAction, deleteMediaAction, publishTourAction, setCoverAction } from "../actions";

export const metadata: Metadata = { title: "Editar tour" };

export default async function TourDetailPage({ params }: PageProps<"/tours/[id]">) {
  const session = await requireSession();
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const result = await load(() => apiData<TourDetail>(`/admin/tours/${id}`));
  if (!result.ok) {
    return (
      <>
        <PageHeader title="Tour" back={{ href: "/tours", label: "Tours" }} />
        <ErrorPanel error={result.error} />
      </>
    );
  }
  const t = result.data;
  const es = t.translations.find((x) => x.locale === "es");
  const canWrite = can(session, "tours:write") && t.status !== "archived";
  const canPublish = can(session, "tours:publish") && t.status !== "archived";
  const status = TOUR_STATUS[t.status] ?? { label: t.status, tone: "neutral" as const };

  return (
    <>
      <PageHeader
        title={es?.title ?? t.slug}
        back={{ href: "/tours", label: "Tours" }}
        description={
          <>
            <span className="font-mono">{t.code}</span> · {label(TOUR_TYPE, t.type)} · versión {t.version} · editado {formatDateTime(t.updatedAt)}
            {t.updatedBy ? ` por ${t.updatedBy.fullName}` : ""}
          </>
        }
        meta={
          <>
            <Badge tone={status.tone}>{status.label}</Badge>
            <Badge tone={t.activeRateCount > 0 ? "success" : "warning"}>{t.activeRateCount} tarifas vigentes</Badge>
            <Link href={`/precios?tourId=${t.id}`} className="text-xs">
              Precios
            </Link>
            <Link href={`/salidas?tourId=${t.id}`} className="text-xs">
              Salidas
            </Link>
          </>
        }
        actions={
          canPublish ? (
            t.status === "published" ? (
              <ActionForm action={publishTourAction.bind(null, t.id, t.version, false)} confirm="¿Despublicar? El tour dejará de verse en el sitio.">
                <SubmitButton variant="danger">Despublicar</SubmitButton>
              </ActionForm>
            ) : (
              <ActionForm action={publishTourAction.bind(null, t.id, t.version, true)}>
                <SubmitButton variant="primary" pendingLabel="Publicando…">
                  Publicar
                </SubmitButton>
              </ActionForm>
            )
          ) : null
        }
      />

      {t.publication.errors.length > 0 || t.publication.warnings.length > 0 ? (
        <div className="mb-4 grid gap-3 md:grid-cols-2">
          {t.publication.errors.length > 0 ? (
            <Alert tone="warning" title="Falta para publicar" items={t.publication.errors.map((err) => `${fieldLabel(err.field)}: ${err.messages.join(" ")}`)} />
          ) : (
            <Alert tone="success">Cumple los requisitos para publicarse.</Alert>
          )}
          {t.publication.warnings.length > 0 ? <Alert tone="info" title="Avisos" items={t.publication.warnings} /> : null}
        </div>
      ) : null}

      <div className="space-y-4">
        <Section title="Traducción en español" id="traduccion" description="Idioma canónico: obligatorio para publicar.">
          <TranslationEditor tourId={t.id} version={t.version} translation={es} fallbackSlug={t.slug} readOnly={!canWrite} />
        </Section>

        <Section title="Datos generales" id="datos">
          <TourFieldsForm tour={t} readOnly={!canWrite} />
        </Section>

        <Section title="Imágenes" id="imagenes" description="Por URL del CDN mientras no esté la subida de archivos. Publicar exige una portada.">
          {t.media.length === 0 ? (
            <EmptyState>Sin imágenes.</EmptyState>
          ) : (
            <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {t.media.map((m) => (
                <li key={m.id} className="space-y-2 rounded-sm border border-border p-2">
                  {/^https:\/\//.test(m.storageKey) ? (
                    // eslint-disable-next-line @next/next/no-img-element -- miniatura de un CDN externo variable; no se optimiza.
                    <img src={m.storageKey} alt={m.altEs ?? ""} width={320} height={200} loading="lazy" className="aspect-video w-full rounded-xs bg-surface-muted object-cover" />
                  ) : (
                    <p className="aspect-video break-all text-xs text-foreground-muted">{m.storageKey}</p>
                  )}
                  <p className="text-xs">{m.altEs ?? <span className="text-foreground-muted">Sin texto alternativo</span>}</p>
                  <div className="flex flex-wrap gap-2">
                    {m.isCover ? <Badge tone="success">Portada</Badge> : null}
                    {canWrite && !m.isCover ? (
                      <ActionForm action={setCoverAction.bind(null, t.id, t.version, m.id)}>
                        <SubmitButton variant="outline" size="sm">
                          Usar como portada
                        </SubmitButton>
                      </ActionForm>
                    ) : null}
                    {canWrite ? (
                      <ActionForm action={deleteMediaAction.bind(null, t.id, t.version, m.id)} confirm="¿Quitar esta imagen del tour?">
                        <SubmitButton variant="danger" size="sm">
                          Quitar
                        </SubmitButton>
                      </ActionForm>
                    ) : null}
                  </div>
                </li>
              ))}
            </ul>
          )}
          {canWrite ? (
            <ActionForm action={addMediaAction.bind(null, t.id, t.version)} resetOnSuccess className="mt-4 grid items-end gap-3 md:grid-cols-[2fr_1fr_auto_auto]">
              <Field label="URL de la imagen (https)" name="storageKey" required>
                <input type="url" className="field-input" maxLength={2000} />
              </Field>
              <Field label="Texto alternativo (es)" name="altEs">
                <input className="field-input" maxLength={250} />
              </Field>
              <label className="flex min-h-11 cursor-pointer items-center gap-2 text-sm">
                <input type="checkbox" name="isCover" className="size-5" /> Portada
              </label>
              <SubmitButton variant="outline">Agregar imagen</SubmitButton>
            </ActionForm>
          ) : null}
        </Section>
      </div>
    </>
  );
}
