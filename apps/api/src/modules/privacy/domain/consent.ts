import { createHmac, timingSafeEqual } from 'node:crypto';
import type { Locale } from '../../catalog/domain/tour.js';

/**
 * Consentimientos v2 (Ley 29733 y D.S. 016-2024-JUS; brain/wiki/normativa/proteccion-de-datos.md).
 * Una casilla por finalidad, desmarcada por defecto; revocación gratuita y tan simple como el
 * otorgamiento (enlace firmado en cada correo de marketing).
 */
export const CONSENT_PURPOSES = [
  'marketing_email',
  'marketing_whatsapp',
  'analytics_cookies',
  'advertising_cookies',
  'personalization',
  'sensitive_data_health',
  'testimonial_publication',
  'international_transfer',
] as const;
export type ConsentPurpose = (typeof CONSENT_PURPOSES)[number];

export const MARKETING_PURPOSES = ['marketing_email', 'marketing_whatsapp'] as const satisfies readonly ConsentPurpose[];
export type MarketingPurpose = (typeof MARKETING_PURPOSES)[number];

export const CONSENT_METHODS = ['checkbox', 'banner', 'email_link', 'otp_signature', 'staff_recorded'] as const;
export type ConsentMethod = (typeof CONSENT_METHODS)[number];

export const LEGAL_DOCUMENTS = ['privacy_policy_ack', 'terms_and_conditions', 'cancellation_policy'] as const;
export type LegalDocument = (typeof LEGAL_DOCUMENTS)[number];

export interface ConsentRecord {
  id: string;
  customerId: string | null;
  /** HMAC (clave PII) del correo normalizado. */
  subjectEmailHash: Uint8Array | null;
  anonymousId: string | null;
  purpose: ConsentPurpose;
  policyVersion: string;
  textHash: string | null;
  locale: Locale | null;
  granted: boolean;
  method: ConsentMethod;
  ip: string | null;
  userAgent: string | null;
  source: string;
  createdAt: Date;
}

export interface LegalAcceptanceRecord {
  id: string;
  customerId: string | null;
  bookingId: string | null;
  subjectEmailHash: Uint8Array;
  document: LegalDocument;
  documentVersion: string;
  textHash: string | null;
  locale: Locale | null;
  ip: string | null;
  userAgent: string | null;
  source: string;
  createdAt: Date;
}

export interface ConsentRepository {
  insert(record: ConsentRecord): Promise<void>;
  /** Último evento (otorgamiento o revocación) del titular para la finalidad. */
  latestBySubject(subjectEmailHash: Uint8Array, purpose: ConsentPurpose): Promise<ConsentRecord | null>;
  historyBySubject(subjectEmailHash: Uint8Array): Promise<ConsentRecord[]>;
}

export interface LegalAcceptanceRepository {
  insert(record: LegalAcceptanceRecord): Promise<void>;
  findByBooking(bookingId: string): Promise<LegalAcceptanceRecord[]>;
}

/** Normalización del correo antes del HMAC (misma regla que customers.email). */
export function normalizeSubjectEmail(email: string): string {
  return email.trim().toLowerCase();
}

// -----------------------------------------------------------------------------
// Enlace de baja firmado (sin correo en claro: solo el HMAC del titular)
// -----------------------------------------------------------------------------
export interface UnsubscribeClaims {
  /** HMAC del correo (hex). */
  subjectHash: string;
  purposes: MarketingPurpose[];
  /** Emisión (s epoch). */
  issuedAt: number;
}

const TOKEN_VERSION = 1;

/** `base64url(json).base64url(hmac-sha256)`; sin vencimiento (la baja debe funcionar siempre). */
export function signUnsubscribeToken(claims: UnsubscribeClaims, secret: string): string {
  const body = Buffer.from(JSON.stringify({ v: TOKEN_VERSION, s: claims.subjectHash, p: claims.purposes, iat: claims.issuedAt })).toString('base64url');
  const sig = createHmac('sha256', secret).update(`unsubscribe.${body}`).digest('base64url');
  return `${body}.${sig}`;
}

/** Devuelve null si la firma o el contenido no son válidos (comparación en tiempo constante). */
export function verifyUnsubscribeToken(token: string, secret: string): UnsubscribeClaims | null {
  if (typeof token !== 'string' || token.length > 1024) return null;
  const [body, sig, extra] = token.split('.');
  if (!body || !sig || extra !== undefined) return null;
  const expected = createHmac('sha256', secret).update(`unsubscribe.${body}`).digest();
  let given: Buffer;
  try {
    given = Buffer.from(sig, 'base64url');
  } catch {
    return null;
  }
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return null;
  try {
    const parsed = JSON.parse(Buffer.from(body, 'base64url').toString('utf8')) as { v?: number; s?: unknown; p?: unknown; iat?: unknown };
    if (parsed.v !== TOKEN_VERSION || typeof parsed.s !== 'string' || !/^[0-9a-f]{64}$/.test(parsed.s)) return null;
    const purposes = Array.isArray(parsed.p) ? parsed.p.filter((p): p is MarketingPurpose => (MARKETING_PURPOSES as readonly string[]).includes(p as string)) : [];
    if (purposes.length === 0 || typeof parsed.iat !== 'number') return null;
    return { subjectHash: parsed.s, purposes: [...new Set(purposes)], issuedAt: parsed.iat };
  } catch {
    return null;
  }
}
