/**
 * Seed de Prisma: carga data/seed/*.json (tours en borrador, traducciones es, destinos,
 * categorías, redirecciones y blog) de forma idempotente.
 *
 * Ejecutar (desde apps/api):
 *   - Sin dependencias extra:   pnpm build && pnpm db:seed          (usa dist/database/seed/run-seed.js)
 *   - Con tsx (pendiente):      pnpm exec tsx prisma/seed.ts [--publish] [--refresh]
 * La lógica vive en src/database/seed/ para compilarse y probarse con el resto del código.
 */
import { runSeed } from '../src/database/seed/run-seed.js';

await runSeed(process.argv.slice(2));
