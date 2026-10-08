import { defineConfig } from 'vitest/config';
import tsconfigPaths from 'vite-tsconfig-paths';

// Pruebas contra PostgreSQL real (DATABASE_URL en .env):
//  - *.int-spec.ts: repositorios en una transacción que se revierte (no deja filas en pwt_dev).
//  - *.db-e2e-spec.ts: API HTTP completa en modo prisma contra `pwt_test`, que globalSetup
//    recrea y migra en cada corrida (ver test/support/test-database.ts).
// Sin DATABASE_URL todas se omiten.
export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    globals: true,
    root: './',
    include: ['**/*.int-spec.ts', '**/*.db-e2e-spec.ts'],
    globalSetup: ['./test/support/db-global-setup.ts'],
    fileParallelism: false,
    testTimeout: 60_000,
    hookTimeout: 120_000,
  },
});
