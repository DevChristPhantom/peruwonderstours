import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';

/**
 * Tokens opacos de acceso sin cuenta (reserva, hoja de reclamación): 256 bits aleatorios
 * en base64url (43 caracteres). En la base solo se guarda SHA-256(token) en hex.
 */
const TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/;
const HASH_PATTERN = /^[0-9a-f]{64}$/;
/** Hash de relleno para comparar en tiempo constante aunque el recurso no exista. */
const DUMMY_HASH = Buffer.alloc(32);

export function hashAccessToken(token: string): string {
  return createHash('sha256').update(token, 'utf8').digest('hex');
}

export function generateAccessToken(): { token: string; tokenHash: string } {
  const token = randomBytes(32).toString('base64url');
  return { token, tokenHash: hashAccessToken(token) };
}

export function isWellFormedAccessToken(token: string | undefined | null): token is string {
  return typeof token === 'string' && TOKEN_PATTERN.test(token);
}

/** Comparación en tiempo constante; siempre ejecuta `timingSafeEqual` (también sin hash guardado). */
export function accessTokenMatches(token: string, expectedHash: string | null): boolean {
  const actual = createHash('sha256').update(token, 'utf8').digest();
  const expected = expectedHash && HASH_PATTERN.test(expectedHash) ? Buffer.from(expectedHash, 'hex') : DUMMY_HASH;
  const equal = timingSafeEqual(actual, expected);
  return equal && expected !== DUMMY_HASH;
}
