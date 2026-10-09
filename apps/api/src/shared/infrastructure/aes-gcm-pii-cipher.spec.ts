import { AesGcmPiiCipher, DEVELOPMENT_PII_KEY_BASE64 } from './aes-gcm-pii-cipher.js';

describe('AesGcmPiiCipher con AAD (H-19)', () => {
  const cipher = AesGcmPiiCipher.fromBase64(DEVELOPMENT_PII_KEY_BASE64);

  it('v2 con AAD: solo descifra con el mismo contexto', () => {
    const enc = cipher.encrypt('45678912', 'complaints:consumer_doc_enc:abc');
    expect(enc[0]).toBe(0x02);
    expect(cipher.decrypt(enc, 'complaints:consumer_doc_enc:abc')).toBe('45678912');
    expect(() => cipher.decrypt(enc, 'complaints:consumer_doc_enc:otro-id')).toThrow();
    expect(() => cipher.decrypt(enc)).toThrow();
  });

  it('v1 sin AAD se sigue leyendo (compatibilidad con datos existentes)', () => {
    const legacy = cipher.encrypt('+51987654321');
    expect(legacy[0]).toBe(0x01);
    expect(cipher.decrypt(legacy)).toBe('+51987654321');
    expect(cipher.decrypt(legacy, 'cualquier:contexto:1')).toBe('+51987654321');
  });
});
