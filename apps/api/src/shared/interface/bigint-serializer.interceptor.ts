import { Injectable, Logger, type CallHandler, type ExecutionContext, type NestInterceptor } from '@nestjs/common';
import { map, type Observable } from 'rxjs';

const MAX_SAFE = BigInt(Number.MAX_SAFE_INTEGER);
const MIN_SAFE = BigInt(Number.MIN_SAFE_INTEGER);
const logger = new Logger('BigIntSerializer');

/**
 * Convierte recursivamente `bigint` a JSON: número entero si es seguro en JS (todos los
 * montos reales en céntimos lo son) y, si no, string para no perder precisión.
 * Respeta `toJSON()` (Money, Date) antes de recorrer.
 */
export function toJsonSafe(value: unknown, depth = 0): unknown {
  if (depth > 64) return value;
  if (typeof value === 'bigint') {
    if (value <= MAX_SAFE && value >= MIN_SAFE) return Number(value);
    logger.warn('bigint fuera del rango seguro serializado como string');
    return value.toString();
  }
  if (value === null || typeof value !== 'object') return value;
  if (value instanceof Date) return value;
  if (Buffer.isBuffer(value)) return value;
  const withToJson = value as { toJSON?: () => unknown };
  if (typeof withToJson.toJSON === 'function') return toJsonSafe(withToJson.toJSON(), depth + 1);
  if (Array.isArray(value)) return value.map((v) => toJsonSafe(v, depth + 1));
  if (value instanceof Map) return Object.fromEntries([...value.entries()].map(([k, v]) => [String(k), toJsonSafe(v, depth + 1)]));
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(value)) out[k] = toJsonSafe(v, depth + 1);
  return out;
}

/** Serializador global de respuestas (registrado en app.setup.ts). */
@Injectable()
export class BigIntSerializerInterceptor implements NestInterceptor {
  intercept(_context: ExecutionContext, next: CallHandler): Observable<unknown> {
    return next.handle().pipe(map((data: unknown) => toJsonSafe(data)));
  }
}
