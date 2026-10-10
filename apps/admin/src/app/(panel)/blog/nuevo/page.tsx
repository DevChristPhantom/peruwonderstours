import type { Metadata } from "next";

import { BlogTranslationFields } from "@/components/blog/BlogTranslationFields";
import { ActionForm, SubmitButton } from "@/components/forms/ActionForm";
import { Field } from "@/components/forms/Field";
import { ImageUploader } from "@/components/media/ImageUploader";
import { Alert } from "@/components/ui/Alert";
import { PageHeader, Section } from "@/components/ui/Layout";
import { can, requireSession } from "@/lib/auth/guard";

import { createBlogPostAction } from "../actions";

export const metadata: Metadata = { title: "Nuevo artículo" };

/** Alta de un artículo en borrador con su texto en español. */
export default async function NewBlogPostPage() {
  const session = await requireSession();
  const back = { href: "/blog", label: "Blog" };
  if (!can(session, "content:write")) {
    return (
      <>
        <PageHeader title="Nuevo artículo" back={back} />
        <Alert tone="warning" title="Sin permiso">
          Tu rol puede ver el blog pero no crear artículos.
        </Alert>
      </>
    );
  }
  return (
    <>
      <PageHeader title="Nuevo artículo" back={back} description="Se crea como borrador. La versión en inglés y la publicación se hacen después." />
      <Section>
        <ActionForm action={createBlogPostAction} refresh={false} className="space-y-4">
          <BlogTranslationFields locale="es" />
          <Field label="Etiquetas" name="tags" hint="Separadas por coma: cusco, trekking, gastronomía. Máx. 20.">
            <input className="field-input" maxLength={1300} />
          </Field>
          <ImageUploader name="coverStorageKey" folder="blog" canUpload={can(session, "media:upload")} />
          <SubmitButton variant="primary" pendingLabel="Creando…">
            Crear borrador
          </SubmitButton>
        </ActionForm>
      </Section>
    </>
  );
}
