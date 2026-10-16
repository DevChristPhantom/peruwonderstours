import { TranslationStatusBadge, TranslationStatusSelect } from "@/components/content/TranslationStatus";
import { ActionForm, SubmitButton } from "@/components/forms/ActionForm";
import { Field } from "@/components/forms/Field";
import { Alert } from "@/components/ui/Alert";
import { deleteTaxonomyTranslationAction, markTaxonomyReviewedAction, saveTaxonomyTranslationAction } from "@/lib/actions/taxonomy";
import type { ContentLocale, TaxonomyItem, TaxonomyKind } from "@/lib/api/content-types";
import { isPendingReview } from "@/lib/content";

/** Pestaña de traducción (es/en) de un destino o categoría. */
export function TaxonomyTranslationPanel({ kind, item, locale, canWrite }: { kind: TaxonomyKind; item: TaxonomyItem; locale: ContentLocale; canWrite: boolean }) {
  const t = item.translations.find((x) => x.locale === locale);
  const isEn = locale !== "es";
  const language = locale === "pt" ? "portugués (Brasil)" : "inglés";

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm text-foreground-muted">Estado:</span>
        <TranslationStatusBadge status={t ? t.translationStatus : undefined} />
        {t && canWrite && isPendingReview(t.translationStatus) ? (
          <ActionForm action={markTaxonomyReviewedAction.bind(null, kind, item.id, item.version, t)} className="space-y-0">
            <SubmitButton variant="secondary" size="sm" pendingLabel="Guardando…">
              Marcar como revisada
            </SubmitButton>
          </ActionForm>
        ) : null}
      </div>
      {isEn && !t ? <Alert tone="info">Aún no hay versión en {language}: en el sitio en {language} se muestra el texto en español. Completa el formulario para crearla.</Alert> : null}

      <ActionForm action={saveTaxonomyTranslationAction.bind(null, kind, item.id, item.version, locale)} className="space-y-4">
        <fieldset disabled={!canWrite} className="space-y-4">
          <div className="grid gap-3 md:grid-cols-2">
            <Field label={isEn ? `Nombre (${language})` : "Nombre"} name="name" required>
              <input className="field-input" maxLength={160} defaultValue={t?.name ?? ""} lang={locale} />
            </Field>
            {isEn ? (
              <Field label={`Slug en ${language}`} name="slug" hint="Opcional. Vacío = se usa el slug en español.">
                <input className="field-input font-mono" maxLength={160} defaultValue={t?.slug ?? ""} autoComplete="off" />
              </Field>
            ) : null}
          </div>
          <Field label="Descripción" name="description">
            <textarea className="field-input" rows={6} maxLength={20000} defaultValue={t?.description ?? ""} lang={locale} />
          </Field>
          {kind === "destination" ? (
            <div className="grid gap-3 md:grid-cols-2">
              <Field label="Título SEO" name="seoTitle" hint="Máx. 70.">
                <input className="field-input" maxLength={70} defaultValue={t?.seoTitle ?? ""} lang={locale} />
              </Field>
              <Field label="Descripción SEO" name="seoDescription" hint="Máx. 170.">
                <input className="field-input" maxLength={170} defaultValue={t?.seoDescription ?? ""} lang={locale} />
              </Field>
            </div>
          ) : null}
          <div className="max-w-md">
            <TranslationStatusSelect defaultValue={t?.translationStatus} />
          </div>
        </fieldset>
        {canWrite ? (
          <SubmitButton variant="secondary" pendingLabel="Guardando…">
            Guardar traducción
          </SubmitButton>
        ) : null}
      </ActionForm>

      {isEn && t && canWrite ? (
        <ActionForm
          action={deleteTaxonomyTranslationAction.bind(null, kind, item.id, item.version, locale)}
          confirm={`¿Eliminar la traducción a ${language}? El sitio mostrará el texto en español.`}
          className="border-t border-border pt-4"
        >
          <SubmitButton variant="danger" size="sm" pendingLabel="Eliminando…">
            Eliminar traducción a {language}
          </SubmitButton>
        </ActionForm>
      ) : null}
    </div>
  );
}
