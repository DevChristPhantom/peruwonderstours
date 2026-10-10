import { Badge } from "@/components/ui/Badge";
import { TRANSLATION_STATUS, TRANSLATION_STATUS_VALUES, translationBadge } from "@/lib/content";

/** Insignia del estado de una traducción (metadato del panel; no se publica en el sitio). */
export function TranslationStatusBadge({ status }: { status: string | null | undefined }) {
  const b = translationBadge(status);
  return <Badge tone={b.tone}>{b.label}</Badge>;
}

/**
 * Selector del estado de la traducción para los formularios. Vacío = "revisada por el equipo"
 * (lo que la API guarda como `null`).
 */
export function TranslationStatusSelect({ defaultValue, id = "f-translationStatus" }: { defaultValue: string | null | undefined; id?: string }) {
  return (
    <div className="space-y-1">
      <label htmlFor={id} className="block text-sm font-medium">
        Estado de la traducción
      </label>
      <select id={id} name="translationStatus" defaultValue={defaultValue ?? ""} className="field-input" aria-describedby={`${id}-ayuda`}>
        <option value="">Revisada por el equipo</option>
        {TRANSLATION_STATUS_VALUES.map((v) => (
          <option key={v} value={v}>
            {TRANSLATION_STATUS[v].label}
          </option>
        ))}
      </select>
      <p id={`${id}-ayuda`} className="text-xs text-foreground-muted">
        Solo se ve en el panel. Mientras siga «pendiente de revisión», la carga inicial puede volver a actualizarla.
      </p>
    </div>
  );
}
