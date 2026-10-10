/**
 * `pnpm media:import-legacy [-- --dry-run] [--limit N] [--no-repoint]`
 *
 * Migra las imágenes del sitio viejo (autorizado por el cliente) listadas en
 * data/seed/media-manifest.json al almacenamiento de medios (MEDIA_STORAGE, hoy `local`:
 * MEDIA_LOCAL_DIR) y re-apunta las referencias de la BD (tour_media.storage_key, portadas de blog,
 * destinos y categorías, imágenes en el cuerpo del blog) con el alt es/en del manifiesto.
 *  - Solo hosts de LEGACY_MEDIA_HOSTS; sin sellos/insignias ni el póster ESNNA de otra agencia.
 *  - Máximo 2 descargas en paralelo; idempotente (estado en <MEDIA_LOCAL_DIR>/legacy-import.json).
 *  - Tipo real verificado por magic bytes (JPEG/PNG/WebP/AVIF); lo demás se reporta como fallo.
 *  - Variantes AVIF/WebP: PENDIENTE (no hay librería de imágenes instalada); se guarda el original.
 * Reporte en <MEDIA_LOCAL_DIR>/legacy-import-report.json. No imprime secretos.
 */
import { config } from 'dotenv';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { httpFetcher, importItems, selectImportable, type ImportState, type ManifestItem } from '../modules/media/application/legacy-import.js';
import { LocalMediaStorage } from '../modules/media/infrastructure/local-media-storage.js';
import { repointLegacyMedia } from '../modules/media/infrastructure/legacy-media-repoint.js';
import { createPrismaClient } from '../persistence/prisma/prisma-client.js';

config({ quiet: true });

const { values } = parseArgs({
  options: { 'dry-run': { type: 'boolean', default: false }, limit: { type: 'string' }, 'no-repoint': { type: 'boolean', default: false } },
  allowPositionals: true,
  // pnpm reenvía el separador "--": sin quitarlo, las opciones posteriores serían posicionales.
  args: process.argv.slice(2).filter((a) => a !== '--'),
});

async function readJson<T>(path: string, fallback: T): Promise<T> {
  try {
    return JSON.parse(await readFile(path, 'utf8')) as T;
  } catch {
    return fallback;
  }
}

async function main(): Promise<void> {
  const seedDir = resolve(process.env['SEED_DATA_DIR'] ?? '../../data/seed');
  const mediaDir = resolve(process.env['MEDIA_LOCAL_DIR'] ?? 'uploads');
  const publicBase = (process.env['MEDIA_PUBLIC_BASE_URL'] ?? 'http://localhost:3001/media').replace(/\/$/, '');
  const maxBytes = Number(process.env['MEDIA_LEGACY_MAX_MB'] ?? '25') * 1024 * 1024;
  const hosts = new Set(
    (process.env['LEGACY_MEDIA_HOSTS'] ?? 'www.andeanperutours.com,andeanperutours.com,turinet.turismoads.com')
      .split(',')
      .map((h) => h.trim().toLowerCase())
      .filter(Boolean),
  );

  const manifest = await readJson<{ items?: ManifestItem[] }>(join(seedDir, 'media-manifest.json'), {});
  if (!manifest.items?.length) throw new Error('No se encontró data/seed/media-manifest.json con items.');
  const { selected, skipped } = selectImportable(manifest.items, hosts);
  const limit = values.limit ? Number.parseInt(values.limit, 10) : undefined;
  const items = limit ? selected.slice(0, limit) : selected;
  console.log(`Manifiesto: ${manifest.items.length} | seleccionadas: ${selected.length} | omitidas: ${skipped.length}${limit ? ` | límite: ${limit}` : ''}`);
  if (values['dry-run']) {
    console.log(JSON.stringify({ dryRun: true, selected: items.length, skippedByReason: countBy(skipped.map((s) => s.reason)) }, null, 2));
    return;
  }

  await mkdir(mediaDir, { recursive: true });
  const statePath = join(mediaDir, 'legacy-import.json');
  const state = await readJson<ImportState>(statePath, {});
  const storage = new LocalMediaStorage(mediaDir);
  const started = Date.now();
  const outcome = await importItems({
    items,
    state,
    storage,
    fetcher: httpFetcher(30_000, maxBytes),
    maxBytes,
    concurrency: 2,
    now: () => new Date(),
    onProgress: (done, total) => {
      if (done % 25 === 0 || done === total) console.log(`  ${done}/${total}`);
    },
  });
  await writeFile(statePath, JSON.stringify(state, null, 2));

  let repoint = null;
  if (!values['no-repoint']) {
    const url = process.env['DATABASE_URL'];
    if (!url) throw new Error('DATABASE_URL no está definida (apps/api/.env).');
    const prisma = createPrismaClient(url);
    try {
      repoint = await repointLegacyMedia(prisma, items, state, publicBase);
    } finally {
      await prisma.$disconnect();
    }
  }

  const all = [...outcome.imported, ...outcome.reused];
  const report = {
    finishedAt: new Date().toISOString(),
    seconds: Math.round((Date.now() - started) / 1000),
    selected: items.length,
    imported: outcome.imported.length,
    reused: outcome.reused.length,
    failed: outcome.failed.length,
    bytesTotal: all.reduce((s, e) => s + e.size, 0),
    bytesImportedThisRun: outcome.imported.reduce((s, e) => s + e.size, 0),
    byMime: countBy(all.map((e) => e.mime)),
    skippedByReason: countBy(skipped.map((s) => s.reason)),
    failures: outcome.failed,
    repoint,
    pending: 'Variantes AVIF/WebP no generadas (sin librería de imágenes); se sirven los originales.',
  };
  await writeFile(join(mediaDir, 'legacy-import-report.json'), JSON.stringify(report, null, 2));
  const { failures, ...summary } = report;
  console.log(JSON.stringify({ ...summary, failuresSample: failures.slice(0, 10) }, null, 2));
}

function countBy(values: string[]): Record<string, number> {
  return values.reduce<Record<string, number>>((acc, v) => ((acc[v] = (acc[v] ?? 0) + 1), acc), {});
}

main().catch((error: unknown) => {
  const message = (error instanceof Error ? error.message : String(error)).replace(/postgres(?:ql)?:\/\/\S+/gi, '<DATABASE_URL>');
  console.error(`media:import-legacy: ${message}`);
  process.exitCode = 1;
});
