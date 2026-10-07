import { defineConfig } from 'vitest/config';
import tsconfigPaths from 'vite-tsconfig-paths';

// Pruebas de integración contra PostgreSQL real (DATABASE_URL en .env). Cada prueba corre
// dentro de una transacción que se revierte: no deja filas en la base.
export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    globals: true,
    root: './',
    include: ['**/*.int-spec.ts'],
    fileParallelism: false,
    testTimeout: 30_000,
  },
});
