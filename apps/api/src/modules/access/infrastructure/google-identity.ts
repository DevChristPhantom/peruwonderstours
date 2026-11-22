import { UnauthorizedError } from '../../../shared/domain/domain-error.js';

/** Identidad verificada de una cuenta de Google. */
export interface GoogleIdentity {
  subject: string;
  email: string;
  givenName: string | null;
  familyName: string | null;
}

export interface GoogleCodeExchange {
  code: string;
  codeVerifier: string;
  redirectUri: string;
  nonce: string;
}

export class GoogleSignInFailedError extends UnauthorizedError {
  constructor(reason: string) {
    super('google-sign-in-failed', 'No pudimos verificar tu cuenta de Google. Inténtalo de nuevo.', { reason });
  }
}

const TOKEN_ENDPOINT = 'https://oauth2.googleapis.com/token';
const ISSUERS = new Set(['https://accounts.google.com', 'accounts.google.com']);
/** Margen para relojes desfasados al validar `exp`/`iat`. */
const SKEW_SECONDS = 120;

function decodeSegment(segment: string): Record<string, unknown> {
  try {
    const json = Buffer.from(segment, 'base64url').toString('utf8');
    const value = JSON.parse(json) as unknown;
    if (value && typeof value === 'object' && !Array.isArray(value)) return value as Record<string, unknown>;
  } catch {
    /* cae al error de abajo */
  }
  throw new GoogleSignInFailedError('malformed-id-token');
}

const str = (v: unknown): string | null => (typeof v === 'string' && v.trim() ? v.trim() : null);

/**
 * Valida las afirmaciones del ID token. No verifica la firma: el token llega en la respuesta directa
 * del endpoint de tokens de Google por TLS (OpenID Connect Core §3.1.3.7, punto 6), así que el emisor
 * queda garantizado por el certificado del servidor. Sí se exigen `iss`, `aud`, vigencia, `nonce`
 * (anti-replay) y correo verificado.
 */
export function identityFromIdToken(idToken: string, expected: { clientId: string; nonce: string; nowSeconds: number }): GoogleIdentity {
  const parts = idToken.split('.');
  if (parts.length !== 3) throw new GoogleSignInFailedError('malformed-id-token');
  const claims = decodeSegment(parts[1]!);
  if (!ISSUERS.has(String(claims.iss))) throw new GoogleSignInFailedError('issuer');
  const aud = claims.aud;
  const audiences = Array.isArray(aud) ? aud : [aud];
  if (!audiences.includes(expected.clientId)) throw new GoogleSignInFailedError('audience');
  if (Array.isArray(aud) && aud.length > 1 && claims.azp !== expected.clientId) throw new GoogleSignInFailedError('authorized-party');
  const exp = Number(claims.exp);
  if (!Number.isFinite(exp) || exp + SKEW_SECONDS < expected.nowSeconds) throw new GoogleSignInFailedError('expired');
  const iat = Number(claims.iat);
  if (Number.isFinite(iat) && iat - SKEW_SECONDS > expected.nowSeconds) throw new GoogleSignInFailedError('issued-in-future');
  if (claims.nonce !== expected.nonce) throw new GoogleSignInFailedError('nonce');
  const email = str(claims.email)?.toLowerCase();
  const subject = str(claims.sub);
  if (!email || !subject) throw new GoogleSignInFailedError('missing-email');
  if (claims.email_verified !== true && claims.email_verified !== 'true') throw new GoogleSignInFailedError('email-not-verified');
  return { subject, email, givenName: str(claims.given_name), familyName: str(claims.family_name) };
}

export type FetchLike = (url: string, init: { method: string; headers: Record<string, string>; body: string; signal?: AbortSignal }) => Promise<{ ok: boolean; status: number; json(): Promise<unknown> }>;

/** Canjea el código de autorización (con PKCE) en Google y devuelve la identidad verificada. */
export class GoogleIdentityVerifier {
  constructor(
    private readonly options: { clientId: string; clientSecret: string },
    private readonly fetchImpl: FetchLike = fetch as unknown as FetchLike,
  ) {}

  async exchange(input: GoogleCodeExchange, now: Date): Promise<GoogleIdentity> {
    let res: Awaited<ReturnType<FetchLike>>;
    try {
      res = await this.fetchImpl(TOKEN_ENDPOINT, {
        method: 'POST',
        headers: { 'content-type': 'application/x-www-form-urlencoded', accept: 'application/json' },
        body: new URLSearchParams({
          grant_type: 'authorization_code',
          code: input.code,
          code_verifier: input.codeVerifier,
          redirect_uri: input.redirectUri,
          client_id: this.options.clientId,
          client_secret: this.options.clientSecret,
        }).toString(),
        signal: AbortSignal.timeout(10_000),
      });
    } catch {
      throw new GoogleSignInFailedError('token-endpoint-unreachable');
    }
    if (!res.ok) throw new GoogleSignInFailedError(`token-endpoint-${res.status}`);
    const body = (await res.json().catch(() => null)) as { id_token?: unknown } | null;
    const idToken = str(body?.id_token);
    if (!idToken) throw new GoogleSignInFailedError('missing-id-token');
    return identityFromIdToken(idToken, { clientId: this.options.clientId, nonce: input.nonce, nowSeconds: Math.floor(now.getTime() / 1000) });
  }
}
