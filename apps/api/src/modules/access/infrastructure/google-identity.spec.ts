import { describe, expect, it, vi } from 'vitest';
import { GoogleIdentityVerifier, GoogleSignInFailedError, identityFromIdToken, type FetchLike } from './google-identity.js';

const CLIENT = '123456789-abc123.apps.googleusercontent.com';
const NOW = 1_800_000_000;
const NONCE = 'n0nce-value-of-sufficient-length';

function token(claims: Record<string, unknown>): string {
  const enc = (v: unknown) => Buffer.from(JSON.stringify(v)).toString('base64url');
  return `${enc({ alg: 'RS256' })}.${enc(claims)}.firma`;
}

const valid = {
  iss: 'https://accounts.google.com',
  aud: CLIENT,
  sub: '1098765',
  email: 'Viajero@Gmail.com',
  email_verified: true,
  given_name: 'Ana',
  family_name: 'Quispe',
  iat: NOW - 10,
  exp: NOW + 3600,
  nonce: NONCE,
};
const expected = { clientId: CLIENT, nonce: NONCE, nowSeconds: NOW };

function reasonOf(fn: () => unknown): string | undefined {
  try {
    fn();
  } catch (error) {
    expect(error).toBeInstanceOf(GoogleSignInFailedError);
    return (error as GoogleSignInFailedError).details.reason as string;
  }
  return undefined;
}

describe('identityFromIdToken', () => {
  it('devuelve la identidad con el correo en minúsculas', () => {
    expect(identityFromIdToken(token(valid), expected)).toEqual({ subject: '1098765', email: 'viajero@gmail.com', givenName: 'Ana', familyName: 'Quispe' });
  });

  it.each([
    ['issuer', { iss: 'https://evil.example' }],
    ['audience', { aud: 'otro-cliente.apps.googleusercontent.com' }],
    ['expired', { exp: NOW - 3600 }],
    ['issued-in-future', { iat: NOW + 3600 }],
    ['nonce', { nonce: 'otro' }],
    ['email-not-verified', { email_verified: false }],
    ['missing-email', { email: undefined }],
  ])('rechaza %s', (reason, override) => {
    expect(reasonOf(() => identityFromIdToken(token({ ...valid, ...override }), expected))).toBe(reason);
  });

  it('rechaza un token mal formado', () => {
    expect(reasonOf(() => identityFromIdToken('no-es-jwt', expected))).toBe('malformed-id-token');
    expect(reasonOf(() => identityFromIdToken('a.@@@.c', expected))).toBe('malformed-id-token');
  });
});

describe('GoogleIdentityVerifier', () => {
  const input = { code: 'codigo-de-google', codeVerifier: 'v'.repeat(43), redirectUri: 'https://peruwonderstours.com/api/auth/google/callback', nonce: NONCE };

  it('envía el código con PKCE y el secreto, y valida el ID token', async () => {
    const fetchImpl = vi.fn<FetchLike>(async () => ({ ok: true, status: 200, json: async () => ({ id_token: token(valid) }) }));
    const verifier = new GoogleIdentityVerifier({ clientId: CLIENT, clientSecret: 'secreto-de-prueba-123' }, fetchImpl);
    const identity = await verifier.exchange(input, new Date(NOW * 1000));
    expect(identity.email).toBe('viajero@gmail.com');
    const [url, init] = fetchImpl.mock.calls[0]!;
    expect(url).toBe('https://oauth2.googleapis.com/token');
    const form = new URLSearchParams(init.body);
    expect(form.get('code_verifier')).toBe(input.codeVerifier);
    expect(form.get('redirect_uri')).toBe(input.redirectUri);
    expect(form.get('client_secret')).toBe('secreto-de-prueba-123');
  });

  it('falla si Google rechaza el código', async () => {
    const fetchImpl = vi.fn<FetchLike>(async () => ({ ok: false, status: 400, json: async () => ({ error: 'invalid_grant' }) }));
    const verifier = new GoogleIdentityVerifier({ clientId: CLIENT, clientSecret: 'secreto-de-prueba-123' }, fetchImpl);
    await expect(verifier.exchange(input, new Date(NOW * 1000))).rejects.toBeInstanceOf(GoogleSignInFailedError);
  });
});
