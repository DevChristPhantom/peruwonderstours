import { ActionForm, SubmitButton } from "@/components/forms/ActionForm";
import { Field } from "@/components/forms/Field";
import { Alert } from "@/components/ui/Alert";
import { PageHeader, Section } from "@/components/ui/Layout";
import { createTaxonomyAction } from "@/lib/actions/taxonomy";
import { apiData } from "@/lib/api/client";
import type { TaxonomyItem, TaxonomyKind } from "@/lib/api/content-types";
import { can, load, requireSession } from "@/lib/auth/guard";
import { TAXONOMY } from "@/lib/taxonomy";

import { TaxonomyGeneralFields } from "./TaxonomyGeneralFields";

/** Alta de un destino o categoría con su nombre en español; el inglés se agrega después. */
export async function TaxonomyNewPage({ kind }: { kind: TaxonomyKind }) {
  const session = await requireSession();
  const cfg = TAXONOMY[kind];
  const back = { href: cfg.route, label: cfg.plural };
  if (!can(session, "content:write")) {
    return (
      <>
        <PageHeader title={cfg.newLabel} back={back} />
        <Alert tone="warning" title="Sin permiso">
          Tu rol puede ver el contenido pero no crearlo.
        </Alert>
      </>
    );
  }
  const parentsResult = kind === "destination" ? await load(() => apiData<TaxonomyItem[]>(cfg.apiPath)) : null;
  const parents =
    parentsResult && parentsResult.ok ? parentsResult.data.map((p) => ({ id: p.id, name: p.translations.find((t) => t.locale === "es")?.name ?? p.slug })) : [];

  return (
    <>
      <PageHeader title={cfg.newLabel} back={back} description="Primero en español (idioma canónico). La traducción al inglés se agrega desde su pestaña." />
      <Section>
        <ActionForm action={createTaxonomyAction.bind(null, kind)} refresh={false} className="space-y-4">
          <div className="grid gap-3 md:grid-cols-2">
            <Field label="Nombre" name="name" required>
              <input className="field-input" maxLength={160} />
            </Field>
          </div>
          <TaxonomyGeneralFields kind={kind} parents={parents} cover={null} canUpload={can(session, "media:upload")} />
          <Field label="Descripción" name="description">
            <textarea className="field-input" rows={5} maxLength={20000} />
          </Field>
          {kind === "destination" ? (
            <div className="grid gap-3 md:grid-cols-2">
              <Field label="Título SEO" name="seoTitle" hint="Máx. 70.">
                <input className="field-input" maxLength={70} />
              </Field>
              <Field label="Descripción SEO" name="seoDescription" hint="Máx. 170.">
                <input className="field-input" maxLength={170} />
              </Field>
            </div>
          ) : null}
          <SubmitButton variant="primary" pendingLabel="Creando…">
            Crear
          </SubmitButton>
        </ActionForm>
      </Section>
    </>
  );
}
