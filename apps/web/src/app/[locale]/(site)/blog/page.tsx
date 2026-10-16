import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { Breadcrumbs } from "@/components/layout/Breadcrumbs";
import { localePath } from "@/i18n/paths";
import type { Locale } from "@/i18n/routing";
import { getBlogPosts } from "@/lib/content/blog";
import { isJournalTopic, journalTopic, JOURNAL_TOPICS } from "@/lib/content/journal-topics";
import { whatsappHref } from "@/lib/site";
import { formatDate } from "@/lib/format";
import { alternatesFor, pageMetadata } from "@/lib/seo/metadata";

/** ISR: el blog cambia poco; la API invalida con la etiqueta `content`. */
export const revalidate = 3600;

export async function generateMetadata({ params }: PageProps<"/[locale]/blog">): Promise<Metadata> {
  const locale = (await params).locale as Locale;
  const t = await getTranslations({ locale, namespace: "blog" });
  return pageMetadata({ locale, title: t("title"), description: t("description"), paths: alternatesFor("/blog") });
}

/** Índice del blog (F1): tarjetas por fecha de publicación, en el idioma de la página. */
export default async function BlogIndexPage({ params, searchParams }: PageProps<"/[locale]/blog">) {
  const locale = (await params).locale as Locale;
  setRequestLocale(locale);
  const [allPosts, t, tc, tj, query] = await Promise.all([getBlogPosts(locale), getTranslations("blog"), getTranslations("common"), getTranslations("journal"), searchParams]);
  const topic = isJournalTopic(query.tema) ? query.tema : null;
  const posts = topic ? allPosts.filter(post => journalTopic(post.tags) === topic) : allPosts;
  const blogPath = localePath(locale, "/blog");

  return (
    <div className="pwt-container pt-8 pb-20">
      <Breadcrumbs
        items={[
          { name: tc("home"), path: localePath(locale, "/") },
          { name: t("title"), path: localePath(locale, "/blog") },
        ]}
      />
      <h1 className="mt-4 font-display text-h1 font-medium">{t("title")}</h1>
      <p className="mt-3 max-w-2xl text-body-lg text-foreground-muted">{t("description")}</p>
      <nav aria-label={tj("title")} className="mt-6 flex flex-wrap gap-2">
        <Link href={blogPath} aria-current={!topic ? "page" : undefined} className="inline-flex min-h-11 items-center rounded-pill border border-border px-4 text-sm aria-[current=page]:bg-primary aria-[current=page]:text-on-primary">{tj("all")}</Link>
        {JOURNAL_TOPICS.map(value => <Link key={value} href={`${blogPath}?tema=${value}`} aria-current={topic === value ? "page" : undefined} className="inline-flex min-h-11 items-center rounded-pill border border-border px-4 text-sm aria-[current=page]:bg-primary aria-[current=page]:text-on-primary">{tj(`${value}.title`)}</Link>)}
      </nav>
      {posts.length ? (
        <ul className="mt-10 grid gap-6 md:grid-cols-2 lg:grid-cols-3" data-reveal-stagger>
          {posts.map((post) => (
            <li key={post.key}>
              <article
                lang={post.fallback ? "es-PE" : undefined}
                className="group relative flex h-full flex-col overflow-hidden rounded-lg border border-border bg-surface shadow-sm transition-shadow duration-300 hover:shadow-lg has-[a:focus-visible]:outline-2 has-[a:focus-visible]:outline-offset-2 has-[a:focus-visible]:outline-ring"
              >
                <div className="relative aspect-[16/10] overflow-hidden bg-surface-muted">
                  {post.image ? (
                    <Image
                      src={post.image.src}
                      alt={post.image.alt}
                      fill
                      sizes="(min-width: 1024px) 33vw, (min-width: 768px) 50vw, 100vw"
                      className="object-cover transition-transform duration-[900ms] ease-out group-hover:scale-[1.04] motion-reduce:transition-none"
                    />
                  ) : null}
                </div>
                <div className="flex flex-1 flex-col p-5">
                  {post.publishedAt ? (
                    <p className="text-sm text-foreground-muted">
                      <time dateTime={post.publishedAt}>{formatDate(post.publishedAt.slice(0, 10), locale)}</time>
                    </p>
                  ) : null}
                  <h2 className="mt-2 text-h4 font-medium">
                    <Link href={post.path} className="after:absolute after:inset-0 focus-visible:outline-none">
                      {post.title}
                    </Link>
                  </h2>
                  {post.excerpt ? <p className="mt-2 line-clamp-3 flex-1 text-foreground-muted">{post.excerpt}</p> : null}
                  <span aria-hidden className="mt-4 text-sm font-medium text-primary">
                    {t("readMore")}
                  </span>
                </div>
              </article>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-10 rounded-lg border border-dashed border-border-strong p-6 text-foreground-muted">{topic ? tj("empty") : t("empty")}</p>
      )}
      {topic === "historias" ? <aside className="mt-10 rounded-lg border border-border bg-surface-muted p-6"><h2 className="text-h3 font-medium">{tj("shareTitle")}</h2><p className="mt-3 max-w-2xl text-foreground-muted">{tj("shareText")}</p><a href={whatsappHref(tj("shareMessage"))} target="_blank" rel="noopener noreferrer" className="pwt-link mt-4 inline-flex min-h-11 items-center">{tj("shareButton")}</a></aside> : null}
    </div>
  );
}
