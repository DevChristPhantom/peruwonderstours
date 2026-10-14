import "server-only";

import type { Locale } from "@/i18n/routing";

import { apiJson, apiRequest, ApiError } from "./client";
import { contactPayload, testimonialPayload } from '../content/form-payloads';

/**
 * ADAPTADOR AISLADO del contenido editorial (sprint 3): blog (F1), testimonios (F2) y contacto (F3).
 * Contrato del backend (apps/api, módulo `content`): ajustar SOLO aquí si cambian los nombres.
 * - `GET /blog?locale&page&pageSize` → `{ data: BlogCard[], meta }`; `GET /blog/:slug?locale` → `{ data: BlogPost }`
 *   (acepta el slug de cualquier idioma; trae `locale`, `fallback` y `alternateLocales`).
 * - `GET /testimonials?locale&page&pageSize` → aprobados con consentimiento; `POST /testimonials` → 201/202.
 * - `POST /contact` → 201/202.
 */

const REVALIDATE = 3600;
const CONTENT_TAG = "content";

export interface ApiBlogCard {
  id: string;
  slug: string;
  title: string;
  excerpt: string | null;
  coverUrl: string | null;
  coverAlt: string | null;
  publishedAt: string | null;
  tags: string[];
  author?: string | null;
  locale?: Locale;
  fallback?: boolean;
  alternateLocales?: { locale: Locale; slug: string }[];
}

export interface ApiBlogPost extends ApiBlogCard {
  body: string;
  seoTitle: string | null;
  seoDescription: string | null;
  alternateLocales?: { locale: Locale; slug: string }[];
}

interface RawBlog {
  id?: string;
  slug: string;
  title: string;
  excerpt?: string | null;
  summary?: string | null;
  coverUrl?: string | null;
  coverImage?: { url: string; alt?: string | null } | null;
  image?: string | null;
  coverAlt?: string | null;
  imageAlt?: string | null;
  publishedAt?: string | null;
  date?: string | null;
  tags?: string[];
  author?: string | null;
  locale?: Locale;
  fallback?: boolean;
  body?: string;
  seoTitle?: string | null;
  seoDescription?: string | null;
  seo?: { title?: string | null; description?: string | null };
  alternateLocales?: { locale: Locale; slug: string }[];
}

function toCard(raw: RawBlog): ApiBlogCard {
  return {
    id: raw.id ?? raw.slug,
    slug: raw.slug,
    title: raw.title,
    excerpt: raw.excerpt ?? raw.summary ?? null,
    coverUrl: raw.coverUrl ?? raw.coverImage?.url ?? raw.image ?? null,
    coverAlt: raw.coverAlt ?? raw.coverImage?.alt ?? raw.imageAlt ?? null,
    publishedAt: raw.publishedAt ?? raw.date ?? null,
    tags: raw.tags ?? [],
    author: raw.author ?? null,
    locale: raw.locale,
    fallback: raw.fallback,
    alternateLocales: raw.alternateLocales,
  };
}

export async function listBlogPosts(locale: Locale): Promise<ApiBlogCard[]> {
  const res = await apiJson<{ data: RawBlog[] }>(`/blog?locale=${locale}&pageSize=50`, { next: { revalidate: REVALIDATE, tags: [CONTENT_TAG] } });
  return res.data.map(toCard);
}

export async function getBlogPost(slug: string, locale: Locale): Promise<ApiBlogPost | null> {
  const res = await apiRequest<{ data: RawBlog }>(`/blog/${encodeURIComponent(slug)}?locale=${locale}`, {
    next: { revalidate: REVALIDATE, tags: [CONTENT_TAG] },
    nullOn404: true,
  });
  if (!res) return null;
  const raw = res.body.data;
  return {
    ...toCard(raw),
    body: raw.body ?? "",
    seoTitle: raw.seoTitle ?? raw.seo?.title ?? null,
    seoDescription: raw.seoDescription ?? raw.seo?.description ?? null,
    alternateLocales: raw.alternateLocales,
  };
}

/* ---------- Testimonios ---------- */

export interface ApiTestimonial {
  id: string;
  authorName: string;
  authorCountry: string | null;
  rating: number;
  body: string;
  locale: Locale;
  travelDate: string | null;
  tourTitle: string | null;
  isFeatured: boolean;
}

export async function listTestimonials(locale: Locale, pageSize = 24): Promise<ApiTestimonial[]> {
  const res = await apiJson<{ data: (Partial<ApiTestimonial> & { id: string; authorName: string; body: string; tour?: { title?: string } | null })[] }>(
    `/testimonials?locale=${locale}&pageSize=${pageSize}`,
    { next: { revalidate: REVALIDATE, tags: [CONTENT_TAG, "testimonials"] } },
  );
  return res.data.map((t) => ({
    id: t.id,
    authorName: t.authorName,
    authorCountry: t.authorCountry ?? null,
    rating: t.rating ?? 5,
    body: t.body,
    locale: t.locale ?? locale,
    travelDate: t.travelDate ?? null,
    tourTitle: t.tourTitle ?? t.tour?.title ?? null,
    isFeatured: !!t.isFeatured,
  }));
}

/** Testimonios aprobados o lista vacía si la API no responde (la sección se oculta). */
export async function listTestimonialsSafe(locale: Locale, pageSize?: number): Promise<ApiTestimonial[]> {
  try {
    return await listTestimonials(locale, pageSize);
  } catch (error) {
    if (error instanceof ApiError) return [];
    throw error;
  }
}

export interface TestimonialInput {
  authorName: string;
  authorCountry: string | null;
  email: string;
  rating: number;
  body: string;
  tourSlug: string | null;
  travelDate: string | null;
  locale: Locale;
  publishConsent: true;
  privacyNoticeVersion: string;
}

export async function submitTestimonial(input: TestimonialInput): Promise<void> {
  await apiRequest("/testimonials", { method: "POST", body: testimonialPayload(input) });
}

/* ---------- Contacto ---------- */

export interface ContactInput {
  name: string;
  email: string;
  phone: string | null;
  subject: string;
  message: string;
  tourSlug: string | null;
  locale: Locale;
  privacyNoticeVersion: string;
}

export async function submitContact(input: ContactInput): Promise<void> {
  await apiRequest("/contact", { method: "POST", body: contactPayload(input) });
}

/** Versión del aviso de privacidad que se muestra en los formularios (se guarda con cada envío). */
export const PRIVACY_NOTICE_VERSION = "2026-10-09";
