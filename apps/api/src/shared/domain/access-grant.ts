import type { Locale } from '../../modules/catalog/domain/tour.js';
import { DomainError, NotFoundError, ValidationError } from './domain-error.js';

/**
 * Tokens opacos sin contraseña (Sprint 3, F0/F0b/F6/F7). Dos familias:
 *  - Enlaces mágicos (`*_link`): de UN solo uso; se canjean por una sesión.
 *  - Sesiones (`*_session`): token de acceso que el servidor de Next guarda en una cookie httpOnly.
 * En la base solo se guarda SHA-256(token) en hex (`access_tokens.token_hash`).
 */
export const ACCESS_TOKEN_PURPOSES = [
  'booking_link',
  'booking_session',
  'complaint_link',
  'complaint_session',
  'customer_login_link',
  'customer_session',
] as const;
export type AccessTokenPurpose = (typeof ACCESS_TOKEN_PURPOSES)[number];

export type LinkPurpose = Extract<AccessTokenPurpose, `${string}_link`>;
export type SessionPurpose = Extract<AccessTokenPurpose, `${string}_session`>;

/** Sesión que se emite al canjear cada tipo de enlace. */
export const SESSION_FOR_LINK: Readonly<Record<LinkPurpose, SessionPurpose>> = {
  booking_link: 'booking_session',
  complaint_link: 'complaint_session',
  customer_login_link: 'customer_session',
};

export interface AccessTokenRecord {
  id: string;
  purpose: AccessTokenPurpose;
  subjectId: string;
  tokenHash: string;
  locale: Locale;
  expiresAt: Date;
  consumedAt: Date | null;
  revokedAt: Date | null;
  lastUsedAt: Date | null;
  createdAt: Date;
}

/** Puerto de persistencia de `access_tokens` (dentro de una unidad de trabajo). */
export interface AccessTokenRepository {
  insert(record: AccessTokenRecord): Promise<void>;
  findByHash(tokenHash: string): Promise<AccessTokenRecord | null>;
  /**
   * Marca el token como consumido SOLO si aún no lo estaba (UPDATE ... WHERE consumed_at IS NULL).
   * Devuelve true si esta llamada lo consumió: dos canjes simultáneos no pueden ganar ambos.
   */
  consume(id: string, now: Date): Promise<boolean>;
  revoke(id: string, now: Date): Promise<void>;
  /** Revoca todas las sesiones vivas de un sujeto y propósito (p. ej. "cerrar todas"). */
  revokeAllForSubject(subjectId: string, purpose: AccessTokenPurpose, now: Date): Promise<number>;
  /** Último uso de una sesión (no se escribe más de una vez por minuto). */
  touch(id: string, now: Date): Promise<void>;
  /** Tokens creados para el sujeto desde `since` (límite de envíos por reserva/cliente). */
  countCreatedSince(subjectId: string, purpose: AccessTokenPurpose, since: Date): Promise<number>;
}

/** Estado de un token frente a un instante dado. */
export function accessTokenState(record: AccessTokenRecord, now: Date): 'active' | 'consumed' | 'revoked' | 'expired' {
  if (record.revokedAt) return 'revoked';
  if (record.consumedAt) return 'consumed';
  if (record.expiresAt.getTime() <= now.getTime()) return 'expired';
  return 'active';
}

export class InvalidAccessLinkError extends ValidationError {
  constructor() {
    super('invalid-access-link', 'El enlace no es válido. Revisa que lo copiaste completo.');
  }
}

export class AccessLinkNotFoundError extends NotFoundError {
  constructor() {
    super('access-link-not-found', 'Enlace no encontrado. Solicita uno nuevo.');
  }
}

/** 410: el enlace ya se usó, venció o fue revocado. */
export class AccessLinkExpiredError extends DomainError {
  constructor() {
    super('access-link-expired', 'Este enlace ya se usó o venció. Solicita uno nuevo.', 'gone');
  }
}
