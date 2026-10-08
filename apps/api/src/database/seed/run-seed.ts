import 'dotenv/config';
import { readSeedBundle } from '../../modules/catalog/infrastructure/seed/seed-files.js';
import { createPrismaClient } from '../../persistence/prisma/prisma-client.js';
import { removeDemoPricing, seedDemoPricing } from './demo-pricing-seed.js';
import { seedDatabase } from './seed-database.js';

/**
 * CLI del seed (compilado en dist/). Uso desde apps/api:
 *   pnpm build && pnpm db:seed [-- --publish] [-- --refresh] [-- --demo-pricing | --remove-demo-pricing]
 * - `--demo-pricing`: tarifas y salidas FICTICIAS (temporada DEMO, 120 días). Prohibido en producción.
 * - `--remove-demo-pricing`: borra solo lo DEMO; aborta si alguna reserva o carrito lo usa.
 * Variables: DATABASE_URL (obligatoria), SEED_DATA_DIR (por defecto ../../data/seed), NODE_ENV.
 */
export interface SeedCliOptions {
  publish: boolean;
  refresh: boolean;
  demoPricing: boolean;
  removeDemoPricing: boolean;
}

const KNOWN_FLAGS = new Set(['--publish', '--refresh', '--demo-pricing', '--remove-demo-pricing']);

export function parseSeedArgs(argv: readonly string[], nodeEnv: string | undefined): SeedCliOptions {
  const unknown = argv.filter((a) => a !== '--' && !KNOWN_FLAGS.has(a));
  if (unknown.length > 0) throw new Error(`Opciones desconocidas: ${unknown.join(' ')}`);
  const options: SeedCliOptions = {
    publish: argv.includes('--publish'),
    refresh: argv.includes('--refresh'),
    demoPricing: argv.includes('--demo-pricing'),
    removeDemoPricing: argv.includes('--remove-demo-pricing'),
  };
  if (options.demoPricing && options.removeDemoPricing) throw new Error('--demo-pricing y --remove-demo-pricing son excluyentes.');
  if (options.demoPricing && nodeEnv === 'production') {
    throw new Error('--demo-pricing está prohibido en producción (precios ficticios).');
  }
  return options;
}

export async function runSeed(argv: string[] = process.argv.slice(2)): Promise<void> {
  const options = parseSeedArgs(argv, process.env['NODE_ENV']);
  const url = process.env['DATABASE_URL'];
  if (!url) throw new Error('DATABASE_URL no está definida (apps/api/.env).');
  const prisma = createPrismaClient(url);
  try {
    if (options.removeDemoPricing) {
      console.log(JSON.stringify({ removedDemoPricing: await removeDemoPricing(prisma) }, null, 2));
      return;
    }
    const bundle = await readSeedBundle(process.env['SEED_DATA_DIR'] ?? '../../data/seed');
    const now = new Date();
    const report = await seedDatabase(prisma, bundle, { publishTours: options.publish, refreshContent: options.refresh, now });
    const demoPricing = options.demoPricing ? await seedDemoPricing(prisma, { now }) : undefined;
    console.log(JSON.stringify(demoPricing ? { ...report, demoPricing } : report, null, 2));
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
