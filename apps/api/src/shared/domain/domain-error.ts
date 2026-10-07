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
  | 'unavailable';

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
