import { ValidationError } from '../../../shared/domain/domain-error.js';
import type { ContentLocale } from '../../../shared/domain/i18n.js';

// =============================================================================
// Blog (F1)
// =============================================================================
export interface BlogPostTranslation {
  locale: ContentLocale;
  slug: string;
  title: string;
  excerpt: string | null;
  /** Markdown/HTML saneado del sitio viejo. */
  body: string;
  seoTitle: string | null;
  seoDescription: string | null;
  translationStatus: string | null;
}

export interface BlogPost {
  id: string;
  status: 'draft' | 'published' | 'archived';
  coverStorageKey: string | null;
  publishedAt: Date | null;
  tags: string[];
  translations: BlogPostTranslation[];
  createdAt: Date;
  updatedAt: Date;
}

export function isBlogPostVisible(post: BlogPost, now: Date): boolean {
  return post.status === 'published' && post.publishedAt !== null && post.publishedAt.getTime() <= now.getTime();
}

export interface BlogRepository {
  /** Publicados (publishedAt <= now) más recientes primero. */
  listPublished(params: { now: Date; page: number; pageSize: number; tag?: string }): Promise<{ items: BlogPost[]; total: number }>;
  /** Por slug de cualquier idioma (incluye borradores; el caso de uso filtra). */
  findBySlug(slug: string, preferredLocale: ContentLocale): Promise<BlogPost | null>;
}

// =============================================================================
// Testimonios (F2)
// =============================================================================
export type ModerationStatus = 'pending' | 'approved' | 'rejected';
export type TestimonialOrigin = 'web' | 'legacy_site' | 'admin';

export interface Testimonial {
  id: string;
  tourId: string | null;
  authorName: string;
  authorCountry: string | null;
  locale: ContentLocale;
  rating: number;
  body: string;
  publishConsent: boolean;
  privacyNoticeVersion: string | null;
  status: ModerationStatus;
  isFeatured: boolean;
  travelDate: string | null;
  origin: TestimonialOrigin;
  source: string | null;
  sourceUrl: string | null;
  createdAt: Date;
  approvedAt: Date | null;
}

export interface TestimonialRepository {
  insert(testimonial: Testimonial): Promise<void>;
  /** Aprobados (y con consentimiento o heredados del sitio viejo), destacados primero. */
  listApproved(params: { locale?: ContentLocale; tourId?: string; featured?: boolean; page: number; pageSize: number }): Promise<{ items: Testimonial[]; total: number }>;
}

/** Reglas del texto público: sin URLs ni HTML (spam, enlaces maliciosos, XSS almacenado). */
const URL_PATTERN = /(https?:\/\/|www\.|\b[a-z0-9-]+\.(com|net|org|pe|io|xyz|info|ru|cn|ly|me|co)\b)/i;
const HTML_PATTERN = /<\/?[a-z!][^>]*>|&[a-z]+;|&#\d+;/i;

export function assertPlainText(field: string, value: string): void {
  if (URL_PATTERN.test(value)) {
    throw new ValidationError('validation-failed', 'No se permiten enlaces ni direcciones web.', { errors: [{ field, messages: ['No se permiten enlaces ni direcciones web.'] }] });
  }
  if (HTML_PATTERN.test(value)) {
    throw new ValidationError('validation-failed', 'No se permite HTML.', { errors: [{ field, messages: ['No se permite HTML.'] }] });
  }
}

export function normalizeText(value: string): string {
  return value.replace(/\r\n/g, '\n').replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim();
}

export function createWebTestimonial(params: {
  id: string;
  now: Date;
  authorName: string;
  authorCountry?: string | null;
  locale: ContentLocale;
  rating: number;
  body: string;
  tourId: string | null;
  travelDate?: string | null;
  publishConsent: boolean;
  privacyNoticeVersion: string;
}): Testimonial {
  const authorName = normalizeText(params.authorName);
  const body = normalizeText(params.body);
  assertPlainText('authorName', authorName);
  assertPlainText('body', body);
  if (!params.publishConsent) {
    throw new ValidationError('consent-required', 'Debes autorizar la publicación de tu testimonio.', { errors: [{ field: 'publishConsent', messages: ['Obligatorio.'] }] });
  }
  if (!Number.isInteger(params.rating) || params.rating < 1 || params.rating > 5) {
    throw new ValidationError('validation-failed', 'La calificación va de 1 a 5.', { errors: [{ field: 'rating', messages: ['Entre 1 y 5.'] }] });
  }
  if (body.length < 20) {
    throw new ValidationError('validation-failed', 'Cuéntanos un poco más (mínimo 20 caracteres).', { errors: [{ field: 'body', messages: ['Mínimo 20 caracteres.'] }] });
  }
  const country = params.authorCountry ? params.authorCountry.toUpperCase() : null;
  return {
    id: params.id,
    tourId: params.tourId,
    authorName: authorName.slice(0, 120),
    authorCountry: country && /^[A-Z]{2}$/.test(country) ? country : null,
    locale: params.locale,
    rating: params.rating,
    body: body.slice(0, 3000),
    publishConsent: true,
    privacyNoticeVersion: params.privacyNoticeVersion,
    status: 'pending',
    isFeatured: false,
    travelDate: params.travelDate ?? null,
    origin: 'web',
    source: null,
    sourceUrl: null,
    createdAt: params.now,
    approvedAt: null,
  };
}

// =============================================================================
// Contacto (F3)
// =============================================================================
export type ContactStatus = 'new' | 'answered' | 'archived';
export const CONTACT_STATUSES: readonly ContactStatus[] = ['new', 'answered', 'archived'];

export interface ContactMessage {
  id: string;
  name: string;
  email: string;
  phoneEnc: Uint8Array | null;
  subject: string;
  message: string;
  tourSlug: string | null;
  locale: ContentLocale;
  status: ContactStatus;
  privacyNoticeVersion: string;
  createdAt: Date;
}

export interface ContactRepository {
  insert(message: ContactMessage): Promise<void>;
  findById(id: string): Promise<ContactMessage | null>;
}

export function contactAad(id: string): string {
  return `contact_messages:phone_enc:${id}`;
}

/** Transiciones de la bandeja: new -> answered | archived; answered -> archived; archived -> new (reabrir). */
export function canTransitionContact(from: ContactStatus, to: ContactStatus): boolean {
  if (from === to) return true;
  return (from === 'new' && (to === 'answered' || to === 'archived')) || (from === 'answered' && to === 'archived') || (from === 'archived' && to === 'new');
}
