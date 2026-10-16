import type { Prisma } from '../../../generated/prisma/client.js';
import type { PrismaTx } from '../../../persistence/prisma/prisma-client.js';
import { calendarDateFromUtcDate, calendarDateToUtcDate } from '../../../shared/domain/calendar-date.js';
import type { ContentLocale } from '../../../shared/domain/i18n.js';
import type {
  BlogPost,
  BlogRepository,
  ContactMessage,
  ContactRepository,
  ContactStatus,
  Testimonial,
  TestimonialOrigin,
  TestimonialRepository,
} from '../domain/content.js';

const BLOG_INCLUDE = { translations: true } satisfies Prisma.BlogPostInclude;
type BlogRow = Prisma.BlogPostGetPayload<{ include: typeof BLOG_INCLUDE }>;

export function mapBlogRow(row: BlogRow): BlogPost {
  return {
    id: row.id,
    status: row.status,
    coverStorageKey: row.coverStorageKey,
    publishedAt: row.publishedAt,
    tags: row.tags,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    translations: row.translations.map((t) => ({
      locale: t.locale,
      slug: t.slug,
      title: t.title,
      excerpt: t.excerpt,
      body: t.body,
      seoTitle: t.seoTitle,
      seoDescription: t.seoDescription,
      translationStatus: t.translationStatus,
    })),
  };
}

export class PrismaBlogRepository implements BlogRepository {
  constructor(private readonly db: PrismaTx) {}

  async listPublished(params: { now: Date; page: number; pageSize: number; tag?: string }): Promise<{ items: BlogPost[]; total: number }> {
    const where: Prisma.BlogPostWhereInput = {
      status: 'published',
      deletedAt: null,
      publishedAt: { lte: params.now },
      ...(params.tag ? { tags: { has: params.tag } } : {}),
    };
    const total = await this.db.blogPost.count({ where });
    const rows = await this.db.blogPost.findMany({
      where,
      include: BLOG_INCLUDE,
      orderBy: [{ publishedAt: 'desc' }, { id: 'desc' }],
      skip: (params.page - 1) * params.pageSize,
      take: params.pageSize,
    });
    return { items: rows.map(mapBlogRow), total };
  }

  async findBySlug(slug: string, preferredLocale: ContentLocale): Promise<BlogPost | null> {
    const translation =
      (await this.db.blogPostTranslation.findUnique({ where: { locale_slug: { locale: preferredLocale, slug } }, select: { blogPostId: true } })) ??
      (await this.db.blogPostTranslation.findFirst({ where: { slug }, select: { blogPostId: true } }));
    if (!translation) return null;
    const row = await this.db.blogPost.findFirst({ where: { id: translation.blogPostId, deletedAt: null }, include: BLOG_INCLUDE });
    return row ? mapBlogRow(row) : null;
  }
}

type TestimonialRow = Prisma.TestimonialGetPayload<object>;

export function mapTestimonialRow(r: TestimonialRow): Testimonial {
  return {
    id: r.id,
    tourId: r.tourId,
    authorName: r.authorName,
    authorCountry: r.authorCountry,
    locale: r.locale,
    rating: r.rating,
    body: r.body,
    publishConsent: r.publishConsent,
    privacyNoticeVersion: r.privacyNoticeVersion,
    status: r.status,
    isFeatured: r.isFeatured,
    travelDate: r.travelDate ? calendarDateFromUtcDate(r.travelDate) : null,
    origin: r.origin as TestimonialOrigin,
    source: r.source,
    sourceUrl: r.sourceUrl,
    createdAt: r.createdAt,
    approvedAt: r.approvedAt,
  };
}

/** Publicable: aprobado, no heredado y con consentimiento o transcripción del equipo. */
export const PUBLIC_TESTIMONIAL_WHERE: Prisma.TestimonialWhereInput = {
  status: 'approved',
  deletedAt: null,
  // Keep imported testimonials available to staff without publishing another brand's reviews.
  origin: { not: 'legacy_site' },
  OR: [{ publishConsent: true }, { origin: 'admin' }],
};

export class PrismaTestimonialRepository implements TestimonialRepository {
  constructor(private readonly db: PrismaTx) {}

  async insert(t: Testimonial): Promise<void> {
    await this.db.testimonial.create({
      data: {
        id: t.id,
        tourId: t.tourId,
        authorName: t.authorName,
        authorCountry: t.authorCountry,
        locale: t.locale,
        rating: t.rating,
        body: t.body,
        publishConsent: t.publishConsent,
        privacyNoticeVersion: t.privacyNoticeVersion,
        status: t.status,
        isFeatured: t.isFeatured,
        travelDate: t.travelDate ? calendarDateToUtcDate(t.travelDate) : null,
        origin: t.origin,
        source: t.source,
        sourceUrl: t.sourceUrl,
        createdAt: t.createdAt,
        approvedAt: t.approvedAt,
      },
    });
  }

  async listApproved(params: { locale?: ContentLocale; tourId?: string; featured?: boolean; page: number; pageSize: number }): Promise<{ items: Testimonial[]; total: number }> {
    const where: Prisma.TestimonialWhereInput = {
      AND: [
        PUBLIC_TESTIMONIAL_WHERE,
        params.locale ? { locale: params.locale } : {},
        params.tourId ? { tourId: params.tourId } : {},
        params.featured !== undefined ? { isFeatured: params.featured } : {},
      ],
    };
    const total = await this.db.testimonial.count({ where });
    const rows = await this.db.testimonial.findMany({
      where,
      orderBy: [{ isFeatured: 'desc' }, { approvedAt: 'desc' }, { createdAt: 'desc' }],
      skip: (params.page - 1) * params.pageSize,
      take: params.pageSize,
    });
    return { items: rows.map(mapTestimonialRow), total };
  }
}

export class PrismaContactRepository implements ContactRepository {
  constructor(private readonly db: PrismaTx) {}

  async insert(m: ContactMessage): Promise<void> {
    await this.db.contactMessage.create({
      data: {
        id: m.id,
        name: m.name,
        email: m.email,
        phoneEnc: m.phoneEnc ? Buffer.from(m.phoneEnc) : null,
        subject: m.subject,
        message: m.message,
        tourSlug: m.tourSlug,
        locale: m.locale,
        status: m.status,
        privacyNoticeVersion: m.privacyNoticeVersion,
        createdAt: m.createdAt,
      },
    });
  }

  async findById(id: string): Promise<ContactMessage | null> {
    const r = await this.db.contactMessage.findUnique({ where: { id } });
    if (!r) return null;
    return {
      id: r.id,
      name: r.name,
      email: r.email,
      phoneEnc: r.phoneEnc ? new Uint8Array(r.phoneEnc) : null,
      subject: r.subject,
      message: r.message,
      tourSlug: r.tourSlug,
      locale: r.locale,
      status: r.status as ContactStatus,
      privacyNoticeVersion: r.privacyNoticeVersion,
      createdAt: r.createdAt,
    };
  }
}
