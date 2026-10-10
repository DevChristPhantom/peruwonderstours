import { SetMetadata, type ExecutionContext } from '@nestjs/common';
import type { ThrottlerModuleOptions } from '@nestjs/throttler';

/**
 * Rate limiting (@nestjs/throttler 6, compatible con Nest 12):
 * - `default`: límite global por IP de cliente para toda la API.
 * - `strict`: límite adicional solo en escrituras sensibles marcadas con `@StrictThrottle()`
 *   (checkout, pagos y, cuando exista, el Libro de Reclamaciones).
 * La IP sale de `req.ip`, que respeta `TRUST_PROXY`: si el servidor de Next llama a la API,
 * debe reenviar la IP del visitante en `X-Forwarded-For` y la API debe confiar en ese salto.
 * Almacenamiento en memoria del proceso (una instancia). Con varias réplicas: storage Redis.
 */
export const STRICT_THROTTLE = 'pwt:strict-throttle';

/** Aplica también el límite estricto (`THROTTLE_STRICT_LIMIT` por ventana). */
export const StrictThrottle = (): MethodDecorator & ClassDecorator => SetMetadata(STRICT_THROTTLE, true);

export const LINK_THROTTLE = 'pwt:link-throttle';

/**
 * Formularios públicos que disparan correos (enlaces mágicos, contacto, testimonios): límite propio
 * por IP (`THROTTLE_LINK_LIMIT` por `THROTTLE_LINK_TTL_SECONDS`), además del estricto y el global.
 */
export const LinkThrottle = (): MethodDecorator & ClassDecorator => SetMetadata(LINK_THROTTLE, true);

function hasFlag(context: ExecutionContext, key: string): boolean {
  return Reflect.getMetadata(key, context.getHandler()) === true || Reflect.getMetadata(key, context.getClass()) === true;
}

function isStrict(context: ExecutionContext): boolean {
  return hasFlag(context, STRICT_THROTTLE) || hasFlag(context, LINK_THROTTLE);
}

export interface ThrottleSettings {
  ttlSeconds: number;
  limit: number;
  strictLimit: number;
  linkLimit?: number;
  linkTtlSeconds?: number;
}

export function throttlerOptions(settings: ThrottleSettings): ThrottlerModuleOptions {
  const ttl = settings.ttlSeconds * 1000;
  return {
    errorMessage: 'Demasiadas solicitudes. Espera un momento e inténtalo de nuevo.',
    throttlers: [
      { name: 'default', ttl, limit: settings.limit },
      { name: 'strict', ttl, limit: settings.strictLimit, skipIf: (context) => !isStrict(context) },
      {
        name: 'link',
        ttl: (settings.linkTtlSeconds ?? 600) * 1000,
        limit: settings.linkLimit ?? 5,
        skipIf: (context) => !hasFlag(context, LINK_THROTTLE),
      },
    ],
  };
}
