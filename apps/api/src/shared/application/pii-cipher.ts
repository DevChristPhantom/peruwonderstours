/**
 * Cifrado de datos personales en reposo (documento de identidad, teléfonos). Columnas
 * `*_enc` (bytea) del esquema; `hash` permite búsquedas exactas sin descifrar.
 */
export interface PiiCipher {
  encrypt(plaintext: string): Uint8Array;
  decrypt(ciphertext: Uint8Array): string;
  /** HMAC determinista (clave propia) para búsqueda por igualdad, p. ej. por DNI. */
  hash(value: string): Uint8Array;
}
