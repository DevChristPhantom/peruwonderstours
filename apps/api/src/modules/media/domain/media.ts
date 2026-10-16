import { createHash } from 'node:crypto';
import { ValidationError } from '../../../shared/domain/domain-error.js';
import { LEGACY_LINK_PATHS, LEGACY_MEDIA_MAP } from './legacy-media-map.js';

const LEGACY_MEDIA_HOSTS = new Set(['www.andeanperutours.com', 'andeanperutours.com', 'turinet.turismoads.com']);
export function isLegacyMediaUrl(value: string): boolean {
  try { return LEGACY_MEDIA_HOSTS.has(new URL(value).hostname); } catch { return false; }
}

/** Tipos de imagen aceptados (por contenido real, no por extensión ni por Content-Type declarado). */
export const IMAGE_TYPES = {
  jpeg: { mime: 'image/jpeg', ext: 'jpg' },
  png: { mime: 'image/png', ext: 'png' },
  webp: { mime: 'image/webp', ext: 'webp' },
  avif: { mime: 'image/avif', ext: 'avif' },
} as const;
export type ImageType = keyof typeof IMAGE_TYPES;

/** Detecta el formato por magic bytes. null = no es una imagen admitida. */
export function detectImageType(bytes: Uint8Array): ImageType | null {
  const b = Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return 'jpeg';
  if (b.length >= 8 && b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'png';
  if (b.length >= 12 && b.toString('ascii', 0, 4) === 'RIFF' && b.toString('ascii', 8, 12) === 'WEBP') return 'webp';
  // ISO-BMFF: [size]['ftyp'][major brand] con marca avif/avis (o listada en compatible brands).
  if (b.length >= 16 && b.toString('ascii', 4, 8) === 'ftyp') {
    const size = Math.min(b.readUInt32BE(0), b.length);
    const brands: string[] = [b.toString('ascii', 8, 12)];
    for (let i = 16; i + 4 <= size; i += 4) brands.push(b.toString('ascii', i, i + 4));
    if (brands.some((x) => x === 'avif' || x === 'avis')) return 'avif';
  }
  return null;
}

/** Ancho y alto si el formato lo permite leer de la cabecera (null si no). */
export function imageDimensions(bytes: Uint8Array, type: ImageType): { width: number; height: number } | null {
  const b = Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  try {
    if (type === 'png' && b.length >= 24) return { width: b.readUInt32BE(16), height: b.readUInt32BE(20) };
    if (type === 'webp' && b.length >= 30) {
      const chunk = b.toString('ascii', 12, 16);
      if (chunk === 'VP8X') return { width: 1 + b.readUIntLE(24, 3), height: 1 + b.readUIntLE(27, 3) };
      if (chunk === 'VP8L') {
        const bits = b.readUInt32LE(21);
        return { width: 1 + (bits & 0x3fff), height: 1 + ((bits >> 14) & 0x3fff) };
      }
      if (chunk === 'VP8 ') return { width: b.readUInt16LE(26) & 0x3fff, height: b.readUInt16LE(28) & 0x3fff };
    }
    if (type === 'jpeg') {
      let i = 2;
      while (i + 9 < b.length) {
        if (b[i] !== 0xff) {
          i += 1;
          continue;
        }
        const marker = b[i + 1]!;
        if (marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker)) {
          return { height: b.readUInt16BE(i + 5), width: b.readUInt16BE(i + 7) };
        }
        i += 2 + b.readUInt16BE(i + 2);
      }
    }
    if (type === 'avif') {
      const at = b.indexOf('ispe');
      if (at > 0 && at + 16 <= b.length) return { width: b.readUInt32BE(at + 8), height: b.readUInt32BE(at + 12) };
    }
  } catch {
    return null;
  }
  return null;
}

export interface ValidatedImage {
  type: ImageType;
  mime: string;
  ext: string;
  sha256: string;
  size: number;
  width: number | null;
  height: number | null;
}

export function validateImage(bytes: Uint8Array, maxBytes: number): ValidatedImage {
  if (bytes.byteLength === 0) throw new ValidationError('empty-file', 'El archivo está vacío.');
  if (bytes.byteLength > maxBytes) {
    throw new ValidationError('file-too-large', `La imagen supera el máximo de ${Math.round(maxBytes / 1024 / 1024)} MB.`, { maxBytes });
  }
  const type = detectImageType(bytes);
  if (!type) throw new ValidationError('unsupported-media-type', 'Formato no admitido: solo JPEG, PNG, WebP o AVIF (se verifica el contenido real).');
  const dims = imageDimensions(bytes, type);
  return {
    type,
    mime: IMAGE_TYPES[type].mime,
    ext: IMAGE_TYPES[type].ext,
    sha256: createHash('sha256').update(bytes).digest('hex'),
    size: bytes.byteLength,
    width: dims?.width ?? null,
    height: dims?.height ?? null,
  };
}

/**
 * Clave de almacenamiento direccionada por contenido: `<prefijo>/<aa>/<sha256-24>.<ext>`.
 * Subir dos veces la misma imagen produce la misma clave (deduplicación e idempotencia).
 */
export function contentAddressedKey(prefix: string, image: Pick<ValidatedImage, 'sha256' | 'ext'>): string {
  const clean = prefix.replace(/[^a-z0-9/_-]/gi, '').replace(/^\/+|\/+$/g, '') || 'uploads';
  return `${clean}/${image.sha256.slice(0, 2)}/${image.sha256.slice(0, 24)}.${image.ext}`;
}

const SAFE_KEY = /^[a-z0-9][a-z0-9/_.-]{0,250}$/i;

export function assertSafeKey(key: string): string {
  if (!SAFE_KEY.test(key) || key.includes('..') || key.includes('//')) throw new ValidationError('invalid-storage-key', 'Clave de almacenamiento inválida.');
  return key;
}

/**
 * Puerto de almacenamiento de medios. Adaptadores: `local` (disco, desarrollo) y, pendiente,
 * S3/R2 (misma interfaz: put/exists/delete por clave; la URL pública la arma MediaUrlResolver).
 */
export interface MediaStorage {
  readonly kind: 'local' | 's3';
  put(key: string, bytes: Uint8Array, contentType: string): Promise<void>;
  exists(key: string): Promise<boolean>;
  delete(key: string): Promise<void>;
}

/** Convierte una clave de medios (o URL absoluta heredada) en URL pública. */
export class MediaUrlResolver {
  constructor(private readonly publicBaseUrl: string, private readonly publicWebBaseUrl: string) {}

  url(key: string | null | undefined): string | null {
    if (!key) return null;
    if (/^https?:\/\//i.test(key)) {
      if (!isLegacyMediaUrl(key)) return key;
      const old = new URL(key);
      const local = LEGACY_MEDIA_MAP[`${old.hostname.replace(/^www\./, '')}${old.pathname}`] ?? '/brand/media-pending.svg';
      return `${this.publicWebBaseUrl.replace(/\/+$/, '')}${local}`;
    }
    return `${this.publicBaseUrl}/${key.replace(/^\/+/, '')}`;
  }

  /** Rewrite archived editorial URLs at the response boundary, without modifying stored content. */
  editorial(text: string): string {
    return text.replace(/https?:\/\/(?:(?:www\.)?andeanperutours\.com|turinet\.turismoads\.com)(?::\d+)?(?=[/?#\s<>"')\]]|$)(?:[/?#][^\s<>"')\]]*)?/gi, (value) => {
      const old = new URL(value);
      if (/^\/images\//i.test(old.pathname) || /\.(?:jpe?g|png|webp|avif|gif|svg)$/i.test(old.pathname)) return this.url(value)!;
      const path = LEGACY_LINK_PATHS[old.pathname.replace(/\/$/, '')] ?? old.pathname;
      return `${this.publicWebBaseUrl.replace(/\/+$/, '')}${path}${old.search}${old.hash}`;
    });
  }
}
