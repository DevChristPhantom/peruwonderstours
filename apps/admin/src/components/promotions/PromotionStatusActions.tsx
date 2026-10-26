import { changePromotionStatusAction } from "@/app/(panel)/eventos/actions";
import { ActionForm, SubmitButton } from "@/components/forms/ActionForm";
import type { Promotion } from "@/lib/api/content-types";

/** Publicar / despublicar / eliminar (permiso `content:publish`). Eliminar pide confirmación. */
export function PromotionStatusActions({ promotion }: { promotion: Promotion }) {
  return (
    <div className="flex flex-wrap gap-2">
      {promotion.status === "published" ? (
        <ActionForm
          action={changePromotionStatusAction.bind(null, promotion.id, promotion.version, "unpublish")}
          confirm="¿Despublicar? El evento dejará de verse en la portada y en el anuncio."
        >
          <SubmitButton variant="outline" pendingLabel="Despublicando…">
            Despublicar
          </SubmitButton>
        </ActionForm>
      ) : (
        <ActionForm action={changePromotionStatusAction.bind(null, promotion.id, promotion.version, "publish")}>
          <SubmitButton variant="primary" pendingLabel="Publicando…">
            Publicar
          </SubmitButton>
        </ActionForm>
      )}
      <ActionForm
        action={changePromotionStatusAction.bind(null, promotion.id, promotion.version, "archive")}
        refresh={false}
        confirm="¿Eliminar el evento? Saldrá del sitio y de la lista. No se puede deshacer desde el panel."
      >
        <SubmitButton variant="danger" pendingLabel="Eliminando…">
          Eliminar
        </SubmitButton>
      </ActionForm>
    </div>
  );
}
