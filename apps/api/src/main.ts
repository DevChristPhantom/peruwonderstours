import 'reflect-metadata';
import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';
import { configureApp } from './app.setup.js';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, { rawBody: true, bufferLogs: false });
  const settings = configureApp(app);
  await app.listen(settings.port);
  Logger.log(`API en http://localhost:${settings.port}/api/v1 (docs: /api/docs, datos: ${settings.dataSource})`, 'Bootstrap');
}

await bootstrap();
