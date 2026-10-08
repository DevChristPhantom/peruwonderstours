import { recreateTestDatabase } from './test-database.js';

/** globalSetup de `pnpm test:integration`: recrea y migra `pwt_test` una vez por corrida. */
export default async function setup(): Promise<void> {
  const url = await recreateTestDatabase();
  if (!url) console.warn('[db-global-setup] Sin DATABASE_URL: se omiten las pruebas con PostgreSQL.');
}
