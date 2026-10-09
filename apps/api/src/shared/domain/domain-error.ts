/**
 * Categoría semántica del error de dominio. El dominio no conoce HTTP: la capa de
 * interfaz traduce cada categoría a un código de estado (ver problem-details.filter.ts).
 */
export type DomainErrorKind =
  | 'validation'
  | 'not_found'
  | 'conflict'
  | 'gone'
  | 'unprocessable'
  | 'unauthorized'
  | 'precondition_required'
  | 'unavailable'
  | 'forbidden'
  | 'rate_limited';

/**
 * Error de negocio con código estable (kebab-case, inglés) y mensaje para el usuario
 * (español, es-PE). El código se publica como `type` de problem+json (RFC 9457).
 */
export class DomainError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly kind: DomainErrorKind,
    readonly details: Record<string, unknown> = {},
  ) {
    super(message);
    this.name = new.target.name;
  }
}

export class ValidationError extends DomainError {
  constructor(code: string, message: string, details: Record<string, unknown> = {}) {
    super(code, message, 'validation', details);
  }
}

export class NotFoundError extends DomainError {
  constructor(code: string, message: string, details: Record<string, unknown> = {}) {
    super(code, message, 'not_found', details);
  }
}

export class ConflictError extends DomainError {
  constructor(code: string, message: string, details: Record<string, unknown> = {}) {
    super(code, message, 'conflict', details);
  }
}

export class BusinessRuleError extends DomainError {
  constructor(code: string, message: string, details: Record<string, unknown> = {}) {
    super(code, message, 'unprocessable', details);
  }
}

/** Conflicto de concurrencia (bloqueo optimista / serialización). Reintentable. */
export class ConcurrencyError extends DomainError {
  constructor(message = 'El recurso fue modificado por otra operación. Intenta de nuevo.') {
    super('concurrency-conflict', message, 'conflict');
  }
}

/** Autenticado pero sin permiso para la acción (403). */
export class ForbiddenError extends DomainError {
  constructor(code: string, message: string, details: Record<string, unknown> = {}) {
    super(code, message, 'forbidden', details);
  }
}

/** Sin credenciales válidas (401). */
export class UnauthorizedError extends DomainError {
  constructor(code: string, message: string, details: Record<string, unknown> = {}) {
    super(code, message, 'unauthorized', details);
  }
}

/** Demasiados intentos (429). `details.retryAfterSeconds` se publica en la cabecera Retry-After. */
export class RateLimitedError extends DomainError {
  constructor(code: string, message: string, retryAfterSeconds: number) {
    super(code, message, 'rate_limited', { retryAfterSeconds });
  }
}

/** Funcionalidad que requiere un recurso no disponible en este modo (503). */
export class ServiceUnavailableError extends DomainError {
  constructor(code: string, message: string) {
    super(code, message, 'unavailable');
  }
}
