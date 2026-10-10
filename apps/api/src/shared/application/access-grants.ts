import type { Locale } from '../../modules/catalog/domain/tour.js';
import {
  AccessLinkExpiredError,
  AccessLinkNotFoundError,
  accessTokenState,
  InvalidAccessLinkError,
  SESSION_FOR_LINK,
  type AccessTokenPurpose,
  type AccessTokenRecord,
  type LinkPurpose,
  type SessionPurpose,
} from '../domain/access-grant.js';
import type { IdGenerator } from '../domain/ports.js';
import { generateAccessToken, hashAccessToken, isWellFormedAccessToken } from './access-token.js';
import type { TransactionalRepositories } from './unit-of-work.js';

/** Vigencias (configurables por entorno; ver AccessSettings en app-settings). */
export interface AccessSettings {
  /** Enlace pedido por el usuario (recuperar reserva, consulta de reclamo, login): 30 min. */
  requestedLinkTtlMinutes: number;
  /** Enlace incluido en correos transaccionales (voucher, recordatorio, pago): horas. */
  emailLinkTtlHours: number;
  /** Sesión de acceso a una reserva u hoja de reclamo desde otro dispositivo: días. */
  resourceSessionTtlDays: number;
  /** Sesión de cliente ("Mis reservas"): días. */
  customerSessionTtlDays: number;
  /** Enlaces pedidos por sujeto y hora (además del rate limit por IP). */
  maxLinksPerHour: number;
}

export const DEFAULT_ACCESS_SETTINGS: AccessSettings = {
  requestedLinkTtlMinutes: 30,
  emailLinkTtlHours: 72,
  resourceSessionTtlDays: 30,
  customerSessionTtlDays: 30,
  maxLinksPerHour: 5,
};

export interface IssuedToken {
  token: string;
  record: AccessTokenRecord;
}

/** Emite un token nuevo (enlace o sesión); devuelve el secreto una sola vez. */
export async function issueAccessToken(
  repos: TransactionalRepositories,
  ids: IdGenerator,
  params: { purpose: AccessTokenPurpose; subjectId: string; locale: Locale; ttlMs: number; now: Date },
): Promise<IssuedToken> {
  const { token, tokenHash } = generateAccessToken();
  const record: AccessTokenRecord = {
    id: ids.next(),
    purpose: params.purpose,
    subjectId: params.subjectId,
    tokenHash,
    locale: params.locale,
    expiresAt: new Date(params.now.getTime() + params.ttlMs),
    consumedAt: null,
    revokedAt: null,
    lastUsedAt: null,
    createdAt: params.now,
  };
  await repos.accessTokens.insert(record);
  return { token, record };
}

/**
 * Canjea un enlace de un solo uso por una sesión del mismo recurso.
 *  - formato inválido -> 400 `invalid-access-link`
 *  - inexistente o de otro tipo -> 404 `access-link-not-found`
 *  - ya usado, vencido o revocado -> 410 `access-link-expired`
 */
export async function redeemAccessLink(
  repos: TransactionalRepositories,
  ids: IdGenerator,
  params: { token: string; purpose: LinkPurpose; sessionTtlMs: number; now: Date },
): Promise<{ link: AccessTokenRecord; session: IssuedToken }> {
  if (!isWellFormedAccessToken(params.token)) throw new InvalidAccessLinkError();
  const link = await repos.accessTokens.findByHash(hashAccessToken(params.token));
  if (!link || link.purpose !== params.purpose) throw new AccessLinkNotFoundError();
  if (accessTokenState(link, params.now) !== 'active') throw new AccessLinkExpiredError();
  // Consumo atómico: si otra petición lo canjeó a la vez, esta pierde (410).
  if (!(await repos.accessTokens.consume(link.id, params.now))) throw new AccessLinkExpiredError();
  const session = await issueAccessToken(repos, ids, {
    purpose: SESSION_FOR_LINK[params.purpose],
    subjectId: link.subjectId,
    locale: link.locale,
    ttlMs: params.sessionTtlMs,
    now: params.now,
  });
  return { link, session };
}

/** Sesión viva por token (o null). No distingue causas: el llamador responde 401/404 genérico. */
export async function resolveSession(
  repos: TransactionalRepositories,
  params: { token: string | null | undefined; purpose: SessionPurpose; now: Date },
): Promise<AccessTokenRecord | null> {
  if (!isWellFormedAccessToken(params.token)) return null;
  const record = await repos.accessTokens.findByHash(hashAccessToken(params.token));
  if (!record || record.purpose !== params.purpose || accessTokenState(record, params.now) !== 'active') return null;
  return record;
}

/** ¿El token es una sesión viva del sujeto indicado? */
export async function sessionGrantsAccess(
  repos: TransactionalRepositories,
  params: { token: string; purpose: SessionPurpose; subjectId: string; now: Date },
): Promise<boolean> {
  const record = await resolveSession(repos, params);
  return record !== null && record.subjectId === params.subjectId;
}

export const MINUTE_MS = 60_000;
export const HOUR_MS = 60 * MINUTE_MS;
export const DAY_MS = 24 * HOUR_MS;
