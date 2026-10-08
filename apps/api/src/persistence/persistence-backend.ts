import { Logger } from '@nestjs/common';
import type { AppSettings } from '../config/app-settings.js';
import type { PrismaClient } from '../generated/prisma/client.js';
import type { UnitOfWork } from '../shared/application/unit-of-work.js';
import { toLimaCalendarDate } from '../shared/domain/calendar-date.js';
import type { Clock } from '../shared/domain/ports.js';
import type { CatalogRepository } from '../modules/catalog/domain/catalog.repository.js';
import { InMemoryCatalogRepository } from '../modules/catalog/infrastructure/in-memory-catalog.repository.js';
import { generateDemoPricing } from '../modules/catalog/infrastructure/seed/demo-pricing.js';
import { readSeedBundle } from '../modules/catalog/infrastructure/seed/seed-files.js';
import { mapSeedCatalog } from '../modules/catalog/infrastructure/seed/seed-mapper.js';
import { InMemoryDataStore } from './in-memory/in-memory-data-store.js';
import { InMemoryUnitOfWork } from './in-memory/in-memory-unit-of-work.js';

/** Implementación de persistencia elegida por DATA_SOURCE. */
export interface PersistenceBackend {
  kind: 'prisma' | 'seed' | 'memory';
  unitOfWork: UnitOfWork;
  catalog: CatalogRepository;
  /** Cliente PostgreSQL (solo `prisma`): backoffice, auth del staff y consultas de reporte. */
  prisma: PrismaClient | null;
  /** Almacén en memoria (solo `seed`/`memory`): auth del staff en modo demo/pruebas. */
  memory: InMemoryDataStore | null;
  ping(): Promise<void>;
  close(): Promise<void>;
}

export function inMemoryBackend(store: InMemoryDataStore, kind: 'seed' | 'memory' = 'memory'): PersistenceBackend {
  return {
    kind,
    unitOfWork: new InMemoryUnitOfWork(store),
    catalog: new InMemoryCatalogRepository(store.catalog),
    prisma: null,
    memory: store,
    ping: () => Promise.resolve(),
    close: () => Promise.resolve(),
  };
}

/** Modo demo: catálogo de data/seed publicado en memoria (+ precios/salidas ficticios opcionales). */
export async function buildSeedStore(settings: Pick<AppSettings, 'seedDataDir' | 'demoPricing'>, clock: Clock): Promise<InMemoryDataStore> {
  const bundle = await readSeedBundle(settings.seedDataDir);
  const catalog = mapSeedCatalog(bundle, { publish: true, publishedAt: clock.now() });
  if (!settings.demoPricing) return new InMemoryDataStore(catalog);
  const demo = generateDemoPricing(catalog.tours, { today: toLimaCalendarDate(clock.now()), departureDays: 180, capacity: 12 });
  return new InMemoryDataStore({ ...catalog, rates: demo.rates }, demo.departures);
}

export async function createPersistenceBackend(settings: AppSettings, clock: Clock): Promise<PersistenceBackend> {
  const logger = new Logger('Persistence');
  if (settings.dataSource === 'memory') return inMemoryBackend(new InMemoryDataStore());
  if (settings.dataSource === 'seed') {
    const store = await buildSeedStore(settings, clock);
    logger.log(`Modo seed: ${store.catalog.tours.length} tours en memoria${settings.demoPricing ? ' con precios/salidas FICTICIOS' : ''}.`);
    return inMemoryBackend(store, 'seed');
  }
  // Import diferido: el cliente Prisma solo se carga cuando se usa PostgreSQL.
  const { createPrismaClient } = await import('./prisma/prisma-client.js');
  const { PrismaUnitOfWork } = await import('./prisma/prisma-unit-of-work.js');
  const { PrismaCatalogRepository } = await import('../modules/catalog/infrastructure/prisma-catalog.repository.js');
  const client = createPrismaClient(settings.databaseUrl!);
  await client.$connect();
  logger.log('Conectado a PostgreSQL.');
  return {
    kind: 'prisma',
    unitOfWork: new PrismaUnitOfWork(client),
    catalog: new PrismaCatalogRepository(client),
    prisma: client,
    memory: null,
    ping: async () => {
      await client.$queryRaw`SELECT 1`;
    },
    close: () => client.$disconnect(),
  };
}
