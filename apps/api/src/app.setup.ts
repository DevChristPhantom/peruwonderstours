import { ValidationPipe, type INestApplication } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import type { NextFunction, Request, Response } from 'express';
import { APP_SETTINGS, type AppSettings } from './config/app-settings.js';
import { BigIntSerializerInterceptor } from './shared/interface/bigint-serializer.interceptor.js';
import { ProblemDetailsFilter } from './shared/interface/problem-details.filter.js';
import { validationExceptionFactory } from './shared/interface/problem-details.js';

export const API_PREFIX = 'api/v1';

/**
 * Configuración HTTP común a main.ts y a las pruebas e2e. La app debe crearse con
 * `{ rawBody: true }` para verificar firmas de webhooks.
 */
export function configureApp(app: INestApplication): AppSettings {
  const settings = app.get<AppSettings>(APP_SETTINGS);
  const http = app.getHttpAdapter().getInstance() as { disable?: (setting: string) => void; set?: (k: string, v: unknown) => void };
  http.disable?.('x-powered-by');
  http.set?.('trust proxy', 1);

  // Cabeceras mínimas mientras se instala `helmet` (pendiente de dependencia).
  app.use((_req: Request, res: Response, next: NextFunction) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
    next();
  });

  app.enableCors({
    origin: settings.corsOrigins,
    methods: ['GET', 'POST', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Idempotency-Key', 'X-Cart-Token', 'X-Request-Id'],
    exposedHeaders: ['Idempotent-Replayed', 'Location'],
    credentials: true,
    maxAge: 600,
  });

  app.setGlobalPrefix(API_PREFIX);
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: false },
      exceptionFactory: validationExceptionFactory,
    }),
  );
  app.useGlobalFilters(new ProblemDetailsFilter(settings.problemTypeBaseUrl));
  app.useGlobalInterceptors(new BigIntSerializerInterceptor());
  app.enableShutdownHooks();

  if (settings.swaggerEnabled) {
    const config = new DocumentBuilder()
      .setTitle('Peru Wonders Tours API')
      .setDescription(
        'API v1. Montos en céntimos (enteros) + moneda ISO 4217. Fechas-hora en UTC (ISO 8601); fechas de viaje YYYY-MM-DD (America/Lima). ' +
          'Errores en RFC 9457 application/problem+json.',
      )
      .setVersion('1.0.0')
      .addServer('/')
      .build();
    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup('api/docs', app, document, { jsonDocumentUrl: 'api/docs/openapi.json' });
  }
  return settings;
}
