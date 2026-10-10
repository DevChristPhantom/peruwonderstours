import { contentAddressedKey, validateImage, type MediaStorage, type ValidatedImage } from '../domain/media.js';

/** Elemento de data/seed/media-manifest.json (inventario del sitio viejo). */
export interface ManifestItem {
  id: string;
  url: string;
  variantsSeen?: string[];
  host: string;
  kind: string;
  usages: Array<{ entityType: string; entitySlug?: string; role: string }>;
  altEs?: string | null;
  altEn?: string | null;
}

export interface ImportedEntry {
  url: string;
  storageKey: string;
  sha256: string;
  size: number;
  mime: string;
  width: number | null;
  height: number | null;
  importedAt: string;
}

/** Estado persistido entre corridas (idempotencia): URL original -> clave importada. */
export type ImportState = Record<string, ImportedEntry>;

const ENTITY_TYPES = new Set(['tour', 'destination', 'category', 'blogPost', 'page', 'illustration']);
const RASTER = new Set(['jpg', 'jpeg', 'png', 'webp', 'avif']);

/**
 * Qué se importa (condiciones acordadas con el coordinador/usuario):
 *  - solo hosts permitidos (www.andeanperutours.com, turinet.turismoads.com);
 *  - solo imágenes de contenido (tours, destinos, categorías, blog, páginas): sin sellos/insignias
 *    (trustBadge/trustText), logos de pago, de marca ni de fuentes de testimonios;
 *  - sin el póster ESNNA de otra agencia (host fuera de la lista) ni formatos no raster (svg/ico).
 *    HEIC se intenta y fallará por magic bytes (no admitido): queda reportado.
 */
export function selectImportable(items: readonly ManifestItem[], allowedHosts: ReadonlySet<string>): { selected: ManifestItem[]; skipped: Array<{ id: string; url: string; reason: string }> } {
  const selected: ManifestItem[] = [];
  const skipped: Array<{ id: string; url: string; reason: string }> = [];
  for (const item of items) {
    const host = safeHost(item.url);
    if (!host || !allowedHosts.has(host)) skipped.push({ id: item.id, url: item.url, reason: `host no permitido (${host ?? 'inválido'})` });
    else if (item.kind === 'seal' || item.usages.some((u) => /badge|seal/i.test(u.role) || u.entityType.startsWith('trust'))) skipped.push({ id: item.id, url: item.url, reason: 'sello/insignia' });
    else if (!item.usages.some((u) => ENTITY_TYPES.has(u.entityType))) skipped.push({ id: item.id, url: item.url, reason: 'no es imagen de contenido' });
    else if (!RASTER.has(item.kind) && item.kind !== 'heic') skipped.push({ id: item.id, url: item.url, reason: `formato ${item.kind} fuera de alcance` });
    else selected.push(item);
  }
  return { selected, skipped };
}

function safeHost(url: string): string | null {
  try {
    const u = new URL(url);
    return u.protocol === 'https:' || u.protocol === 'http:' ? u.hostname.toLowerCase() : null;
  } catch {
    return null;
  }
}

/** Carpeta de destino por tipo de uso principal (legacy/tours, legacy/blog...). */
export function prefixFor(item: ManifestItem): string {
  const type = item.usages.find((u) => ENTITY_TYPES.has(u.entityType))?.entityType ?? 'misc';
  const folder: Record<string, string> = { tour: 'tours', destination: 'destinations', category: 'categories', blogPost: 'blog', page: 'pages', illustration: 'pages' };
  return `legacy/${folder[type] ?? 'misc'}`;
}

export type Fetcher = (url: string) => Promise<{ ok: boolean; status: number; bytes: Uint8Array }>;

/** Descarga con límite de tiempo y tamaño; sigue redirecciones solo dentro de http(s). */
export function httpFetcher(timeoutMs: number, maxBytes: number): Fetcher {
  return async (url) => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(url, { signal: controller.signal, redirect: 'follow', headers: { 'User-Agent': 'PeruWondersTours-MediaImport/1.0 (+migracion autorizada)' } });
      const length = Number(res.headers.get('content-length') ?? '0');
      if (length > maxBytes) return { ok: false, status: 413, bytes: new Uint8Array() };
      const buffer = new Uint8Array(await res.arrayBuffer());
      return { ok: res.ok, status: res.status, bytes: buffer };
    } finally {
      clearTimeout(timer);
    }
  };
}

export interface ImportOutcome {
  imported: ImportedEntry[];
  reused: ImportedEntry[];
  failed: Array<{ id: string; url: string; error: string }>;
}

/**
 * Descarga e importa con concurrencia limitada. Idempotente: lo que ya está en `state` y existe en el
 * almacenamiento no se vuelve a bajar. Valida el tipo REAL por magic bytes antes de guardar.
 */
export async function importItems(params: {
  items: readonly ManifestItem[];
  state: ImportState;
  storage: MediaStorage;
  fetcher: Fetcher;
  maxBytes: number;
  concurrency: number;
  now: () => Date;
  onProgress?: (done: number, total: number) => void;
}): Promise<ImportOutcome> {
  const outcome: ImportOutcome = { imported: [], reused: [], failed: [] };
  const queue = [...params.items];
  let done = 0;
  const worker = async () => {
    for (let item = queue.shift(); item; item = queue.shift()) {
      try {
        const known = params.state[item.url];
        if (known && (await params.storage.exists(known.storageKey))) {
          outcome.reused.push(known);
        } else {
          const res = await params.fetcher(item.url);
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          const image: ValidatedImage = validateImage(res.bytes, params.maxBytes);
          const storageKey = contentAddressedKey(prefixFor(item), image);
          if (!(await params.storage.exists(storageKey))) await params.storage.put(storageKey, res.bytes, image.mime);
          const entry: ImportedEntry = { url: item.url, storageKey, sha256: image.sha256, size: image.size, mime: image.mime, width: image.width, height: image.height, importedAt: params.now().toISOString() };
          params.state[item.url] = entry;
          outcome.imported.push(entry);
        }
      } catch (error) {
        outcome.failed.push({ id: item.id, url: item.url, error: error instanceof Error ? error.message : String(error) });
      }
      done += 1;
      params.onProgress?.(done, params.items.length);
    }
  };
  await Promise.all(Array.from({ length: Math.max(1, Math.min(params.concurrency, 2)) }, () => worker()));
  return outcome;
}
