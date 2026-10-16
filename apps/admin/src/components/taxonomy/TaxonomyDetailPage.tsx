import { notFound } from "next/navigation";

import { TranslationStatusBadge } from "@/components/content/TranslationStatus";
import { ActionForm, SubmitButton } from "@/components/forms/ActionForm";
import { Badge } from "@/components/ui/Badge";
import { ErrorPanel } from "@/components/ui/ErrorPanel";
import { PageHeader, Section } from "@/components/ui/Layout";
import { TabLinks } from "@/components/ui/TabLinks";
import { deleteTaxonomyAction, updateTaxonomyAction } from "@/lib/actions/taxonomy";
import { apiData } from "@/lib/api/client";
import type { TaxonomyItem, TaxonomyKind } from "@/lib/api/content-types";
import { can, load, requireSession } from "@/lib/auth/guard";
import { DESTINATION_STATUS } from "@/lib/content";
import { formatDateTime } from "@/lib/format";
import { mediaUrl } from "@/lib/media";
import { TAXONOMY, UUID_RE } from "@/lib/taxonomy";

import { TaxonomyGeneralFields } from "./TaxonomyGeneralFields";
import { TaxonomyTranslationPanel } from "./TaxonomyTranslationPanel";

/** Detalle de un destino o categoría: pestañas General / Español / Inglés. */
export async function TaxonomyDetailPage({ kind, id, tab }: { kind: TaxonomyKind; id: string; tab?: string }) {
  const session = await requireSession();
  const cfg = TAXONOMY[kind];
  if (!UUID_RE.test(id)) notFound();
  const back = { href: cfg.route, label: cfg.plural };
  const [result, all] = await Promise.all([
    load(() => apiData<TaxonomyItem>(`${cfg.apiPath}/${id}`)),
    kind === "destination" ? load(() => apiData<TaxonomyItem[]>(cfg.apiPath)) : Promise.resolve(null),
  ]);
  if (!result.ok) {
    return (
      <>
        <PageHeader title={cfg.singular} back={back} />
        <ErrorPanel error={result.error} />
      </>
    );
  }
  const item = result.data;
  const canWrite = can(session, "content:write");
  const canDelete = can(session, "content:publish");
  const es = item.translations.find((t) => t.locale === "es");
  const en = item.translations.find((t) => t.locale === "en");
  const pt = item.translations.find((t) => t.locale === "pt");
  const active = tab === "es" || tab === "en" || tab === "pt" ? tab : "general";
  const parents = all && all.ok ? all.data.filter((p) => p.id !== item.id).map((p) => ({ id: p.id, name: p.translations.find((t) => t.locale === "es")?.name ?? p.slug })) : [];
  const status = DESTINATION_STATUS[item.status] ?? { label: item.status, tone: "neutral" as const };
  const base = `${cfg.route}/${item.id}`;

  return (
    <>
      <PageHeader
        title={es?.name ?? item.slug}
        back={back}
        description={`Versión ${item.version} · editado ${formatDateTime(item.updatedAt)} · ${item.tourCount} tour(s)`}
        meta={kind === "destination" ? <Badge tone={status.tone}>{status.label}</Badge> : null}
        actions={
          canDelete ? (
            <ActionForm
              action={deleteTaxonomyAction.bind(null, kind, item.id, item.version)}
              refresh={false}
              confirm={`¿Eliminar ${cfg.article} «${es?.name ?? item.slug}»? Dejará de verse en el sitio. Si tiene tours asociados, primero hay que reasignarlos.`}
            >
              <SubmitButton variant="danger" pendingLabel="Eliminando…">
                Eliminar
              </SubmitButton>
            </ActionForm>
          ) : null
        }
      />
      <TabLinks
        label="Secciones"
        active={active}
        tabs={[
          { key: "general", href: base, label: "General" },
          { key: "es", href: `${base}?pestana=es`, label: "Español" },
          { key: "pt", href: `${base}?pestana=pt`, label: <>Português (Brasil) <TranslationStatusBadge status={pt ? pt.translationStatus : undefined} /></> },

          {
            key: "en",
            href: `${base}?pestana=en`,
            label: (
              <>
                Inglés <TranslationStatusBadge status={en ? en.translationStatus : undefined} />
              </>
            ),
          },
        ]}
      />
      {active === "general" ? (
        <Section title="Datos generales">
          <ActionForm action={updateTaxonomyAction.bind(null, kind, item.id, item.version)} className="space-y-4">
            <fieldset disabled={!canWrite} className="space-y-4">
              <TaxonomyGeneralFields
                kind={kind}
                item={item}
                parents={parents}
                cover={item.coverStorageKey ? { storageKey: item.coverStorageKey, url: mediaUrl(item.coverStorageKey) } : null}
                canUpload={can(session, "media:upload")}
              />
            </fieldset>
            {canWrite ? (
              <SubmitButton variant="secondary" pendingLabel="Guardando…">
                Guardar cambios
              </SubmitButton>
            ) : null}
          </ActionForm>
        </Section>
      ) : (
        <Section title={active === "es" ? "Traducción en español" : active === "pt" ? "Traducción al portugués (Brasil)" : "Traducción al inglés"} description={active === "es" ? "Idioma canónico: obligatorio." : "Sin ella se muestra el español con aviso de idioma."}>
          <TaxonomyTranslationPanel kind={kind} item={item} locale={active} canWrite={canWrite} />
        </Section>
      )}
    </>
  );
}
