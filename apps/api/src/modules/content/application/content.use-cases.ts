import type { PiiCipher } from '../../../shared/application/pii-cipher.js';
import type { UnitOfWork } from '../../../shared/application/unit-of-work.js';
import { NotFoundError } from '../../../shared/domain/domain-error.js';
import { pickTranslation, type ContentLocale } from '../../../shared/domain/i18n.js';
import type { Clock, IdGenerator } from '../../../shared/domain/ports.js';
import { normalizeEmail } from '../../customers/domain/customer.js';
import { MAIL_EVENTS, outboxMessage } from '../../notifications/domain/mail-events.js';
import {
  assertPlainText,
  contactAad,
  createWebTestimonial,
  isBlogPostVisible,
  normalizeText,
  type BlogPost,
  type BlogPostTranslation,
  type ContactMessage,
  type Testimonial,
} from '../domain/content.js';

export class BlogPostNotFoundError extends NotFoundError {
  constructor(slug: string) {
    super('blog-post-not-found', 'Artículo no encontrado.', { slug });
  }
}

export interface LocalizedPost {
  post: BlogPost;
  translation: BlogPostTranslation;
  locale: ContentLocale;
  fallback: boolean;
}

export type PostBySlug = { kind: 'found'; value: LocalizedPost } | { kind: 'redirect'; slug: string; locale: ContentLocale };

function localize(post: BlogPost, locale: ContentLocale): LocalizedPost | null {
  const picked = pickTranslation(post.translations, locale);
  return picked ? { post, translation: picked.value, locale: picked.locale, fallback: picked.fallback } : null;
}

export interface ContentSettings {
  privacyNoticeVersion: string;
}

/** Contenido público: blog (F1), testimonios (F2) y formulario de contacto (F3). */
export class ContentUseCases {
  constructor(
    private readonly uow: UnitOfWork,
    private readonly clock: Clock,
    private readonly ids: IdGenerator,
    private readonly cipher: PiiCipher,
    private readonly settings: ContentSettings,
  ) {}

  // ---------------------------------------------------------------- Blog
  async listPosts(params: { locale: ContentLocale; page: number; pageSize: number; tag?: string }): Promise<{ items: LocalizedPost[]; total: number }> {
    const now = this.clock.now();
    const result = await this.uow.run((repos) => repos.blog.listPublished({ now, page: params.page, pageSize: params.pageSize, tag: params.tag }));
    return { items: result.items.flatMap((p) => localize(p, params.locale) ?? []), total: result.total };
  }

  /** Artículo por slug de cualquier idioma; 301 si el slug no es el del idioma servido. */
  async getPost(slug: string, locale: ContentLocale): Promise<PostBySlug> {
    const now = this.clock.now();
    const post = await this.uow.run((repos) => repos.blog.findBySlug(slug, locale));
    const localized = post && isBlogPostVisible(post, now) ? localize(post, locale) : null;
    if (!localized) throw new BlogPostNotFoundError(slug);
    if (localized.translation.slug !== slug) return { kind: 'redirect', slug: localized.translation.slug, locale };
    return { kind: 'found', value: localized };
  }

  // ---------------------------------------------------------- Testimonios
  async submitTestimonial(input: {
    authorName: string;
    authorCountry?: string;
    rating: number;
    body: string;
    tourSlug?: string;
    travelDate?: string;
    locale: ContentLocale;
    publishConsent: boolean;
  }): Promise<Testimonial> {
    return this.uow.run(async (repos) => {
      const tour = input.tourSlug ? await repos.catalog.findTourBySlug(input.tourSlug, input.locale) : null;
      const testimonial = createWebTestimonial({
        id: this.ids.next(),
        now: this.clock.now(),
        authorName: input.authorName,
        authorCountry: input.authorCountry,
        locale: input.locale,
        rating: input.rating,
        body: input.body,
        tourId: tour?.id ?? null,
        travelDate: input.travelDate,
        publishConsent: input.publishConsent,
        privacyNoticeVersion: this.settings.privacyNoticeVersion,
      });
      await repos.testimonials.insert(testimonial);
      return testimonial;
    });
  }

  async listTestimonials(params: { locale?: ContentLocale; tourSlug?: string; featured?: boolean; page: number; pageSize: number }) {
    return this.uow.run(async (repos) => {
      let tourId: string | undefined;
      if (params.tourSlug) {
        const tour = await repos.catalog.findTourBySlug(params.tourSlug, params.locale ?? 'es');
        if (!tour) return { items: [], total: 0 };
        tourId = tour.id;
      }
      return repos.testimonials.listApproved({ locale: params.locale, tourId, featured: params.featured, page: params.page, pageSize: params.pageSize });
    });
  }

  // ------------------------------------------------------------- Contacto
  async submitContact(input: { name: string; email: string; phone?: string; subject: string; message: string; tourSlug?: string; locale: ContentLocale }): Promise<{ id: string }> {
    const name = normalizeText(input.name);
    const subject = normalizeText(input.subject);
    const message = normalizeText(input.message);
    assertPlainText('name', name);
    assertPlainText('subject', subject);
    const email = normalizeEmail(input.email);
    return this.uow.run(async (repos) => {
      const now = this.clock.now();
      const id = this.ids.next();
      const phone = input.phone?.trim();
      const record: ContactMessage = {
        id,
        name: name.slice(0, 120),
        email,
        phoneEnc: phone ? this.cipher.encrypt(phone, contactAad(id)) : null,
        subject: subject.slice(0, 150),
        message: message.slice(0, 5000),
        tourSlug: input.tourSlug ?? null,
        locale: input.locale,
        status: 'new',
        privacyNoticeVersion: this.settings.privacyNoticeVersion,
        createdAt: now,
      };
      await repos.contactMessages.insert(record);
      // El correo (agencia + acuse) sale por el outbox: sin PII en el payload.
      await repos.outbox.add(
        outboxMessage(this.ids, { aggregateType: 'contact_message', aggregateId: id, eventType: MAIL_EVENTS.contactMessageReceived, payload: { contactMessageId: id }, now }),
      );
      return { id };
    });
  }
}
