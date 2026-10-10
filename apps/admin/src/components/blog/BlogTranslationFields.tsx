import { Field } from "@/components/forms/Field";
import type { BlogTranslation } from "@/lib/api/content-types";

/** Campos de una traducción del artículo (es o en). Sin hooks: sirve en Server Components. */
export function BlogTranslationFields({ t, locale }: { t?: BlogTranslation; locale: "es" | "en" }) {
  return (
    <>
      <div className="grid gap-3 md:grid-cols-2">
        <Field label="Título" name="title" required>
          <input className="field-input" maxLength={200} defaultValue={t?.title ?? ""} lang={locale} />
        </Field>
        <Field label="Slug (URL)" name="slug" hint="Minúsculas y guiones, sin tildes: guia-machu-picchu." required>
          <input className="field-input font-mono" maxLength={160} defaultValue={t?.slug ?? ""} autoComplete="off" />
        </Field>
      </div>
      <Field label="Extracto" name="excerpt" hint="Resumen corto para listados y redes. Máx. 400.">
        <textarea className="field-input" rows={2} maxLength={400} defaultValue={t?.excerpt ?? ""} lang={locale} />
      </Field>
      <Field label="Cuerpo" name="body" hint="Markdown o HTML simple. El sitio lo sanea al mostrarlo. Para publicar: mínimo 50 caracteres en español." required>
        <textarea className="field-input font-mono text-sm" rows={18} maxLength={200000} defaultValue={t?.body ?? ""} lang={locale} />
      </Field>
      <div className="grid gap-3 md:grid-cols-2">
        <Field label="Título SEO" name="seoTitle" hint="Máx. 70.">
          <input className="field-input" maxLength={70} defaultValue={t?.seoTitle ?? ""} lang={locale} />
        </Field>
        <Field label="Descripción SEO" name="seoDescription" hint="Máx. 170.">
          <input className="field-input" maxLength={170} defaultValue={t?.seoDescription ?? ""} lang={locale} />
        </Field>
      </div>
    </>
  );
}
