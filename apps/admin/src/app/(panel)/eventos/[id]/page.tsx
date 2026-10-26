import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { TranslationStatusBadge, TranslationStatusSelect } from "@/components/content/TranslationStatus";
import { ActionForm, SubmitButton } from "@/components/forms/ActionForm";
import { PromotionSettingsFields } from "@/components/promotions/PromotionSettingsFields";
import { PromotionStatusActions } from "@/components/promotions/PromotionStatusActions";
import { PromotionTextFields } from "@/components/promotions/PromotionTextFields";
import { Alert } from "@/components/ui/Alert";
import { Badge } from "@/components/ui/Badge";
import { ErrorPanel } from "@/components/ui/ErrorPanel";
import { PageHeader, Section } from "@/components/ui/Layout";
import { TabLinks } from "@/components/ui/TabLinks";
import { apiData } from "@/lib/api/client";
import type { Promotion } from "@/lib/api/content-types";
import { can, load, requireSession } from "@/lib/auth/guard";
import { BLOG_STATUS } from "@/lib/content";
import { env } from "@/lib/env";
import { formatDateTime } from "@/lib/format";
import { mediaUrl } from "@/lib/media";

import { deletePromotionTranslationAction, savePromotionTranslationAction, updatePromotionAction } from "../actions";
import { loadTourOptions } from "../tour-options";

export const metadata: Metadata = { title: "Editar evento" };

const LANGUAGE = { es: "español", en: "inglés", pt: "portugués (Brasil)" } as const;

export default async function PromotionPage({ params, searchParams }: PageProps<"/eventos/[id]">) {
  const session = await requireSession();
  const [{ id }, sp] = await Promise.all([params, searchParams]);
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const back = { href: "/eventos", label: "Eventos y promociones" };
  const result = await load(() => apiData<Promotion>(`/admin/promotions/${id}`));
  if (!result.ok) {
    return (
      <>
        <PageHeader title="Evento" back={back} />
        <ErrorPanel error={result.error} />
      </>
    );
  }
  const p = result.data;
  const canWrite = can(session, "content:write");
  const tab = sp.pestana === "es" || sp.pestana === "en" || sp.pestana === "pt" ? sp.pestana : "general";
  const es = p.translations.find((t) => t.locale === "es");
  const en = p.translations.find((t) => t.locale === "en");
  const pt = p.translations.find((t) => t.locale === "pt");
  const current = tab === "general" ? undefined : p.translations.find((t) => t.locale === tab);
  const st = BLOG_STATUS[p.status] ?? { label: p.status, tone: "neutral" as const };
  const base = `/eventos/${p.id}`;
  const tours = tab === "general" ? await loadTourOptions().catch(() => []) : [];

  return (
    <>
      <PageHeader
        title={es?.title ?? "(sin título)"}
        back={back}
        description={
          <>
            Versión {p.version} · editado {formatDateTime(p.updatedAt)} ·{" "}
            <a href={`${env().PUBLIC_WEB_BASE_URL}/es`} target="_blank" rel="noopener noreferrer">
              Ver la portada del sitio
            </a>
          </>
        }
        meta={
          <>
            <Badge tone={st.tone}>{st.label}</Badge>
            {p.showPopup ? <Badge tone="info">Anuncio al entrar</Badge> : null}
          </>
        }
        actions={can(session, "content:publish") ? <PromotionStatusActions promotion={p} /> : null}
      />
      <TabLinks
        label="Secciones del evento"
        active={tab}
        tabs={[
          { key: "general", href: base, label: "Botón, fechas e imagen" },
          { key: "es", href: `${base}?pestana=es`, label: "Español" },
          { key: "en", href: `${base}?pestana=en`, label: <>Inglés <TranslationStatusBadge status={en ? en.translationStatus : undefined} /></> },
          { key: "pt", href: `${base}?pestana=pt`, label: <>Português (Brasil) <TranslationStatusBadge status={pt ? pt.translationStatus : undefined} /></> },
        ]}
      />
      {tab === "general" ? (
        <Section title="Botón, fechas e imagen" description="Los cambios se ven en la portada al guardar.">
          <ActionForm action={updatePromotionAction.bind(null, p.id, p.version)} className="space-y-4">
            <fieldset disabled={!canWrite} className="space-y-4">
              <PromotionSettingsFields promotion={p} tours={tours} mediaUrl={mediaUrl(p.coverStorageKey)} canUpload={can(session, "media:upload")} />
            </fieldset>
            {canWrite ? (
              <SubmitButton variant="secondary" pendingLabel="Guardando…">
                Guardar cambios
              </SubmitButton>
            ) : null}
          </ActionForm>
        </Section>
      ) : (
        <Section
          title={`Texto en ${LANGUAGE[tab]}`}
          description={tab === "es" ? "Obligatorio para publicar." : "Opcional: sin él, el sitio en este idioma muestra el texto en español."}
        >
          {tab !== "es" && !current ? <Alert tone="info">Aún no hay versión en {LANGUAGE[tab]}. Completa el formulario para crearla.</Alert> : null}
          <ActionForm key={tab} action={savePromotionTranslationAction.bind(null, p.id, p.version, tab)} className="mt-4 space-y-4">
            <fieldset disabled={!canWrite} className="space-y-4">
              <PromotionTextFields locale={tab} translation={current} />
              {tab !== "es" ? (
                <div className="max-w-md">
                  <TranslationStatusSelect defaultValue={current?.translationStatus} />
                </div>
              ) : null}
            </fieldset>
            {canWrite ? (
              <SubmitButton variant="secondary" pendingLabel="Guardando…">
                Guardar texto
              </SubmitButton>
            ) : null}
          </ActionForm>
          {tab !== "es" && current && canWrite ? (
            <ActionForm
              action={deletePromotionTranslationAction.bind(null, p.id, p.version, tab)}
              confirm={`¿Eliminar la versión en ${LANGUAGE[tab]}? Se mostrará el español.`}
              className="mt-4 border-t border-border pt-4"
            >
              <SubmitButton variant="danger" size="sm" pendingLabel="Eliminando…">
                Eliminar versión en {LANGUAGE[tab]}
              </SubmitButton>
            </ActionForm>
          ) : null}
        </Section>
      )}
    </>
  );
}
