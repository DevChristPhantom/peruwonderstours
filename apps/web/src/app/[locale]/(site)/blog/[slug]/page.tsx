import type { Metadata } from "next";
import Image from "next/image";
import { notFound, permanentRedirect } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { Breadcrumbs } from "@/components/layout/Breadcrumbs";
import { LocaleAlternates } from "@/components/layout/LanguageSwitcher";
import { buttonClass } from "@/components/ui/button-styles";
import { Link } from "@/i18n/navigation";
import { localePath } from "@/i18n/paths";
import { routing, type Locale } from "@/i18n/routing";
import { getBlogPostBySlug, getBlogPosts } from "@/lib/content/blog";
import { formatDate } from "@/lib/format";
import { Markdown, parseMarkdown } from "@/lib/legal/markdown";
import { blogPostingJsonLd, breadcrumbJsonLd, JsonLd } from "@/lib/seo/json-ld";
import { pageMetadata } from "@/lib/seo/metadata";
import { whatsappHref } from "@/lib/site";

export const revalidate = 3600;

export async function generateStaticParams() {
  const all = await Promise.all(routing.locales.map(async (locale) => (await getBlogPosts(locale)).map((p) => ({ locale, slug: p.slug }))));
  return all.flat();
}

export async function generateMetadata({ params }: PageProps<"/[locale]/blog/[slug]">): Promise<Metadata> {
  const { locale: rawLocale, slug } = await params;
  const locale = rawLocale as Locale;
  const post = await getBlogPostBySlug(slug, locale);
  if (!post) return {};
  return pageMetadata({ locale, title: post.metaTitle, description: post.metaDescription, paths: post.alternates, image: post.image?.src });
}

/** Artículo del blog (F1). Slug de otro idioma → 308 a la URL canónica del idioma de la página. */
export default async function BlogPostPage({ params }: PageProps<"/[locale]/blog/[slug]">) {
  const { locale: rawLocale, slug } = await params;
  const locale = rawLocale as Locale;
  setRequestLocale(locale);
  const post = await getBlogPostBySlug(slug, locale);
  if (!post) notFound();
  if (post.slug !== slug) permanentRedirect(post.path);
  const [t, tc] = await Promise.all([getTranslations("blog"), getTranslations("common")]);
  const crumbs = [
    { name: tc("home"), path: localePath(locale, "/") },
    { name: t("title"), path: localePath(locale, "/blog") },
    { name: post.title, path: post.path },
  ];

  return (
    <article lang={post.fallback ? "es-PE" : undefined} className="pwt-container-narrow pt-8 pb-20">
      <JsonLd
        data={[
          blogPostingJsonLd({ title: post.title, excerpt: post.excerpt, path: post.path, image: post.image?.src ?? null, publishedAt: post.publishedAt, author: post.author, fallback: post.fallback }, locale),
          breadcrumbJsonLd(crumbs),
        ]}
      />
      <LocaleAlternates value={post.alternates} />
      <Breadcrumbs items={crumbs} />
      <h1 className="mt-4 font-display text-h1 font-medium">{post.title}</h1>
      {post.publishedAt ? (
        <p className="mt-3 text-sm text-foreground-muted">
          {t("publishedOn", { date: formatDate(post.publishedAt.slice(0, 10), locale) })}
        </p>
      ) : null}
      {post.fallback ? <p className="mt-3 text-sm text-foreground-muted italic">{tc("fallbackNotice")}</p> : null}
      {post.image ? (
        <div className="relative mt-6 aspect-[16/9] overflow-hidden rounded-lg bg-surface-muted">
          <Image src={post.image.src} alt={post.image.alt} fill priority sizes="(min-width: 768px) 720px, 100vw" className="object-cover" />
        </div>
      ) : null}
      <div className="mt-8 text-body">
        <Markdown blocks={parseMarkdown(post.body)} />
      </div>
      <aside className="mt-12 rounded-lg bg-surface-muted p-6">
        <h2 className="text-h3 font-medium">{t("cta")}</h2>
        <p className="mt-2 text-foreground-muted">{t("ctaText")}</p>
        <div className="mt-5 flex flex-wrap gap-3">
          <a href={whatsappHref(t("ctaMessage"))} target="_blank" rel="noopener noreferrer" className={buttonClass("primary", "lg")}>
            {t("ctaButton")}
          </a>
          <Link href="/tours" className={buttonClass("secondary", "lg")}>
            {tc("viewAllTours")}
          </Link>
        </div>
      </aside>
      <p className="mt-8">
        <Link href="/blog" className="pwt-link inline-flex min-h-11 items-center">
          {t("backToBlog")}
        </Link>
      </p>
    </article>
  );
}
