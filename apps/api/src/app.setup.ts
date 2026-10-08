import { randomUUID } from 'node:crypto';
import { ValidationPipe, type INestApplication } from '@nestjs/common';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule, type OpenAPIObject } from '@nestjs/swagger';
import type { NextFunction, Request, Response } from 'express';
import helmet from 'helmet';
import { APP_SETTINGS, type AppSettings } from './config/app-settings.js';
import { BigIntSerializerInterceptor } from './shared/interface/bigint-serializer.interceptor.js';
import { ProblemDetailsFilter } from './shared/interface/problem-details.filter.js';
import { PROBLEM_CONTENT_TYPE, validationExceptionFactory } from './shared/interface/problem-details.js';

export const API_PREFIX = 'api/v1';
export const DOCS_PATH = 'api/docs';

/** Cabeceras que el front (servidor Next) envía y lee. */
const ALLOWED_HEADERS = ['Authorization', 'Content-Type', 'Idempotency-Key', 'X-Cart-Token', 'X-Booking-Token', 'X-Complaint-Token', 'X-Request-Id'];
const EXPOSED_HEADERS = ['Idempotent-Replayed', 'Location', 'Retry-After', 'Retry-After-strict'];

/** API JSON: nada que renderizar => CSP mínima que no permite cargar ningún recurso. */
const apiHelmet = helmet({
  contentSecurityPolicy: { useDefaults: false, directives: { defaultSrc: ["'none'"], frameAncestors: ["'none'"], baseUri: ["'none'"], formAction: ["'none'"] } },
  crossOriginResourcePolicy: { policy: 'same-site' },
  referrerPolicy: { policy: 'no-referrer' },
  frameguard: { action: 'deny' },
});

/** Swagger UI necesita sus scripts/estilos del mismo origen (solo fuera de producción). */
const docsHelmet = helmet({
  contentSecurityPolicy: {
    useDefaults: false,
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", 'data:'],
      frameAncestors: ["'none'"],
      baseUri: ["'self'"],
      formAction: ["'self'"],
    },
  },
  frameguard: { action: 'deny' },
});

/** Errores de body-parser (cuerpo grande o JSON inválido) también como problem+json. */
function bodyParserErrorHandler(error: unknown, req: Request, res: Response, next: NextFunction): void {
  const e = error as { type?: string; status?: number } | null;
  const status = e?.type === 'entity.too.large' ? 413 : e?.type === 'entity.parse.failed' ? 400 : e?.type ? (e.status ?? 400) : 0;
  if (!status) return next(error);
  const code = status === 413 ? 'payload-too-large' : 'malformed-body';
  res
    .status(status)
    .type(PROBLEM_CONTENT_TYPE)
    .send(
      JSON.stringify({
        type: 'about:blank',
        title: status === 413 ? 'Contenido demasiado grande' : 'Solicitud inválida',
        status,
        detail: status === 413 ? 'El cuerpo de la petición supera el tamaño permitido.' : 'El cuerpo de la petición no es JSON válido.',
        instance: req.originalUrl,
        code,
        traceId: (req.headers['x-request-id'] as string | undefined)?.slice(0, 64) ?? randomUUID(),
      }),
    );
}

/**
 * Configuración HTTP común a main.ts, a las pruebas e2e y a la exportación de OpenAPI.
 * La app debe crearse con `{ rawBody: true }` para verificar firmas de webhooks.
 */
export function configureApp(app: INestApplication): AppSettings {
  const settings = app.get<AppSettings>(APP_SETTINGS);
  const expressApp = app as NestExpressApplication;
  expressApp.disable('x-powered-by');
  expressApp.set('trust proxy', settings.trustProxy);

  app.use((req: Request, res: Response, next: NextFunction) =>
    req.path.startsWith(`/${DOCS_PATH}`) ? docsHelmet(req, res, next) : apiHelmet(req, res, next),
  );

  // Límite de tamaño del cuerpo (reemplaza los parsers por defecto de Nest; el cuerpo crudo
  // se conserva para las firmas de webhooks porque la app se crea con rawBody: true).
  const limit = `${settings.bodyLimitKb}kb`;
  expressApp.useBodyParser('json', { limit });
  expressApp.useBodyParser('urlencoded', { limit, extended: false });
  app.use(bodyParserErrorHandler);

  const allowed = new Set(settings.corsOrigins);
  app.enableCors({
    // Sin cabecera Origin (servidor a servidor, curl) no aplica CORS; con Origin, solo la allowlist.
    origin: (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => callback(null, !origin || allowed.has(origin)),
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ALLOWED_HEADERS,
    exposedHeaders: EXPOSED_HEADERS,
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
    SwaggerModule.setup(DOCS_PATH, app, buildOpenApiDocument(app), { jsonDocumentUrl: `${DOCS_PATH}/openapi.json` });
  }
  return settings;
}

/** Documento OpenAPI 3 de la API (Swagger UI y `pnpm openapi:export`). */
export function buildOpenApiDocument(app: INestApplication): OpenAPIObject {
  const config = new DocumentBuilder()
    .setTitle('Peru Wonders Tours API')
    .setDescription(
      'API v1. Montos en céntimos (enteros) + moneda ISO 4217. Fechas-hora en UTC (ISO 8601); fechas de viaje YYYY-MM-DD (America/Lima). ' +
        'Errores en RFC 9457 application/problem+json (campo `code` estable). Pensada para llamarse desde el servidor de Next: ' +
        '`X-Cart-Token` y `X-Booking-Token` son secretos del comprador y no deben exponerse al navegador ni a logs. ' +
        'Rate limiting por IP (429 + Retry-After).',
    )
    .setVersion('1.0.0')
    .addServer('/')
    .addBearerAuth({ type: 'http', scheme: 'bearer', bearerFormat: 'JWT', description: 'Access token del staff (POST /auth/staff/mfa/verify).' })
    .build();
  return SwaggerModule.createDocument(app, config);
}
