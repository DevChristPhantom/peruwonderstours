import type { PrismaClient } from '../../../generated/prisma/client.js';
import type { ImportState, ManifestItem } from '../application/legacy-import.js';

export interface RepointReport {
  tourMedia: number;
  blogCovers: number;
  blogBodies: number;
  destinationCovers: number;
  categoryCovers: number;
}

const truncate = (v: string | null | undefined, max: number) => (v ? v.slice(0, max) : null);

/**
 * Re-apunta las referencias de la BD a las claves importadas (idempotente: solo toca filas que aún
 * apuntan a la URL vieja o a una de sus variantes /sm/ /md/ /lg/). Registra el alt es/en del manifiesto.
 * Todo en una transacción.
 */
export async function repointLegacyMedia(prisma: PrismaClient, items: readonly ManifestItem[], state: ImportState, publicBaseUrl: string): Promise<RepointReport> {
  const report: RepointReport = { tourMedia: 0, blogCovers: 0, blogBodies: 0, destinationCovers: 0, categoryCovers: 0 };
  await prisma.$transaction(
    async (tx) => {
      for (const item of items) {
        const entry = state[item.url];
        if (!entry) continue;
        const urls = [item.url, ...(item.variantsSeen ?? [])];
        const key = entry.storageKey;
        const types = new Set(item.usages.map((u) => u.entityType));

        if (types.has('tour')) {
          const r = await tx.tourMedia.updateMany({
            where: { storageKey: { in: urls } },
            data: { storageKey: key, width: entry.width, height: entry.height, ...(item.altEs ? { altEs: truncate(item.altEs, 250) } : {}), ...(item.altEn ? { altEn: truncate(item.altEn, 250) } : {}) },
          });
          report.tourMedia += r.count;
        }
        if (types.has('blogPost')) {
          const r = await tx.blogPost.updateMany({ where: { coverStorageKey: { in: urls } }, data: { coverStorageKey: key } });
          report.blogCovers += r.count;
          // Imágenes dentro del cuerpo: se reemplaza la URL vieja por la pública nueva.
          const publicUrl = `${publicBaseUrl}/${key}`;
          for (const url of urls) {
            const rows = await tx.blogPostTranslation.findMany({ where: { body: { contains: url } }, select: { id: true, body: true } });
            for (const row of rows) {
              await tx.blogPostTranslation.update({ where: { id: row.id }, data: { body: row.body.split(url).join(publicUrl) } });
              report.blogBodies += 1;
            }
          }
        }
        for (const usage of item.usages) {
          if (!usage.entitySlug || usage.role !== 'banner') continue;
          if (usage.entityType === 'destination') {
            const r = await tx.destination.updateMany({ where: { slug: usage.entitySlug, OR: [{ coverStorageKey: null }, { coverStorageKey: { in: urls } }] }, data: { coverStorageKey: key } });
            report.destinationCovers += r.count;
          }
          if (usage.entityType === 'category') {
            const r = await tx.category.updateMany({ where: { slug: usage.entitySlug, OR: [{ coverStorageKey: null }, { coverStorageKey: { in: urls } }] }, data: { coverStorageKey: key } });
            report.categoryCovers += r.count;
          }
        }
      }
    },
    { timeout: 120_000, maxWait: 10_000 },
  );
  return report;
}
