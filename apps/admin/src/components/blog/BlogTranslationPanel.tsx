import { deleteBlogTranslationAction, markBlogReviewedAction, saveBlogTranslationAction } from "@/app/(panel)/blog/actions";
import { TranslationStatusBadge, TranslationStatusSelect } from "@/components/content/TranslationStatus";
import { ActionForm, SubmitButton } from "@/components/forms/ActionForm";
import { Alert } from "@/components/ui/Alert";
import type { BlogPost } from "@/lib/api/content-types";
import { isPendingReview } from "@/lib/content";

import { BlogTranslationFields } from "./BlogTranslationFields";

/** Pestaña de traducción (es/en) del artículo con su estado de revisión. */
export function BlogTranslationPanel({ post, locale, canWrite }: { post: BlogPost; locale: "es" | "en"; canWrite: boolean }) {
  const t = post.translations.find((x) => x.locale === locale);
  const isEn = locale === "en";
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm text-foreground-muted">Estado:</span>
        <TranslationStatusBadge status={t ? t.translationStatus : undefined} />
        {t && canWrite && isPendingReview(t.translationStatus) ? (
          <ActionForm action={markBlogReviewedAction.bind(null, post.id, post.version, t)}>
            <SubmitButton variant="secondary" size="sm" pendingLabel="Guardando…">
              Marcar como revisada
            </SubmitButton>
          </ActionForm>
        ) : null}
      </div>
      {isEn && !t ? <Alert tone="info">Aún no hay versión en inglés: el blog en inglés muestra el texto en español. Completa el formulario para crearla.</Alert> : null}

      <ActionForm action={saveBlogTranslationAction.bind(null, post.id, post.version, locale)} className="space-y-4">
        <fieldset disabled={!canWrite} className="space-y-4">
          <BlogTranslationFields t={t} locale={locale} />
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
          action={deleteBlogTranslationAction.bind(null, post.id, post.version)}
          confirm="¿Eliminar la traducción al inglés? El blog en inglés mostrará el texto en español."
          className="border-t border-border pt-4"
        >
          <SubmitButton variant="danger" size="sm" pendingLabel="Eliminando…">
            Eliminar traducción al inglés
          </SubmitButton>
        </ActionForm>
      ) : null}
    </div>
  );
}
