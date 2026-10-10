import { changeBlogStatusAction } from "@/app/(panel)/blog/actions";
import { ActionForm, SubmitButton } from "@/components/forms/ActionForm";
import type { BlogPost } from "@/lib/api/content-types";

/** Publicar / despublicar / archivar (permiso `content:publish`). Archivar pide confirmación. */
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
        confirm="¿Archivar el artículo? Saldrá del blog y de la lista de activos. Esta acción no se deshace desde el panel."
      >
        <SubmitButton variant="danger" pendingLabel="Archivando…">
          Archivar
        </SubmitButton>
      </ActionForm>
    </div>
  );
}
