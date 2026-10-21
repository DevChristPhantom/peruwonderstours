import { changeBlogStatusAction } from "@/app/(panel)/blog/actions";
import { ActionForm, SubmitButton } from "@/components/forms/ActionForm";
import type { BlogPost } from "@/lib/api/content-types";

/** Publicar / despublicar / eliminar (archiva; permiso `content:publish`). Eliminar pide confirmación. */
export function BlogStatusActions({ post }: { post: BlogPost }) {
  if (post.status === "archived") return null;
  return (
    <div className="flex flex-wrap gap-2">
      {post.status === "published" ? (
        <ActionForm action={changeBlogStatusAction.bind(null, post.id, post.version, "unpublish")} confirm="¿Despublicar? El artículo dejará de verse en el blog y volverá a borrador.">
          <SubmitButton variant="outline" pendingLabel="Despublicando…">
            Despublicar
          </SubmitButton>
        </ActionForm>
      ) : (
        <ActionForm action={changeBlogStatusAction.bind(null, post.id, post.version, "publish")}>
          <SubmitButton variant="primary" pendingLabel="Publicando…">
            Publicar
          </SubmitButton>
        </ActionForm>
      )}
      <ActionForm
        action={changeBlogStatusAction.bind(null, post.id, post.version, "archive")}
        refresh={false}
        confirm="¿Eliminar el artículo? Saldrá del blog y de la lista (queda guardado en «Archivados»). No se puede deshacer desde el panel."
      >
        <SubmitButton variant="danger" pendingLabel="Eliminando…">
          Eliminar
        </SubmitButton>
      </ActionForm>
    </div>
  );
}
