import 'reflect-metadata';
import { writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';

/**
 * `pnpm openapi:export`: genera `apps/api/openapi.json` (contrato para que el frontend
 * genere tipos). No abre puertos ni toca la base: arranca la app en modo `memory` con
 * valores ficticios, construye el documento y termina. Debe ejecutarse sobre `dist/`
 * (necesita la metadata de decoradores que emite `tsc`).
 */
async function exportOpenApi(): Promise<void> {
  Object.assign(process.env, {
    NODE_ENV: 'test',
    DATA_SOURCE: 'memory',
    DEMO_PRICING: 'false',
    SWAGGER_ENABLED: 'false',
    SANDBOX_WEBHOOK_SECRET: 'openapi-export-placeholder-secret',
  });
  // Import diferido: ConfigModule.forRoot valida el entorno al importar el módulo.
  const { AppModule } = await import('../app.module.js');
  const { buildOpenApiDocument, configureApp } = await import('../app.setup.js');
  const app = await NestFactory.create(AppModule, { rawBody: true, logger: ['error', 'warn'] });
  configureApp(app);
  await app.init();
  const document = buildOpenApiDocument(app);
  await app.close();
  const target = resolve(process.argv[2] ?? 'openapi.json');
  await writeFile(target, `${JSON.stringify(document, null, 2)}\n`, 'utf8');
  Logger.log(`OpenAPI ${document.openapi}: ${Object.keys(document.paths).length} rutas -> ${target}`, 'OpenAPI');
}

await exportOpenApi();
