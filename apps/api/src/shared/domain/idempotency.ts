import { DomainError, ValidationError } from './domain-error.js';

/**
 * Registro de idempotencia de una operación de escritura crítica.
 * `fingerprint` = hash del cuerpo de la petición: la misma clave con otro cuerpo se rechaza.
 */
export interface IdempotencyRecord {
  scope: string;
  key: string;
  fingerprint: string;
  /** Id del recurso creado (p. ej. booking.id) para reconstruir la respuesta. */
  resourceId: string;
  createdAt: Date;
  expiresAt: Date;
}

export interface IdempotencyRepository {
  find(scope: string, key: string): Promise<IdempotencyRecord | null>;
  /** Inserta; lanza IdempotencyConflictError si (scope, key) ya existe. */
  insert(record: IdempotencyRecord): Promise<void>;
}

const KEY_PATTERN = /^[A-Za-z0-9._:-]{8,100}$/;

export class IdempotencyKeyRequiredError extends ValidationError {
  constructor() {
    super(
      'idempotency-key-required',
      'Falta la cabecera Idempotency-Key (8 a 100 caracteres: letras, números, ".", "_", ":" o "-").',
    );
  }
}

export class IdempotencyKeyReusedError extends DomainError {
  constructor(key: string) {
    super('idempotency-key-reused', 'La Idempotency-Key ya se usó con otra petición.', 'unprocessable', { key });
  }
}

/** Otra petición con la misma clave se está procesando o acaba de confirmarse. */
export class IdempotencyConflictError extends DomainError {
  constructor(key: string) {
    super('idempotency-in-progress', 'Ya hay una petición en curso con esta Idempotency-Key. Reintenta en unos segundos.', 'conflict', {
      key,
    });
  }
}

export function assertIdempotencyKey(key: string | undefined | null): string {
  if (!key || !KEY_PATTERN.test(key)) throw new IdempotencyKeyRequiredError();
  return key;
}
