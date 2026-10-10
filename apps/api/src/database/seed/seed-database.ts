import type { Prisma, PrismaClient } from '../../generated/prisma/client.js';
import type { PrismaTx } from '../../persistence/prisma/prisma-client.js';
import type { SeedBundle } from '../../modules/catalog/infrastructure/seed/seed-files.js';
import { mapSeedBlog, mapSeedCatalog, mapSeedRedirects, mapSeedTestimonials } from '../../modules/catalog/infrastructure/seed/seed-mapper.js';

export interface SeedOptions {
  /** HU-0.1: por defecto los tours quedan en borrador hasta revisión en backoffice. */
  publishTours: boolean;
  /** Sobrescribe textos ya existentes (por defecto no pisa ediciones del backoffice). */
  refreshContent: boolean;
  now: Date;
}

export interface SeedReport {
  destinations: { created: number; existing: number };
  categories: { created: number; existing: number };
  /** published = borradores existentes publicados por `--publish` (no despublica nunca). */
  tours: { created: number; existing: number; updated: number; published: number };
  tourTranslations: number;
  tourMedia: number;
  tourDestinations: number;
  redirects: { upserted: number; skippedSamePath: number };
  blogPosts: { created: number; existing: number };
  /** Traducciones `en` creadas o actualizadas (tours, destinos, categorías, blog). */
  translationsEn: { tours: number; destinations: number; categories: number; blogPosts: number };
  testimonials: { created: number; existing: number };
}

/**
 * Carga idempotente de data/seed/*.json (HU-0.1): reejecutar no duplica nada.
 * Todo en una transacción: o se carga completo o no se carga.
 */
export function seedDatabase(prisma: PrismaClient, bundle: SeedBundle, options: SeedOptions): Promise<SeedReport> {
  return prisma.$transaction((tx) => seedDatabaseInTransaction(tx, bundle, options), { timeout: 120_000, maxWait: 10_000 });
}

/** Igual que seedDatabase dentro de una transacción ya abierta (pruebas de integración). */
export async function seedDatabaseInTransaction(tx: PrismaTx, bundle: SeedBundle, options: SeedOptions): Promise<SeedReport> {
  const catalog = mapSeedCatalog(bundle, { publish: options.publishTours, publishedAt: options.now });
  const report: SeedReport = {
    destinations: { created: 0, existing: 0 },
    categories: { created: 0, existing: 0 },
    tours: { created: 0, existing: 0, updated: 0, published: 0 },
    tourTranslations: 0,
    tourMedia: 0,
    tourDestinations: 0,
    redirects: { upserted: 0, skippedSamePath: 0 },
    blogPosts: { created: 0, existing: 0 },
    translationsEn: { tours: 0, destinations: 0, categories: 0, blogPosts: 0 },
    testimonials: { created: 0, existing: 0 },
  };
  /** La traducción `en` de la semilla se crea si falta y se actualiza si sigue siendo automática
   * (machine_reviewed_pending_client) o con --refresh; nunca pisa una traducción editada en el panel. */
  const machine = (status: string | null | undefined) => status === 'machine_reviewed_pending_client';

  const destinationIds = new Map<string, string>();
  for (const d of catalog.destinations) {
    const existing = await tx.destination.findUnique({ where: { slug: d.slug } });
    const row =
      existing ??
      (await tx.destination.create({ data: { id: d.id, slug: d.slug, status: d.status, sortOrder: d.sortOrder } }));
    report.destinations[existing ? 'existing' : 'created'] += 1;
    destinationIds.set(d.id, row.id);
    for (const t of d.translations) {
      const data = { name: t.name, description: t.description, slug: t.slug ?? null, translationStatus: t.translationStatus ?? null };
      const current = await tx.destinationTranslation.findUnique({ where: { destinationId_locale: { destinationId: row.id, locale: t.locale } } });
      const overwrite = options.refreshContent || (t.locale === 'en' && current !== null && machine(current.translationStatus));
      if (!current) await tx.destinationTranslation.create({ data: { destinationId: row.id, locale: t.locale, ...data } });
      else if (overwrite) await tx.destinationTranslation.update({ where: { id: current.id }, data });
      if (t.locale === 'en' && (!current || overwrite)) report.translationsEn.destinations += 1;
    }
  }

  const categoryIds = new Map<string, string>();
  for (const c of catalog.categories) {
    const existing = await tx.category.findUnique({ where: { slug: c.slug } });
    const row = existing ?? (await tx.category.create({ data: { id: c.id, slug: c.slug, sortOrder: c.sortOrder } }));
    report.categories[existing ? 'existing' : 'created'] += 1;
    categoryIds.set(c.id, row.id);
    for (const t of c.translations) {
      const data = { name: t.name, description: t.description, slug: t.slug ?? null, translationStatus: t.translationStatus ?? null };
      const current = await tx.categoryTranslation.findUnique({ where: { categoryId_locale: { categoryId: row.id, locale: t.locale } } });
      const overwrite = options.refreshContent || (t.locale === 'en' && current !== null && machine(current.translationStatus));
      if (!current) await tx.categoryTranslation.create({ data: { categoryId: row.id, locale: t.locale, ...data } });
      else if (overwrite) await tx.categoryTranslation.update({ where: { id: current.id }, data });
      if (t.locale === 'en' && (!current || overwrite)) report.translationsEn.categories += 1;
    }
  }

  for (const tour of catalog.tours) {
    const scalar = {
      code: tour.code,
      type: tour.type,
      status: tour.status,
      categoryId: tour.categoryId ? (categoryIds.get(tour.categoryId) ?? null) : null,
      durationDays: tour.durationDays,
      durationNights: tour.durationNights,
      durationHours: tour.durationHours,
      minPax: tour.minPax,
      maxPax: tour.maxPax,
      difficulty: tour.difficulty,
      languages: tour.languages,
      bookingCutoffHours: tour.bookingCutoffHours,
      depositPercentOverride: tour.depositPercentOverride,
      requiresTravelerDocument: tour.requiresTravelerDocument,
      usesInventory: tour.usesInventory,
      isFeatured: tour.isFeatured,
      publishedAt: tour.publishedAt,
    };
    const existing = await tx.tour.findUnique({ where: { slug: tour.slug } });
    let tourId: string;
    if (existing) {
      tourId = existing.id;
      report.tours.existing += 1;
      if (options.refreshContent) {
        const { code: _code, status: _status, publishedAt: _publishedAt, ...content } = scalar;
        await tx.tour.update({ where: { id: tourId }, data: content });
        report.tours.updated += 1;
      }
      // --publish también publica los borradores ya cargados (HU-0.1: revisión previa en backoffice).
      if (options.publishTours && existing.status === 'draft') {
        await tx.tour.update({ where: { id: tourId }, data: { status: 'published', publishedAt: existing.publishedAt ?? options.now } });
        report.tours.published += 1;
      }
    } else {
      tourId = (await tx.tour.create({ data: { id: tour.id, slug: tour.slug, ...scalar } })).id;
      report.tours.created += 1;
      if (tour.media.length > 0) {
        const media = await tx.tourMedia.createMany({
          data: tour.media.map((m) => ({
            tourId,
            kind: m.kind,
            storageKey: m.url,
            altEs: m.altEs,
            altEn: m.altEn,
            isCover: m.isCover,
            sortOrder: m.sortOrder,
          })),
        });
        report.tourMedia += media.count;
      }
    }

    for (const t of tour.translations) {
      const content = {
        slug: t.slug,
        title: t.title,
        summary: t.summary,
        description: t.description,
        itinerary: t.itinerary as unknown as Prisma.InputJsonValue,
        includes: t.includes,
        notIncluded: t.notIncluded,
        recommendations: t.recommendations,
        faqs: t.faqs as unknown as Prisma.InputJsonValue,
        importantNotes: t.importantNotes,
        policies: t.policies,
        meetingPoint: t.meetingPoint,
        seoTitle: t.seoTitle,
        seoDescription: t.seoDescription,
        translationStatus: t.translationStatus ?? null,
      };
      const current = await tx.tourTranslation.findUnique({ where: { tourId_locale: { tourId, locale: t.locale } }, select: { id: true, translationStatus: true } });
      const overwrite = options.refreshContent || (t.locale === 'en' && current !== null && machine(current.translationStatus));
      if (!current) await tx.tourTranslation.create({ data: { tourId, locale: t.locale, ...content } });
      else if (overwrite) await tx.tourTranslation.update({ where: { id: current.id }, data: content });
      if (t.locale === 'en' && (!current || overwrite)) report.translationsEn.tours += 1;
      report.tourTranslations += 1;
    }

    const links = await tx.tourDestination.createMany({
      data: tour.destinations.flatMap((d) => {
        const destinationId = destinationIds.get(d.destinationId);
        return destinationId ? [{ tourId, destinationId, isPrimary: d.isPrimary, sortOrder: d.sortOrder }] : [];
      }),
      skipDuplicates: true,
    });
    report.tourDestinations += links.count;
  }

  const { redirects, skippedSamePath } = mapSeedRedirects(bundle.redirects.rules);
  report.redirects.skippedSamePath = skippedSamePath;
  for (const r of redirects) {
    await tx.legacyRedirect.upsert({
      where: { fromPath: r.fromPath },
      create: { fromPath: r.fromPath, toPath: r.toPath, statusCode: r.statusCode },
      update: { toPath: r.toPath, statusCode: r.statusCode },
    });
    report.redirects.upserted += 1;
  }

  for (const post of mapSeedBlog(bundle)) {
    const es = post.translations.find((t) => t.locale === 'es')!;
    const existing = await tx.blogPostTranslation.findUnique({ where: { locale_slug: { locale: 'es', slug: es.slug } } });
    let blogPostId: string;
    if (existing) {
      report.blogPosts.existing += 1;
      blogPostId = existing.blogPostId;
      if (post.tags.length > 0) await tx.blogPost.updateMany({ where: { id: blogPostId, tags: { isEmpty: true } }, data: { tags: post.tags } });
    } else {
      const created = await tx.blogPost.create({
        data: { status: post.status, publishedAt: post.publishedAt, coverStorageKey: post.coverStorageKey, tags: post.tags },
      });
      blogPostId = created.id;
      report.blogPosts.created += 1;
    }
    for (const t of post.translations) {
      const content = { slug: t.slug, title: t.title, excerpt: t.excerpt, body: t.body, seoTitle: t.seoTitle, seoDescription: t.seoDescription, translationStatus: t.translationStatus };
      const current = await tx.blogPostTranslation.findUnique({ where: { blogPostId_locale: { blogPostId, locale: t.locale } }, select: { id: true, translationStatus: true } });
      const overwrite = (options.refreshContent && t.locale === 'en') || (t.locale === 'en' && current !== null && machine(current.translationStatus));
      if (!current) await tx.blogPostTranslation.create({ data: { blogPostId, locale: t.locale, ...content } });
      else if (overwrite) await tx.blogPostTranslation.update({ where: { id: current.id }, data: content });
      if (t.locale === 'en' && (!current || overwrite)) report.translationsEn.blogPosts += 1;
    }
  }

  for (const t of mapSeedTestimonials(bundle.testimonials ?? [], options.now)) {
    if (await tx.testimonial.findUnique({ where: { id: t.id }, select: { id: true } })) {
      report.testimonials.existing += 1;
      continue;
    }
    await tx.testimonial.create({
      data: {
        id: t.id,
        authorName: t.authorName,
        authorCountry: t.authorCountry,
        locale: t.locale,
        rating: t.rating,
        body: t.body,
        publishConsent: false,
        status: 'approved',
        isFeatured: t.isFeatured,
        travelDate: t.travelDate ? new Date(`${t.travelDate}T00:00:00Z`) : null,
        origin: 'legacy_site',
        source: t.source,
        sourceUrl: t.sourceUrl,
        approvedAt: options.now,
        moderatedAt: options.now,
        moderationNote: 'Heredado del sitio anterior (ya era público).',
      },
    });
    report.testimonials.created += 1;
  }
  return report;
}
