import { Field } from "@/components/forms/Field";
import type { PromotionTranslation } from "@/lib/api/content-types";

/** Textos del evento en un idioma (formulario sin estado: lo envía ActionForm). */
export function PromotionTextFields({ locale, translation }: { locale: "es" | "en" | "pt"; translation?: PromotionTranslation }) {
  const t = translation;
  return (
    <div className="space-y-4">
      <div className="grid gap-3 md:grid-cols-[2fr_1fr]">
        <Field label="Título" name="title" required hint="Ej.: Festividad de la Virgen de la Candelaria 2027. Máx. 120.">
          <input className="field-input" maxLength={120} defaultValue={t?.title ?? ""} lang={locale} />
        </Field>
        <Field label="Línea superior" name="eyebrow" hint="Lugar y época, p. ej. «Puno · febrero». Opcional.">
          <input className="field-input" maxLength={80} defaultValue={t?.eyebrow ?? ""} lang={locale} />
        </Field>
      </div>
      <Field label="Descripción corta" name="summary" required hint="Qué es el evento y por qué viajar. 20 a 400 caracteres: se lee en la portada y en el anuncio.">
        <textarea className="field-input" rows={4} minLength={20} maxLength={400} defaultValue={t?.summary ?? ""} lang={locale} />
      </Field>
      <div className="grid gap-3 md:grid-cols-2">
        <Field label="Texto del botón" name="ctaLabel" hint="Opcional. Vacío = «Ver el paquete», «Ver más» o «Cotizar por WhatsApp» según el botón.">
          <input className="field-input" maxLength={60} defaultValue={t?.ctaLabel ?? ""} lang={locale} />
        </Field>
        <Field label="Mensaje de WhatsApp" name="whatsappMessage" hint="Solo si el botón abre WhatsApp. Vacío = el título del evento.">
          <input className="field-input" maxLength={300} defaultValue={t?.whatsappMessage ?? ""} lang={locale} placeholder="Hola, quiero el paquete para la Candelaria 2027." />
        </Field>
      </div>
    </div>
  );
}
