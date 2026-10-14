import { updateTestimonialAction } from "@/app/(panel)/testimonios/actions";
import { ActionForm, SubmitButton } from "@/components/forms/ActionForm";
import { buttonClass } from "@/components/ui/styles";
import type { Testimonial } from "@/lib/api/content-types";

/** Corrección del texto (ortografía, recorte). Sin URLs ni HTML: la API lo rechaza. Ids únicos por tarjeta. */
export function TestimonialEditForm({ t }: { t: Testimonial }) {
  const id = (f: string) => `t-${t.id}-${f}`;
  return (
    <details>
      <summary className={buttonClass("outline", "sm", "list-none")}>Editar</summary>
      <ActionForm action={updateTestimonialAction.bind(null, t.id)} className="mt-3 space-y-3 rounded-sm border border-border p-3">
        <div className="grid gap-3 sm:grid-cols-[2fr_1fr_1fr_1fr]">
          <div className="space-y-1">
            <label htmlFor={id("author")} className="block text-sm font-medium">
              Autor
            </label>
            <input id={id("author")} name="authorName" required minLength={2} maxLength={120} defaultValue={t.authorName} className="field-input" />
          </div>
          <div className="space-y-1">
            <label htmlFor={id("country")} className="block text-sm font-medium">
              País (2 letras)
            </label>
            <input id={id("country")} name="authorCountry" maxLength={2} defaultValue={t.authorCountry ?? ""} className="field-input uppercase" />
          </div>
          <div className="space-y-1">
            <label htmlFor={id("rating")} className="block text-sm font-medium">
              Estrellas
            </label>
            <select id={id("rating")} name="rating" defaultValue={String(t.rating)} className="field-input">
              {[5, 4, 3, 2, 1].map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <label htmlFor={id("locale")} className="block text-sm font-medium">
              Idioma
            </label>
            <select id={id("locale")} name="locale" defaultValue={t.locale} className="field-input">
              <option value="es">Español</option>
              <option value="en">Inglés</option>
              <option value="pt">Português (Brasil)</option>
            </select>
          </div>
        </div>
        <div className="space-y-1">
          <label htmlFor={id("body")} className="block text-sm font-medium">
            Texto
          </label>
          <textarea id={id("body")} name="body" required minLength={20} maxLength={3000} rows={5} defaultValue={t.body} className="field-input" />
        </div>
        <SubmitButton variant="secondary" size="sm" pendingLabel="Guardando…">
          Guardar cambios
        </SubmitButton>
      </ActionForm>
    </details>
  );
}
