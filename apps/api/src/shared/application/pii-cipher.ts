/**
 * Cifrado de datos personales en reposo (documento de identidad, teléfonos). Columnas
 * `*_enc` (bytea) del esquema; `hash` permite búsquedas exactas sin descifrar.
 */
export interface PiiCipher {
  /**
   * `aad` (H-19): contexto autenticado, p. ej. "tabla:columna:id". Un cifrado copiado a otra fila o
   * columna no se descifra. Sin `aad` se usa el formato anterior.
   */
  encrypt(plaintext: string, aad?: string): Uint8Array;
  /** Lee ambos formatos: v1 (sin AAD, ignora `aad`) y v2 (exige el mismo `aad`). */
  decrypt(ciphertext: Uint8Array, aad?: string): string;
  /** HMAC determinista (clave propia) para búsqueda por igualdad, p. ej. por DNI. */
  hash(value: string): Uint8Array;
}
