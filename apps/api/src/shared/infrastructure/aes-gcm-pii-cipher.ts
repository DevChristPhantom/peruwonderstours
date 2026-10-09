import { createCipheriv, createDecipheriv, createHmac, hkdfSync, randomBytes } from 'node:crypto';
import type { PiiCipher } from '../application/pii-cipher.js';

const VERSION = 0x01;
/** v2: con AAD (contexto tabla:columna:id). */
const VERSION_AAD = 0x02;
const IV_BYTES = 12;
const TAG_BYTES = 16;

/**
 * AES-256-GCM con subclaves HKDF-SHA256 de una clave maestra de 32 bytes
 * (`PII_ENCRYPTION_KEY`, base64). Formato: versión(1) | IV(12) | tag(16) | texto cifrado.
 * El hash es HMAC-SHA256 con otra subclave (no reversible, determinista).
 * Rotación de claves: el byte de versión permite convivir con una clave nueva.
 */
export class AesGcmPiiCipher implements PiiCipher {
  private readonly encKey: Buffer;
  private readonly hashKey: Buffer;

  constructor(masterKey: Buffer) {
    if (masterKey.length !== 32) throw new Error('PII_ENCRYPTION_KEY debe ser de 32 bytes (base64).');
    this.encKey = Buffer.from(hkdfSync('sha256', masterKey, Buffer.alloc(0), 'pwt:pii:enc:v1', 32));
    this.hashKey = Buffer.from(hkdfSync('sha256', masterKey, Buffer.alloc(0), 'pwt:pii:hash:v1', 32));
  }

  static fromBase64(value: string): AesGcmPiiCipher {
    return new AesGcmPiiCipher(Buffer.from(value, 'base64'));
  }

  encrypt(plaintext: string, aad?: string): Uint8Array {
    const iv = randomBytes(IV_BYTES);
    const cipher = createCipheriv('aes-256-gcm', this.encKey, iv);
    if (aad !== undefined) cipher.setAAD(Buffer.from(aad, 'utf8'));
    const body = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
    return Buffer.concat([Buffer.from([aad !== undefined ? VERSION_AAD : VERSION]), iv, cipher.getAuthTag(), body]);
  }

  decrypt(ciphertext: Uint8Array, aad?: string): string {
    const data = Buffer.from(ciphertext);
    const version = data[0];
    if (data.length < 1 + IV_BYTES + TAG_BYTES || (version !== VERSION && version !== VERSION_AAD)) throw new Error('Dato cifrado con formato o versión desconocida.');
    const iv = data.subarray(1, 1 + IV_BYTES);
    const tag = data.subarray(1 + IV_BYTES, 1 + IV_BYTES + TAG_BYTES);
    const decipher = createDecipheriv('aes-256-gcm', this.encKey, iv);
    // v1 (anterior, sin AAD) se sigue leyendo; v2 exige el mismo contexto con el que se cifró.
    if (version === VERSION_AAD) decipher.setAAD(Buffer.from(aad ?? '', 'utf8'));
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(data.subarray(1 + IV_BYTES + TAG_BYTES)), decipher.final()]).toString('utf8');
  }

  hash(value: string): Uint8Array {
    return createHmac('sha256', this.hashKey).update(value, 'utf8').digest();
  }
}

/**
 * Clave fija SOLO para desarrollo/pruebas cuando no se define PII_ENCRYPTION_KEY
 * (la validación del entorno la exige en producción). Nunca usar con datos reales.
 */
export const DEVELOPMENT_PII_KEY_BASE64 = Buffer.from('pwt-dev-only-pii-key-not-secret!', 'utf8').toString('base64');
