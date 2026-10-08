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

function isStrict(context: ExecutionContext): boolean {
  return (
    Reflect.getMetadata(STRICT_THROTTLE, context.getHandler()) === true || Reflect.getMetadata(STRICT_THROTTLE, context.getClass()) === true
  );
}

export interface ThrottleSettings {
  ttlSeconds: number;
  limit: number;
  strictLimit: number;
}

export function throttlerOptions(settings: ThrottleSettings): ThrottlerModuleOptions {
  const ttl = settings.ttlSeconds * 1000;
  return {
    errorMessage: 'Demasiadas solicitudes. Espera un momento e inténtalo de nuevo.',
    throttlers: [
      { name: 'default', ttl, limit: settings.limit },
      { name: 'strict', ttl, limit: settings.strictLimit, skipIf: (context) => !isStrict(context) },
    ],
  };
}
