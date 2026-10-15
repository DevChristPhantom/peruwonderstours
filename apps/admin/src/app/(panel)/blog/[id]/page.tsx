import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { BlogStatusActions } from "@/components/blog/BlogStatusActions";
import { BlogTranslationPanel } from "@/components/blog/BlogTranslationPanel";
import { TranslationStatusBadge } from "@/components/content/TranslationStatus";
import { ActionForm, SubmitButton } from "@/components/forms/ActionForm";
import { Field } from "@/components/forms/Field";
import { ImageUploader } from "@/components/media/ImageUploader";
import { Badge } from "@/components/ui/Badge";
import { ErrorPanel } from "@/components/ui/ErrorPanel";
import { PageHeader, Section } from "@/components/ui/Layout";
import { TabLinks } from "@/components/ui/TabLinks";
import { apiData } from "@/lib/api/client";
import type { BlogPost } from "@/lib/api/content-types";
import { can, load, requireSession } from "@/lib/auth/guard";
import { BLOG_STATUS } from "@/lib/content";
import { formatDateTime } from "@/lib/format";
import { mediaUrl } from "@/lib/media";

import { updateBlogPostAction } from "../actions";

export const metadata: Metadata = { title: "Editar artículo" };

export default async function BlogPostPage({ params, searchParams }: PageProps<"/blog/[id]">) {
  const session = await requireSession();
  const [{ id }, sp] = await Promise.all([params, searchParams]);
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const back = { href: "/blog", label: "Blog" };
  const result = await load(() => apiData<BlogPost>(`/admin/blog-posts/${id}`));
  if (!result.ok) {
    return (
      <>
        <PageHeader title="Artículo" back={back} />
        <ErrorPanel error={result.error} />
      </>
    );
  }
  const post = result.data;
  const archived = post.status === "archived";
  const canWrite = can(session, "content:write") && !archived;
  const es = post.translations.find((t) => t.locale === "es");
  const en = post.translations.find((t) => t.locale === "en");
  const pt = post.translations.find((t) => t.locale === "pt");
  const tab = sp.pestana === "es" || sp.pestana === "en" || sp.pestana === "pt" ? sp.pestana : "general";
  const st = BLOG_STATUS[post.status] ?? { label: post.status, tone: "neutral" as const };
  const base = `/blog/${post.id}`;

  return (
    <>
      <PageHeader
        title={es?.title ?? "(sin título)"}
        back={back}
        description={`Versión ${post.version} · editado ${formatDateTime(post.updatedAt)}${post.publishedAt ? ` · publicado ${formatDateTime(post.publishedAt)}` : ""}`}
        meta={<Badge tone={st.tone}>{st.label}</Badge>}
        actions={can(session, "content:publish") ? <BlogStatusActions post={post} /> : null}
      />
      <TabLinks
        label="Secciones del artículo"
        active={tab}
        tabs={[
          { key: "general", href: base, label: "General" },
          { key: "es", href: `${base}?pestana=es`, label: "Español" },
          { key: "pt", href: `${base}?pestana=pt`, label: <>Português (Brasil) <TranslationStatusBadge status={pt ? pt.translationStatus : undefined} /></> },

          {
            key: "en",
            href: `${base}?pestana=en`,
            label: (
              <>
                Inglés <TranslationStatusBadge status={en ? en.translationStatus : undefined} />
              </>
            ),
          },
        ]}
      />
      {tab === "general" ? (
        <Section title="Portada y etiquetas">
          <ActionForm action={updateBlogPostAction.bind(null, post.id, post.version)} className="space-y-4">
            <fieldset disabled={!canWrite} className="space-y-4">
              <Field label="Etiquetas" name="tags" hint="Categoría del diario: historias, leyendas o guias; luego destinos separados por coma. Relatos de viajeros: autorización previa. Máx. 20.">
                <input className="field-input" maxLength={1300} defaultValue={post.tags.join(", ")} />
              </Field>
              <ImageUploader
                name="coverStorageKey"
                folder="blog"
                initial={post.coverStorageKey ? { storageKey: post.coverStorageKey, url: mediaUrl(post.coverStorageKey) } : null}
                canUpload={can(session, "media:upload")}
              />
            </fieldset>
            {canWrite ? (
              <SubmitButton variant="secondary" pendingLabel="Guardando…">
                Guardar cambios
              </SubmitButton>
            ) : null}
          </ActionForm>
        </Section>
      ) : (
        <Section title={tab === "es" ? "Texto en español" : tab === "pt" ? "Texto en portugués (Brasil)" : "Texto en inglés"} description={tab === "es" ? "Idioma canónico: obligatorio para publicar." : "Opcional."}>
          <BlogTranslationPanel post={post} locale={tab} canWrite={canWrite} />
        </Section>
      )}
    </>
  );
}
