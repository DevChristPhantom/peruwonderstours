import type { Prisma } from '../../../generated/prisma/client.js';
import { auditJson, type RequestMeta } from '../../../shared/application/audit.js';
import type { PiiCipher } from '../../../shared/application/pii-cipher.js';
import { BusinessRuleError, ConflictError, NotFoundError, ValidationError } from '../../../shared/domain/domain-error.js';
import type { ContentLocale } from '../../../shared/domain/i18n.js';
import type { IdGenerator } from '../../../shared/domain/ports.js';
import { normalizeTags } from '../../catalog/infrastructure/seed/seed-mapper.js';
import { assertPlainText, canTransitionContact, contactAad, normalizeText, type ContactStatus } from '../../content/domain/content.js';
import { mapBlogRow, mapTestimonialRow } from '../../content/infrastructure/prisma-content.repository.js';
import type { StaffActor } from '../../identity/application/staff-auth.use-cases.js';
import { pageArgs, type AdminDatabase, type AdminTx, type PageQuery } from '../infrastructure/admin-database.js';

class VersionConflictError extends ConflictError {
  constructor(entity: string) {
    super(`${entity}-version-conflict`, 'Este registro fue modificado por otra persona. Recarga y vuelve a intentar.');
  }
}

const notFound = (entity: string, message: string) => new NotFoundError(`${entity}-not-found`, message);

export interface BlogTranslationInput {
  slug: string;
  title: string;
  excerpt?: string | null;
  body: string;
  seoTitle?: string | null;
  seoDescription?: string | null;
  translationStatus?: string | null;
}

export interface TaxonomyTranslationInput {
  name: string;
  description?: string | null;
  slug?: string | null;
  seoTitle?: string | null;
  seoDescription?: string | null;
  translationStatus?: string | null;
}

/**
 * Backoffice de contenido (Sprint 3): blog, testimonios (moderación), bandeja de contacto,
 * destinos y categorías. Toda escritura: transacción con actor + acción semántica en audit_log +
 * bloqueo optimista (`version`) donde el recurso lo tiene.
 */
export class ContentAdminService {
  constructor(
    private readonly db: AdminDatabase,
    private readonly ids: IdGenerator,
    private readonly cipher: PiiCipher,
  ) {}

  // ===========================================================================
  // Blog
  // ===========================================================================
  listPosts(q: PageQuery & { status?: 'draft' | 'published' | 'archived'; q?: string }) {
    return this.db.read(async (prisma) => {
      const where: Prisma.BlogPostWhereInput = {
        ...(q.status === 'archived' ? { status: 'archived' } : { deletedAt: null, ...(q.status ? { status: q.status } : {}) }),
        ...(q.q ? { translations: { some: { title: { contains: q.q, mode: 'insensitive' } } } } : {}),
      };
      const total = await prisma.blogPost.count({ where });
      const rows = await prisma.blogPost.findMany({ where, include: { translations: true }, orderBy: [{ updatedAt: 'desc' }], ...pageArgs(q) });
      return {
        total,
        items: rows.map((r) => ({
          id: r.id,
          status: r.status,
          publishedAt: r.publishedAt,
          coverStorageKey: r.coverStorageKey,
          tags: r.tags,
          version: r.version,
          updatedAt: r.updatedAt,
          title: r.translations.find((t) => t.locale === 'es')?.title ?? r.translations[0]?.title ?? null,
          translations: r.translations.map((t) => ({ locale: t.locale, slug: t.slug, translationStatus: t.translationStatus })),
        })),
      };
    });
  }

  getPost(id: string) {
    return this.db.read(async (prisma) => {
      const row = await prisma.blogPost.findUnique({ where: { id }, include: { translations: true } });
      if (!row) throw notFound('blog-post', 'Artículo no encontrado.');
      return { ...mapBlogRow(row), version: row.version, deletedAt: row.deletedAt };
    });
  }

  private async bumpPost(ctx: AdminTx, id: string, version: number, data: Prisma.BlogPostUpdateManyMutationInput = {}) {
    const r = await ctx.tx.blogPost.updateMany({ where: { id, version }, data: { ...data, version: { increment: 1 } } });
    if (r.count !== 1) {
      if (!(await ctx.tx.blogPost.findUnique({ where: { id }, select: { id: true } }))) throw notFound('blog-post', 'Artículo no encontrado.');
      throw new VersionConflictError('blog-post');
    }
  }

  private async assertBlogSlugFree(ctx: AdminTx, locale: ContentLocale, slug: string, postId: string | null) {
    const clash = await ctx.tx.blogPostTranslation.findFirst({ where: { locale, slug, ...(postId ? { blogPostId: { not: postId } } : {}) }, select: { id: true } });
    if (clash) throw new ConflictError('blog-slug-taken', `El slug "${slug}" ya existe en "${locale}".`);
  }

  createPost(actor: StaffActor, meta: RequestMeta, input: { coverStorageKey?: string | null; tags?: string[]; translation: BlogTranslationInput }) {
    return this.db.run(actor, meta, async (ctx) => {
      await this.assertBlogSlugFree(ctx, 'es', input.translation.slug, null);
      const id = this.ids.next();
      await ctx.tx.blogPost.create({
        data: {
          id,
          status: 'draft',
          authorUserId: actor.userId,
          coverStorageKey: input.coverStorageKey ?? null,
          tags: normalizeTags(input.tags),
          translations: { create: { id: this.ids.next(), locale: 'es', ...this.blogTranslationData(input.translation) } },
        },
      });
      await ctx.audit({ entityType: 'blog_posts', entityId: id, action: 'BLOG_POST_CREATED', after: auditJson({ slug: input.translation.slug }) });
      return { id };
    }).then((r) => this.getPost(r.id));
  }

  private blogTranslationData(t: BlogTranslationInput) {
    return {
      slug: t.slug,
      title: t.title.trim(),
      excerpt: t.excerpt?.trim() || null,
      body: t.body,
      seoTitle: t.seoTitle ?? null,
      seoDescription: t.seoDescription ?? null,
      translationStatus: t.translationStatus ?? null,
    };
  }

  updatePost(actor: StaffActor, meta: RequestMeta, id: string, input: { version: number; coverStorageKey?: string | null; tags?: string[] }) {
    return this.db
      .run(actor, meta, async (ctx) => {
        await this.bumpPost(ctx, id, input.version, {
          ...(input.coverStorageKey !== undefined ? { coverStorageKey: input.coverStorageKey } : {}),
          ...(input.tags !== undefined ? { tags: normalizeTags(input.tags) } : {}),
        });
        await ctx.audit({ entityType: 'blog_posts', entityId: id, action: 'BLOG_POST_UPDATED', after: auditJson({ fields: Object.keys(input).filter((k) => k !== 'version') }) });
      })
      .then(() => this.getPost(id));
  }

  upsertPostTranslation(actor: StaffActor, meta: RequestMeta, id: string, locale: ContentLocale, input: BlogTranslationInput & { version: number }) {
    return this.db
      .run(actor, meta, async (ctx) => {
        await this.bumpPost(ctx, id, input.version);
        await this.assertBlogSlugFree(ctx, locale, input.slug, id);
        const data = this.blogTranslationData(input);
        const existing = await ctx.tx.blogPostTranslation.findUnique({ where: { blogPostId_locale: { blogPostId: id, locale } } });
        if (existing) await ctx.tx.blogPostTranslation.update({ where: { id: existing.id }, data });
        else await ctx.tx.blogPostTranslation.create({ data: { id: this.ids.next(), blogPostId: id, locale, ...data } });
        await ctx.audit({ entityType: 'blog_posts', entityId: id, action: 'BLOG_TRANSLATION_SAVED', after: auditJson({ locale, slug: input.slug }) });
      })
      .then(() => this.getPost(id));
  }

  deletePostTranslation(actor: StaffActor, meta: RequestMeta, id: string, locale: ContentLocale, version: number) {
    if (locale === 'es') throw new BusinessRuleError('canonical-translation-required', 'La traducción en español es obligatoria.');
    return this.db
      .run(actor, meta, async (ctx) => {
        await this.bumpPost(ctx, id, version);
        await ctx.tx.blogPostTranslation.deleteMany({ where: { blogPostId: id, locale } });
        await ctx.audit({ entityType: 'blog_posts', entityId: id, action: 'BLOG_TRANSLATION_DELETED', after: { locale } });
      })
      .then(() => this.getPost(id));
  }

  publishPost(actor: StaffActor, meta: RequestMeta, id: string, version: number, publishedAt?: Date) {
    return this.db
      .run(actor, meta, async (ctx) => {
        const row = await ctx.tx.blogPost.findUnique({ where: { id }, include: { translations: { where: { locale: 'es' } } } });
        if (!row || row.deletedAt) throw notFound('blog-post', 'Artículo no encontrado.');
        const es = row.translations[0];
        const errors: Array<{ field: string; messages: string[] }> = [];
        if (!es) errors.push({ field: 'translations.es', messages: ['Falta la traducción en español.'] });
        else if (es.body.trim().length < 50) errors.push({ field: 'translations.es.body', messages: ['El cuerpo es demasiado corto.'] });
        if (errors.length) throw new BusinessRuleError('blog-post-not-publishable', 'El artículo no cumple los requisitos para publicarse.', { errors });
        await this.bumpPost(ctx, id, version, { status: 'published', publishedAt: publishedAt ?? row.publishedAt ?? ctx.now });
        await ctx.audit({ entityType: 'blog_posts', entityId: id, action: 'BLOG_POST_PUBLISHED' });
      })
      .then(() => this.getPost(id));
  }

  unpublishPost(actor: StaffActor, meta: RequestMeta, id: string, version: number) {
    return this.db
      .run(actor, meta, async (ctx) => {
        await this.bumpPost(ctx, id, version, { status: 'draft' });
        await ctx.audit({ entityType: 'blog_posts', entityId: id, action: 'BLOG_POST_UNPUBLISHED' });
      })
      .then(() => this.getPost(id));
  }

  /** Borrado lógico (archivado). */
  archivePost(actor: StaffActor, meta: RequestMeta, id: string, version: number) {
    return this.db.run(actor, meta, async (ctx) => {
      await this.bumpPost(ctx, id, version, { status: 'archived', deletedAt: ctx.now });
      await ctx.audit({ entityType: 'blog_posts', entityId: id, action: 'BLOG_POST_ARCHIVED' });
    });
  }

  // ===========================================================================
  // Testimonios (moderación previa)
  // ===========================================================================
  listTestimonials(q: PageQuery & { status?: 'pending' | 'approved' | 'rejected' }) {
    return this.db.read(async (prisma) => {
      const where: Prisma.TestimonialWhereInput = { deletedAt: null, ...(q.status ? { status: q.status } : {}) };
      const total = await prisma.testimonial.count({ where });
      const rows = await prisma.testimonial.findMany({ where, orderBy: [{ createdAt: 'desc' }], ...pageArgs(q), include: { approvedBy: { select: { id: true, fullName: true } } } });
      return {
        total,
        items: rows.map((r) => ({ ...mapTestimonialRow(r), moderatedAt: r.moderatedAt, moderationNote: r.moderationNote, approvedBy: r.approvedBy, updatedAt: r.updatedAt })),
      };
    });
  }

  private async loadTestimonial(ctx: AdminTx, id: string) {
    const row = await ctx.tx.testimonial.findFirst({ where: { id, deletedAt: null } });
    if (!row) throw notFound('testimonial', 'Testimonio no encontrado.');
    return row;
  }

  approveTestimonial(actor: StaffActor, meta: RequestMeta, id: string, note?: string) {
    return this.db.run(actor, meta, async (ctx) => {
      const row = await this.loadTestimonial(ctx, id);
      if (row.origin === 'web' && !row.publishConsent) throw new BusinessRuleError('consent-required', 'El autor no autorizó la publicación.');
      const updated = await ctx.tx.testimonial.update({
        where: { id },
        data: { status: 'approved', approvedAt: ctx.now, approvedByUserId: actor.userId, moderatedAt: ctx.now, moderationNote: note?.trim() || null },
      });
      await ctx.audit({ entityType: 'testimonials', entityId: id, action: 'TESTIMONIAL_APPROVED', after: { from: row.status } });
      return mapTestimonialRow(updated);
    });
  }

  rejectTestimonial(actor: StaffActor, meta: RequestMeta, id: string, note: string) {
    return this.db.run(actor, meta, async (ctx) => {
      const row = await this.loadTestimonial(ctx, id);
      const updated = await ctx.tx.testimonial.update({
        where: { id },
        data: { status: 'rejected', isFeatured: false, approvedAt: null, approvedByUserId: null, moderatedAt: ctx.now, moderationNote: note.trim().slice(0, 500) },
      });
      await ctx.audit({ entityType: 'testimonials', entityId: id, action: 'TESTIMONIAL_REJECTED', after: { from: row.status } });
      return mapTestimonialRow(updated);
    });
  }

  /** Edición del staff (correcciones de ortografía, recorte); sigue sin admitir URLs ni HTML. */
  updateTestimonial(actor: StaffActor, meta: RequestMeta, id: string, input: { authorName?: string; authorCountry?: string | null; body?: string; rating?: number; locale?: ContentLocale }) {
    return this.db.run(actor, meta, async (ctx) => {
      await this.loadTestimonial(ctx, id);
      const data: Prisma.TestimonialUpdateInput = {};
      if (input.authorName !== undefined) {
        const v = normalizeText(input.authorName);
        assertPlainText('authorName', v);
        data.authorName = v.slice(0, 120);
      }
      if (input.body !== undefined) {
        const v = normalizeText(input.body);
        assertPlainText('body', v);
        if (v.length < 20) throw new ValidationError('validation-failed', 'Mínimo 20 caracteres.', { errors: [{ field: 'body', messages: ['Mínimo 20 caracteres.'] }] });
        data.body = v.slice(0, 3000);
      }
      if (input.authorCountry !== undefined) data.authorCountry = input.authorCountry ? input.authorCountry.toUpperCase() : null;
      if (input.rating !== undefined) data.rating = input.rating;
      if (input.locale !== undefined) data.locale = input.locale;
      const updated = await ctx.tx.testimonial.update({ where: { id }, data });
      await ctx.audit({ entityType: 'testimonials', entityId: id, action: 'TESTIMONIAL_EDITED', after: auditJson({ fields: Object.keys(input) }) });
      return mapTestimonialRow(updated);
    });
  }

  featureTestimonial(actor: StaffActor, meta: RequestMeta, id: string, featured: boolean) {
    return this.db.run(actor, meta, async (ctx) => {
      const row = await this.loadTestimonial(ctx, id);
      if (featured && row.status !== 'approved') throw new BusinessRuleError('testimonial-not-approved', 'Solo se destacan testimonios aprobados.');
      const updated = await ctx.tx.testimonial.update({ where: { id }, data: { isFeatured: featured } });
      await ctx.audit({ entityType: 'testimonials', entityId: id, action: featured ? 'TESTIMONIAL_FEATURED' : 'TESTIMONIAL_UNFEATURED' });
      return mapTestimonialRow(updated);
    });
  }

  // ===========================================================================
  // Bandeja de contacto
  // ===========================================================================
  listContactMessages(q: PageQuery & { status?: ContactStatus }) {
    return this.db.read(async (prisma) => {
      const where: Prisma.ContactMessageWhereInput = q.status ? { status: q.status } : {};
      const total = await prisma.contactMessage.count({ where });
      const counts = await prisma.contactMessage.groupBy({ by: ['status'], _count: { _all: true } });
      const rows = await prisma.contactMessage.findMany({ where, orderBy: { createdAt: 'desc' }, ...pageArgs(q) });
      return {
        total,
        counts: Object.fromEntries(counts.map((c) => [c.status, c._count._all])),
        items: rows.map((r) => ({
          id: r.id,
          name: r.name,
          email: r.email,
          subject: r.subject,
          preview: r.message.slice(0, 160),
          tourSlug: r.tourSlug,
          locale: r.locale,
          status: r.status,
          createdAt: r.createdAt,
          answeredAt: r.answeredAt,
          archivedAt: r.archivedAt,
        })),
      };
    });
  }

  /** Detalle con teléfono descifrado: lectura de datos personales auditada. */
  getContactMessage(actor: StaffActor, meta: RequestMeta, id: string) {
    return this.db.run(actor, meta, async (ctx) => {
      const r = await ctx.tx.contactMessage.findUnique({ where: { id } });
      if (!r) throw notFound('contact-message', 'Mensaje no encontrado.');
      await ctx.audit({ entityType: 'contact_messages', entityId: id, action: 'CONTACT_MESSAGE_VIEWED' });
      return {
        id: r.id,
        name: r.name,
        email: r.email,
        phone: r.phoneEnc ? this.cipher.decrypt(new Uint8Array(r.phoneEnc), contactAad(r.id)) : null,
        subject: r.subject,
        message: r.message,
        tourSlug: r.tourSlug,
        locale: r.locale,
        status: r.status,
        internalNote: r.internalNote,
        privacyNoticeVersion: r.privacyNoticeVersion,
        createdAt: r.createdAt,
        answeredAt: r.answeredAt,
        answeredByUserId: r.answeredByUserId,
        archivedAt: r.archivedAt,
      };
    });
  }

  setContactStatus(actor: StaffActor, meta: RequestMeta, id: string, status: ContactStatus, internalNote?: string) {
    return this.db.run(actor, meta, async (ctx) => {
      const r = await ctx.tx.contactMessage.findUnique({ where: { id }, select: { status: true } });
      if (!r) throw notFound('contact-message', 'Mensaje no encontrado.');
      const from = r.status as ContactStatus;
      if (!canTransitionContact(from, status)) throw new ConflictError('invalid-contact-transition', `No se puede pasar de "${from}" a "${status}".`);
      await ctx.tx.contactMessage.update({
        where: { id },
        data: {
          status,
          ...(status === 'answered' ? { answeredAt: ctx.now, answeredByUserId: actor.userId } : {}),
          ...(status === 'archived' ? { archivedAt: ctx.now } : {}),
          ...(status === 'new' ? { archivedAt: null } : {}),
          ...(internalNote !== undefined ? { internalNote: internalNote.trim().slice(0, 2000) || null } : {}),
        },
      });
      await ctx.audit({ entityType: 'contact_messages', entityId: id, action: 'CONTACT_STATUS_CHANGED', after: { from, to: status } });
      return { id, status };
    });
  }

  // ===========================================================================
  // Destinos y categorías
  // ===========================================================================
  listTaxonomy(kind: 'destination' | 'category') {
    return this.db.read(async (prisma) => {
      const rows =
        kind === 'destination'
          ? await prisma.destination.findMany({ where: { deletedAt: null }, include: { translations: true, _count: { select: { tours: true } } }, orderBy: [{ sortOrder: 'asc' }, { slug: 'asc' }] })
          : await prisma.category.findMany({ where: { deletedAt: null }, include: { translations: true, _count: { select: { tours: true } } }, orderBy: [{ sortOrder: 'asc' }, { slug: 'asc' }] });
      return rows.map((r) => this.presentTaxonomy(r));
    });
  }

  private presentTaxonomy(r: {
    id: string;
    slug: string;
    sortOrder: number;
    coverStorageKey: string | null;
    version: number;
    updatedAt: Date;
    status?: string;
    parentId?: string | null;
    translations: Array<{ locale: ContentLocale; name: string; description: string | null; slug: string | null; translationStatus: string | null; seoTitle?: string | null; seoDescription?: string | null }>;
    _count?: { tours: number };
  }) {
    return {
      id: r.id,
      slug: r.slug,
      status: r.status ?? 'published',
      parentId: r.parentId ?? null,
      sortOrder: r.sortOrder,
      coverStorageKey: r.coverStorageKey,
      version: r.version,
      updatedAt: r.updatedAt,
      tourCount: r._count?.tours ?? 0,
      translations: r.translations.map((t) => ({
        locale: t.locale,
        name: t.name,
        description: t.description,
        slug: t.slug,
        seoTitle: t.seoTitle ?? null,
        seoDescription: t.seoDescription ?? null,
        translationStatus: t.translationStatus,
      })),
    };
  }

  getTaxonomy(kind: 'destination' | 'category', id: string) {
    return this.db.read(async (prisma) => {
      const row =
        kind === 'destination'
          ? await prisma.destination.findFirst({ where: { id, deletedAt: null }, include: { translations: true, _count: { select: { tours: true } } } })
          : await prisma.category.findFirst({ where: { id, deletedAt: null }, include: { translations: true, _count: { select: { tours: true } } } });
      if (!row) throw notFound(kind, kind === 'destination' ? 'Destino no encontrado.' : 'Categoría no encontrada.');
      return this.presentTaxonomy(row);
    });
  }

  private async assertTaxonomySlugFree(ctx: AdminTx, kind: 'destination' | 'category', slug: string, id: string | null, locale?: ContentLocale) {
    if (locale) {
      const clash =
        kind === 'destination'
          ? await ctx.tx.destinationTranslation.findFirst({ where: { locale, slug, ...(id ? { destinationId: { not: id } } : {}) }, select: { id: true } })
          : await ctx.tx.categoryTranslation.findFirst({ where: { locale, slug, ...(id ? { categoryId: { not: id } } : {}) }, select: { id: true } });
      if (clash) throw new ConflictError(`${kind}-slug-taken`, `El slug "${slug}" ya existe en "${locale}".`);
      return;
    }
    const clash =
      kind === 'destination'
        ? await ctx.tx.destination.findFirst({ where: { slug, ...(id ? { id: { not: id } } : {}) }, select: { id: true } })
        : await ctx.tx.category.findFirst({ where: { slug, ...(id ? { id: { not: id } } : {}) }, select: { id: true } });
    if (clash) throw new ConflictError(`${kind}-slug-taken`, `El slug "${slug}" ya está en uso.`);
  }

  private async bumpTaxonomy(ctx: AdminTx, kind: 'destination' | 'category', id: string, version: number, data: Record<string, unknown> = {}) {
    const where = { id, version, deletedAt: null };
    const r =
      kind === 'destination'
        ? await ctx.tx.destination.updateMany({ where, data: { ...(data as Prisma.DestinationUpdateManyMutationInput), version: { increment: 1 } } })
        : await ctx.tx.category.updateMany({ where, data: { ...(data as Prisma.CategoryUpdateManyMutationInput), version: { increment: 1 } } });
    if (r.count !== 1) {
      const exists = kind === 'destination' ? await ctx.tx.destination.findFirst({ where: { id, deletedAt: null } }) : await ctx.tx.category.findFirst({ where: { id, deletedAt: null } });
      if (!exists) throw notFound(kind, kind === 'destination' ? 'Destino no encontrado.' : 'Categoría no encontrada.');
      throw new VersionConflictError(kind);
    }
  }

  createTaxonomy(
    actor: StaffActor,
    meta: RequestMeta,
    kind: 'destination' | 'category',
    input: { slug: string; sortOrder?: number; coverStorageKey?: string | null; status?: 'draft' | 'published'; parentId?: string | null; translation: TaxonomyTranslationInput },
  ) {
    return this.db
      .run(actor, meta, async (ctx) => {
        await this.assertTaxonomySlugFree(ctx, kind, input.slug, null);
        const id = this.ids.next();
        const tr = { id: this.ids.next(), locale: 'es' as const, name: input.translation.name.trim(), description: input.translation.description ?? null, slug: null, translationStatus: null };
        if (kind === 'destination') {
          await ctx.tx.destination.create({
            data: {
              id,
              slug: input.slug,
              sortOrder: input.sortOrder ?? 0,
              coverStorageKey: input.coverStorageKey ?? null,
              status: input.status ?? 'draft',
              parentId: input.parentId ?? null,
              translations: { create: { ...tr, seoTitle: input.translation.seoTitle ?? null, seoDescription: input.translation.seoDescription ?? null } },
            },
          });
        } else {
          await ctx.tx.category.create({ data: { id, slug: input.slug, sortOrder: input.sortOrder ?? 0, coverStorageKey: input.coverStorageKey ?? null, translations: { create: tr } } });
        }
        await ctx.audit({ entityType: kind === 'destination' ? 'destinations' : 'categories', entityId: id, action: `${kind.toUpperCase()}_CREATED`, after: { slug: input.slug } });
        return id;
      })
      .then((id) => this.getTaxonomy(kind, id));
  }

  updateTaxonomy(
    actor: StaffActor,
    meta: RequestMeta,
    kind: 'destination' | 'category',
    id: string,
    input: { version: number; slug?: string; sortOrder?: number; coverStorageKey?: string | null; status?: 'draft' | 'published'; parentId?: string | null },
  ) {
    return this.db
      .run(actor, meta, async (ctx) => {
        if (input.slug) await this.assertTaxonomySlugFree(ctx, kind, input.slug, id);
        if (kind === 'destination' && input.parentId === id) throw new BusinessRuleError('invalid-parent', 'Un destino no puede ser su propio padre.');
        const data: Record<string, unknown> = {};
        if (input.slug !== undefined) data['slug'] = input.slug;
        if (input.sortOrder !== undefined) data['sortOrder'] = input.sortOrder;
        if (input.coverStorageKey !== undefined) data['coverStorageKey'] = input.coverStorageKey;
        if (kind === 'destination' && input.status !== undefined) data['status'] = input.status;
        if (kind === 'destination' && input.parentId !== undefined) data['parentId'] = input.parentId;
        await this.bumpTaxonomy(ctx, kind, id, input.version, data);
        await ctx.audit({ entityType: kind === 'destination' ? 'destinations' : 'categories', entityId: id, action: `${kind.toUpperCase()}_UPDATED`, after: auditJson({ fields: Object.keys(data) }) });
      })
      .then(() => this.getTaxonomy(kind, id));
  }

  /** Reordena en bloque (arrastrar y soltar en el panel). */
  reorderTaxonomy(actor: StaffActor, meta: RequestMeta, kind: 'destination' | 'category', order: Array<{ id: string; sortOrder: number }>) {
    return this.db
      .run(actor, meta, async (ctx) => {
        for (const item of order) {
          const r =
            kind === 'destination'
              ? await ctx.tx.destination.updateMany({ where: { id: item.id, deletedAt: null }, data: { sortOrder: item.sortOrder, version: { increment: 1 } } })
              : await ctx.tx.category.updateMany({ where: { id: item.id, deletedAt: null }, data: { sortOrder: item.sortOrder, version: { increment: 1 } } });
          if (r.count !== 1) throw notFound(kind, `No existe ${item.id}.`);
        }
        await ctx.audit({ entityType: kind === 'destination' ? 'destinations' : 'categories', entityId: null, action: `${kind.toUpperCase()}_REORDERED`, after: { count: order.length } });
      })
      .then(() => this.listTaxonomy(kind));
  }

  upsertTaxonomyTranslation(actor: StaffActor, meta: RequestMeta, kind: 'destination' | 'category', id: string, locale: ContentLocale, input: TaxonomyTranslationInput & { version: number }) {
    return this.db
      .run(actor, meta, async (ctx) => {
        await this.bumpTaxonomy(ctx, kind, id, input.version);
        const slug = locale === 'es' ? null : (input.slug ?? null);
        if (slug) await this.assertTaxonomySlugFree(ctx, kind, slug, id, locale);
        const data = { name: input.name.trim(), description: input.description ?? null, slug, translationStatus: input.translationStatus ?? null };
        if (kind === 'destination') {
          const full = { ...data, seoTitle: input.seoTitle ?? null, seoDescription: input.seoDescription ?? null };
          const existing = await ctx.tx.destinationTranslation.findUnique({ where: { destinationId_locale: { destinationId: id, locale } } });
          if (existing) await ctx.tx.destinationTranslation.update({ where: { id: existing.id }, data: full });
          else await ctx.tx.destinationTranslation.create({ data: { id: this.ids.next(), destinationId: id, locale, ...full } });
        } else {
          const existing = await ctx.tx.categoryTranslation.findUnique({ where: { categoryId_locale: { categoryId: id, locale } } });
          if (existing) await ctx.tx.categoryTranslation.update({ where: { id: existing.id }, data });
          else await ctx.tx.categoryTranslation.create({ data: { id: this.ids.next(), categoryId: id, locale, ...data } });
        }
        await ctx.audit({ entityType: kind === 'destination' ? 'destinations' : 'categories', entityId: id, action: `${kind.toUpperCase()}_TRANSLATION_SAVED`, after: { locale } });
      })
      .then(() => this.getTaxonomy(kind, id));
  }

  deleteTaxonomyTranslation(actor: StaffActor, meta: RequestMeta, kind: 'destination' | 'category', id: string, locale: ContentLocale, version: number) {
    if (locale === 'es') throw new BusinessRuleError('canonical-translation-required', 'La traducción en español es obligatoria.');
    return this.db
      .run(actor, meta, async (ctx) => {
        await this.bumpTaxonomy(ctx, kind, id, version);
        if (kind === 'destination') await ctx.tx.destinationTranslation.deleteMany({ where: { destinationId: id, locale } });
        else await ctx.tx.categoryTranslation.deleteMany({ where: { categoryId: id, locale } });
        await ctx.audit({ entityType: kind === 'destination' ? 'destinations' : 'categories', entityId: id, action: `${kind.toUpperCase()}_TRANSLATION_DELETED`, after: { locale } });
      })
      .then(() => this.getTaxonomy(kind, id));
  }

  /** Borrado lógico; rechaza si aún tiene tours asociados. */
  deleteTaxonomy(actor: StaffActor, meta: RequestMeta, kind: 'destination' | 'category', id: string, version: number) {
    return this.db.run(actor, meta, async (ctx) => {
      const tours = kind === 'destination' ? await ctx.tx.tourDestination.count({ where: { destinationId: id } }) : await ctx.tx.tour.count({ where: { categoryId: id, deletedAt: null } });
      if (tours > 0) throw new ConflictError(`${kind}-in-use`, `Tiene ${tours} tour(s) asociados: reasígnalos antes de eliminar.`, { tours });
      await this.bumpTaxonomy(ctx, kind, id, version, { deletedAt: ctx.now });
      await ctx.audit({ entityType: kind === 'destination' ? 'destinations' : 'categories', entityId: id, action: `${kind.toUpperCase()}_DELETED` });
    });
  }
}
