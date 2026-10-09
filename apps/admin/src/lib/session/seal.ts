import { createCipheriv, createDecipheriv, hkdfSync, randomBytes } from "node:crypto";

import { env } from "@/lib/env";

/**
 * Sellado de cookies con AES-256-GCM (autenticado). La clave se deriva de `ADMIN_SESSION_SECRET`
 * con HKDF-SHA256 y un `info` por propósito; el nombre de la cookie va como AAD, así un valor no
 * se puede trasplantar de una cookie a otra. Formato: base64url( v1 | iv(12) | tag(16) | cifrado ).
 *
 * Sin dependencias: `node:crypto` (Proxy y Server Components corren en Node.js en Next 16).
 */

const VERSION = 1;
const IV_BYTES = 12;
const TAG_BYTES = 16;

let derived: { secret: string; key: Buffer } | null = null;

function key(): Buffer {
  const secret = env().ADMIN_SESSION_SECRET;
  if (!derived || derived.secret !== secret) {
    derived = { secret, key: Buffer.from(hkdfSync("sha256", secret, "pwt-admin", "pwt-admin-cookie-v1", 32)) };
  }
  return derived.key;
}

export function seal(value: unknown, aad: string): string {
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv("aes-256-gcm", key(), iv);
  cipher.setAAD(Buffer.from(aad, "utf8"));
  const plaintext = Buffer.from(JSON.stringify(value), "utf8");
  const encrypted = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  return Buffer.concat([Buffer.from([VERSION]), iv, cipher.getAuthTag(), encrypted]).toString("base64url");
}

/** Devuelve null si el valor fue manipulado, es de otra clave/cookie o no es JSON. */
export function unseal(raw: string | undefined, aad: string): unknown {
  if (!raw || raw.length > 8192) return null;
  try {
    const buf = Buffer.from(raw, "base64url");
    if (buf.length < 1 + IV_BYTES + TAG_BYTES + 2 || buf[0] !== VERSION) return null;
    const iv = buf.subarray(1, 1 + IV_BYTES);
    const tag = buf.subarray(1 + IV_BYTES, 1 + IV_BYTES + TAG_BYTES);
    const data = buf.subarray(1 + IV_BYTES + TAG_BYTES);
    const decipher = createDecipheriv("aes-256-gcm", key(), iv);
    decipher.setAAD(Buffer.from(aad, "utf8"));
    decipher.setAuthTag(tag);
    const plaintext = Buffer.concat([decipher.update(data), decipher.final()]);
    return JSON.parse(plaintext.toString("utf8"));
  } catch {
    return null;
  }
}
