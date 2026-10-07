import 'dotenv/config';
import { readSeedBundle } from '../../modules/catalog/infrastructure/seed/seed-files.js';
import { createPrismaClient } from '../../persistence/prisma/prisma-client.js';
import { seedDatabase } from './seed-database.js';

/**
 * CLI del seed (compilado en dist/). Uso desde apps/api:
 *   pnpm build && pnpm db:seed [-- --publish] [-- --refresh]
 * Variables: DATABASE_URL (obligatoria), SEED_DATA_DIR (por defecto ../../data/seed).
 */
export async function runSeed(argv: string[] = process.argv.slice(2)): Promise<void> {
  const url = process.env['DATABASE_URL'];
  if (!url) throw new Error('DATABASE_URL no está definida (apps/api/.env).');
  const prisma = createPrismaClient(url);
  try {
    const bundle = await readSeedBundle(process.env['SEED_DATA_DIR'] ?? '../../data/seed');
    const report = await seedDatabase(prisma, bundle, {
      publishTours: argv.includes('--publish'),
      refreshContent: argv.includes('--refresh'),
      now: new Date(),
    });
    console.log(JSON.stringify(report, null, 2));
  } finally {
    await prisma.$disconnect();
  }
}

/** Mensaje de error sin credenciales (oculta cualquier URL de conexión). */
export function describeError(error: unknown): string {
  const e = error as { name?: string; code?: string; message?: string; cause?: unknown } | null;
  const redact = (v: unknown) => (typeof v === 'string' ? v : JSON.stringify(v ?? '')).replace(/postgres(?:ql)?:\/\/\S+/gi, '<DATABASE_URL>');
  const cause = e?.cause instanceof Error ? e.cause.message : e?.cause;
  return [`${e?.name ?? 'Error'}${e?.code ? ` [${e.code}]` : ''}: ${redact(e?.message)}`, cause ? `causa: ${redact(cause)}` : '']
    .filter(Boolean)
    .join(' | ');
}

const invokedDirectly = process.argv[1]?.replaceAll('\\', '/').endsWith('/database/seed/run-seed.js');
if (invokedDirectly) {
  runSeed().catch((error: unknown) => {
    console.error(describeError(error));
    process.exitCode = 1;
  });
}
