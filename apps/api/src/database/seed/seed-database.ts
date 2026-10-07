import type { Prisma, PrismaClient } from '../../generated/prisma/client.js';
import type { SeedBundle } from '../../modules/catalog/infrastructure/seed/seed-files.js';
import { mapSeedBlogPost, mapSeedCatalog, mapSeedRedirects } from '../../modules/catalog/infrastructure/seed/seed-mapper.js';

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
  tours: { created: number; existing: number; updated: number };
  tourTranslations: number;
  tourMedia: number;
  tourDestinations: number;
  redirects: { upserted: number; skippedSamePath: number };
  blogPosts: { created: number; existing: number };
}

/**
 * Carga idempotente de data/seed/*.json (HU-0.1): reejecutar no duplica nada.
 * Todo en una transacción: o se carga completo o no se carga.
 */
export async function seedDatabase(prisma: PrismaClient, bundle: SeedBundle, options: SeedOptions): Promise<SeedReport> {
  const catalog = mapSeedCatalog(bundle, { publish: options.publishTours, publishedAt: options.now });
  const report: SeedReport = {
    destinations: { created: 0, existing: 0 },
    categories: { created: 0, existing: 0 },
    tours: { created: 0, existing: 0, updated: 0 },
    tourTranslations: 0,
    tourMedia: 0,
    tourDestinations: 0,
    redirects: { upserted: 0, skippedSamePath: 0 },
    blogPosts: { created: 0, existing: 0 },
  };

  await prisma.$transaction(
    async (tx) => {
      const destinationIds = new Map<string, string>();
      for (const d of catalog.destinations) {
        const existing = await tx.destination.findUnique({ where: { slug: d.slug } });
        const row =
          existing ??
          (await tx.destination.create({ data: { id: d.id, slug: d.slug, status: d.status, sortOrder: d.sortOrder } }));
        report.destinations[existing ? 'existing' : 'created'] += 1;
        destinationIds.set(d.id, row.id);
        for (const t of d.translations) {
          await tx.destinationTranslation.upsert({
            where: { destinationId_locale: { destinationId: row.id, locale: t.locale } },
            create: { destinationId: row.id, locale: t.locale, name: t.name, description: t.description },
            update: options.refreshContent ? { name: t.name, description: t.description } : {},
          });
        }
      }

      const categoryIds = new Map<string, string>();
      for (const c of catalog.categories) {
        const existing = await tx.category.findUnique({ where: { slug: c.slug } });
        const row = existing ?? (await tx.category.create({ data: { id: c.id, slug: c.slug, sortOrder: c.sortOrder } }));
        report.categories[existing ? 'existing' : 'created'] += 1;
        categoryIds.set(c.id, row.id);
        for (const t of c.translations) {
          await tx.categoryTranslation.upsert({
            where: { categoryId_locale: { categoryId: row.id, locale: t.locale } },
            create: { categoryId: row.id, locale: t.locale, name: t.name, description: t.description },
            update: options.refreshContent ? { name: t.name, description: t.description } : {},
          });
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
          };
          await tx.tourTranslation.upsert({
            where: { tourId_locale: { tourId, locale: t.locale } },
            create: { tourId, locale: t.locale, ...content },
            update: options.refreshContent ? content : {},
          });
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

      for (const post of bundle.blogPosts) {
        const row = mapSeedBlogPost(post);
        const existing = await tx.blogPostTranslation.findUnique({ where: { locale_slug: { locale: 'es', slug: row.slug } } });
        if (existing) {
          report.blogPosts.existing += 1;
          continue;
        }
        await tx.blogPost.create({
          data: {
            status: row.publishedAt ? 'published' : 'draft',
            publishedAt: row.publishedAt,
            coverStorageKey: row.coverStorageKey,
            translations: {
              create: {
                locale: 'es',
                slug: row.slug,
                title: row.title,
                excerpt: row.excerpt,
                body: row.body,
                seoTitle: row.seoTitle,
                seoDescription: row.seoDescription,
              },
            },
          },
        });
        report.blogPosts.created += 1;
      }
    },
    { timeout: 120_000, maxWait: 10_000 },
  );
  return report;
}
