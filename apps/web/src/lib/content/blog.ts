import "server-only";

import blogEsJson from "@seed/blog-posts.json";
import blogEnJson from "@seed/en/blog-posts.json";
import slugMapJson from "@seed/en/_slug-map.json";
import { cache } from "react";

import { blogPostPath } from "@/i18n/paths";
import type { Locale } from "@/i18n/routing";
import { ApiError } from "@/lib/api/client";
import { getBlogPost, listBlogPosts, type ApiBlogCard } from "@/lib/api/content";
import type { LocalePaths } from "@/lib/catalog/types";
import { env } from "@/lib/env";

/**
 * Blog (F1) por idioma. Fuente: API `GET /blog` (ISR, tag `content`); si la API no responde o
 * `CATALOG_SOURCE=seed`, se usa `data/seed/blog-posts.json` y `data/seed/en/blog-posts.json` (los mismos
 * textos con los que se cargó la BD). La clave estable de cada post es su slug en español.
 */

export interface BlogCard {
  key: string;
  slug: string;
  path: string;
  alternates: LocalePaths;
  fallback: boolean;
  title: string;
  excerpt: string;
  image: { src: string; alt: string } | null;
  publishedAt: string | null;
  author: string | null;
  tags: string[];
}

export interface BlogPost extends BlogCard {
  body: string;
  metaTitle: string;
  metaDescription: string;
}

interface SeedPost {
  slug: string;
  title: string;
  date: string | null;
  summary: string | null;
  originalUrl?: string;
  image: string | null;
  imageAlt: string | null;
  author: string | null;
  tags: string[] | null;
  body: string | null;
}

const esPosts = blogEsJson as unknown as SeedPost[];
const enByKey = new Map(
  (blogEnJson as unknown as SeedPost[]).map((p) => [p.originalUrl?.split("/").filter(Boolean).pop() ?? p.slug, p]),
);
const slugMap = (slugMapJson as unknown as { blog: Record<string, string> }).blog ?? {};

/** El autor del sitio viejo es la marca anterior: se muestra la agencia actual. */
const AUTHOR = null;

function seedAlternates(key: string): LocalePaths {
  return { es: blogPostPath("es", key), en: blogPostPath("en", slugMap[key] ?? enByKey.get(key)?.slug ?? key) };
}

function seedPost(p: SeedPost, locale: Locale): BlogPost {
  const en = locale === "en" ? enByKey.get(p.slug) : undefined;
  const text = en ?? p;
  const alternates = seedAlternates(p.slug);
  return {
    key: p.slug,
    slug: alternates[locale].split("/").pop()!,
    path: alternates[locale],
    alternates,
    fallback: locale !== "es" && !en,
    title: text.title,
    excerpt: text.summary ?? "",
    image: p.image ? { src: p.image, alt: text.imageAlt ?? text.title } : null,
    publishedAt: p.date,
    author: AUTHOR,
    tags: text.tags ?? [],
    body: text.body ?? "",
    metaTitle: text.title,
    metaDescription: (text.summary ?? "").slice(0, 160),
  };
}

function seedList(locale: Locale): BlogCard[] {
  return esPosts
    .map((p) => seedPost(p, locale))
    .sort((a, b) => (b.publishedAt ?? "").localeCompare(a.publishedAt ?? ""));
}

function fromApiCard(card: ApiBlogCard, locale: Locale, esCard: ApiBlogCard | undefined): BlogCard {
  const key = esCard?.slug ?? card.slug;
  const fallback = locale !== "es" && (card.fallback ?? (card.locale !== undefined && card.locale !== locale));
  const enSlug = locale === "en" && !fallback ? card.slug : (slugMap[key] ?? key);
  const alternates = { es: blogPostPath("es", key), en: blogPostPath("en", enSlug) };
  return {
    key,
    slug: alternates[locale].split("/").pop()!,
    path: alternates[locale],
    alternates,
    fallback,
    title: card.title,
    excerpt: card.excerpt ?? "",
    image: card.coverUrl ? { src: card.coverUrl, alt: card.coverAlt ?? card.title } : null,
    publishedAt: card.publishedAt,
    author: card.author ?? null,
    tags: card.tags,
  };
}

async function withSeed<T>(fromApi: () => Promise<T>, fromSeed: () => T): Promise<T> {
  if (env.CATALOG_SOURCE === "seed") return fromSeed();
  try {
    return await fromApi();
  } catch (error) {
    if (error instanceof ApiError && (error.unavailable || error.status === 404)) return fromSeed();
    throw error;
  }
}

export const getBlogPosts = cache((locale: Locale): Promise<BlogCard[]> =>
  withSeed(
    async () => {
      const [list, es] = await Promise.all([listBlogPosts(locale), locale === "es" ? Promise.resolve(null) : listBlogPosts("es")]);
      const esById = new Map((es ?? list).map((c) => [c.id, c]));
      return list.map((c) => fromApiCard(c, locale, esById.get(c.id)));
    },
    () => seedList(locale),
  ),
);

/** Post por slug de cualquier idioma (o la clave en español). */
export const getBlogPostBySlug = cache((slug: string, locale: Locale): Promise<BlogPost | null> =>
  withSeed(
    async () => {
      const post = await getBlogPost(slug, locale);
      if (!post) return null;
      const esSlug = post.alternateLocales?.find((a) => a.locale === "es")?.slug ?? (locale === "es" ? post.slug : undefined);
      const card = fromApiCard(post, locale, esSlug ? { ...post, slug: esSlug } : undefined);
      const enSlug = post.alternateLocales?.find((a) => a.locale === "en")?.slug;
      const alternates = enSlug && !card.fallback ? { ...card.alternates, en: blogPostPath("en", enSlug) } : card.alternates;
      return {
        ...card,
        alternates,
        path: alternates[locale],
        body: post.body,
        metaTitle: post.seoTitle ?? post.title,
        metaDescription: post.seoDescription ?? (post.excerpt ?? "").slice(0, 160),
      };
    },
    () => {
      const key =
        esPosts.find((p) => p.slug === slug)?.slug ??
        Object.entries(slugMap).find(([, en]) => en === slug)?.[0] ??
        [...enByKey].find(([, p]) => p.slug === slug)?.[0];
      const p = key ? esPosts.find((x) => x.slug === key) : undefined;
      return p ? seedPost(p, locale) : null;
    },
  ),
);
