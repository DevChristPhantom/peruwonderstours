import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';

/** Token opaco de carrito anónimo: 256 bits aleatorios; en la base solo se guarda su SHA-256. */
export function generateCartToken(): { token: string; tokenHash: string } {
  const token = randomBytes(32).toString('base64url');
  return { token, tokenHash: hashCartToken(token) };
}

export function hashCartToken(token: string): string {
  return createHash('sha256').update(token, 'utf8').digest('hex');
}

export function cartTokenMatches(token: string | undefined, expectedHash: string): boolean {
  if (!token || token.length > 128) return false;
  const actual = Buffer.from(hashCartToken(token), 'hex');
  const expected = Buffer.from(expectedHash, 'hex');
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}
