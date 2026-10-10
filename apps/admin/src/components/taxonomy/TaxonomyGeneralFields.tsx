import { Field } from "@/components/forms/Field";
import { ImageUploader, type ImageValue } from "@/components/media/ImageUploader";
import type { TaxonomyItem, TaxonomyKind } from "@/lib/api/content-types";
import { TAXONOMY } from "@/lib/taxonomy";

/**
 * Campos generales de un destino o categoría (slug canónico, orden, portada y, solo en destinos,
 * estado y destino padre). Se usan en "nuevo" y en la pestaña "General" del detalle.
 */
export function TaxonomyGeneralFields({
  kind,
  item,
  parents,
  cover,
  canUpload,
}: {
  kind: TaxonomyKind;
  item?: TaxonomyItem;
  /** Destinos que pueden ser padre (sin el propio). */
  parents: { id: string; name: string }[];
  cover: ImageValue | null;
  canUpload: boolean;
}) {
  return (
    <>
      <div className="grid gap-3 md:grid-cols-3">
        <Field label="Slug (URL en español)" name="slug" hint="Minúsculas y guiones: cusco, valle-sagrado." required className="md:col-span-2">
          <input className="field-input font-mono" maxLength={120} defaultValue={item?.slug ?? ""} autoComplete="off" />
        </Field>
        <Field label="Orden" name="sortOrder" hint="Menor = aparece antes.">
          <input type="number" min={0} max={10000} step={1} className="field-input" defaultValue={item?.sortOrder ?? 0} />
        </Field>
        {kind === "destination" ? (
          <>
            <Field label="Estado" name="status" hint="Los borradores no se ven en el sitio.">
              <select className="field-input" defaultValue={item?.status ?? "draft"}>
                <option value="draft">Borrador</option>
                <option value="published">Publicado</option>
              </select>
            </Field>
            <Field label="Destino padre" name="parentId" hint="Opcional: p. ej. Valle Sagrado dentro de Cusco." className="md:col-span-2">
              <select className="field-input" defaultValue={item?.parentId ?? ""}>
                <option value="">Ninguno</option>
                {parents.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </Field>
          </>
        ) : null}
      </div>
      <ImageUploader name="coverStorageKey" folder={TAXONOMY[kind].folder} initial={cover} canUpload={canUpload} />
    </>
  );
}
