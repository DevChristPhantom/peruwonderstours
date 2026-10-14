import { randomUUID } from 'node:crypto';
import { mkdir, readFile, rename, unlink, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { ConflictError, NotFoundError, ValidationError } from '../../../shared/domain/domain-error.js';
import { validateImage } from '../../media/domain/media.js';

export const HERO_BANNER_MAX_BYTES = 16 * 1024 * 1024;
export interface HeroBanner {
  id: string; title: string; enabled: boolean; sortOrder: number; bytes: number;
  revision: number; createdAt: string; updatedAt: string; hasPoster: boolean; posterMime?: string;
}
export interface HeroBannerPatch { title?: string; enabled?: boolean; sortOrder?: number; revision: number }
const ID = /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/;

/** Private, single-process local repository. No uploaded HTML is exposed by static media. */
export class HeroBannersService {
  private readonly directory: string;
  private queue: Promise<unknown> = Promise.resolve();
  constructor(mediaDirectory: string) { this.directory = resolve(mediaDirectory, '.hero-banners'); }

  private serialize<T>(operation: () => Promise<T>): Promise<T> {
    const result = this.queue.then(operation);
    this.queue = result.catch(() => undefined);
    return result;
  }
  private async manifest(): Promise<HeroBanner[]> {
    try { return JSON.parse(await readFile(resolve(this.directory, 'manifest.json'), 'utf8')) as HeroBanner[]; }
    catch (error) { if ((error as NodeJS.ErrnoException).code === 'ENOENT') return []; throw error; }
  }
  private async save(records: HeroBanner[]): Promise<void> {
    const temporary = resolve(this.directory, `manifest-${randomUUID()}.tmp`);
    try {
      await writeFile(temporary, JSON.stringify(records), { mode: 0o600, flag: 'wx' });
      await rename(temporary, resolve(this.directory, 'manifest.json'));
    } finally { await unlink(temporary).catch(() => undefined); }
  }
  private title(value: unknown): string {
    if (typeof value !== 'string' || !value.trim() || value.trim().length > 120) {
      throw new ValidationError('invalid-banner-title', 'El título debe tener entre 1 y 120 caracteres.');
    }
    return value.trim();
  }
  private checkId(id: string): void {
    if (!ID.test(id)) throw new NotFoundError('hero-banner-not-found', 'Banner no encontrado.');
  }
  async list(activeOnly = false): Promise<HeroBanner[]> {
    await this.queue;
    return (await this.manifest()).filter((item) => !activeOnly || item.enabled)
      .sort((a, b) => a.sortOrder - b.sortOrder || a.createdAt.localeCompare(b.createdAt));
  }
  async upload(buffer: Buffer, filename: string, title: unknown): Promise<HeroBanner> {
    const normalizedTitle = this.title(title);
    if (!/\.html?$/i.test(filename) || buffer.length === 0 || buffer.length > HERO_BANNER_MAX_BYTES) {
      throw new ValidationError('invalid-banner-file', 'Adjunta un archivo HTML de hasta 16 MB.');
    }
    let html: string;
    try { html = new TextDecoder('utf-8', { fatal: true }).decode(buffer); }
    catch { throw new ValidationError('invalid-banner-encoding', 'El archivo debe estar codificado en UTF-8.'); }
    if (!/^\s*<!doctype\s+html\s*>/i.test(html) || !/<html(?:\s|>)/i.test(html) || !/<\/html\s*>\s*$/i.test(html) || html.includes('\0')) {
      throw new ValidationError('invalid-banner-document', 'Adjunta un documento HTML completo con doctype HTML.');
    }
    const embedded = /data:image\/(?:png|jpeg|webp|avif);base64,([A-Za-z0-9+/=]+)/i.exec(html);
    let poster: Buffer | undefined;
    let posterMime: string | undefined;
    if (embedded?.[1]) {
      try {
        const decoded = Buffer.from(embedded[1], 'base64');
        posterMime = validateImage(decoded, HERO_BANNER_MAX_BYTES).mime;
        poster = decoded;
      } catch { /* Malformed embedded data leaves the safe legacy fallback available. */ }
    }
    return this.serialize(async () => {
      await mkdir(this.directory, { recursive: true, mode: 0o700 });
      const records = await this.manifest();
      const now = new Date().toISOString();
      const record: HeroBanner = { id: randomUUID(), title: normalizedTitle, enabled: false,
        sortOrder: Math.min(records.length, 999), bytes: buffer.length, revision: 1, createdAt: now, updatedAt: now,
        hasPoster: Boolean(poster), ...(posterMime ? { posterMime } : {}) };
      const file = resolve(this.directory, `${record.id}.html`);
      await writeFile(file, buffer, { flag: 'wx', mode: 0o600 });
      try {
        if (poster) await writeFile(resolve(this.directory, `${record.id}.poster`), poster, { flag: 'wx', mode: 0o600 });
        await this.save([...records, record]);
      } catch (error) {
        await unlink(file).catch(() => undefined);
        await unlink(resolve(this.directory, `${record.id}.poster`)).catch(() => undefined);
        throw error;
      }
      return record;
    });
  }
  async patch(id: string, patch: HeroBannerPatch): Promise<HeroBanner> {
    this.checkId(id);
    return this.serialize(async () => {
      const records = await this.manifest();
      const index = records.findIndex((item) => item.id === id);
      const record = records[index];
      if (!record) throw new NotFoundError('hero-banner-not-found', 'Banner no encontrado.');
      if (patch.revision !== record.revision) throw new ConflictError('banner-revision-conflict', 'El banner cambió. Actualiza la lista antes de guardar.');
      if (patch.enabled !== undefined && typeof patch.enabled !== 'boolean') throw new ValidationError('invalid-banner-enabled', 'El estado debe ser booleano.');
      if (patch.sortOrder !== undefined && (!Number.isInteger(patch.sortOrder) || patch.sortOrder < 0 || patch.sortOrder > 999)) throw new ValidationError('invalid-banner-order', 'El orden debe estar entre 0 y 999.');
      const updated: HeroBanner = { ...record, title: patch.title === undefined ? record.title : this.title(patch.title),
        enabled: patch.enabled ?? record.enabled, sortOrder: patch.sortOrder ?? record.sortOrder,
        revision: record.revision + 1, updatedAt: new Date().toISOString() };
      records[index] = updated;
      await this.save(records);
      return updated;
    });
  }
  async document(id: string): Promise<Buffer> {
    this.checkId(id);
    const record = (await this.list(true)).find((item) => item.id === id);
    if (!record) throw new NotFoundError('hero-banner-not-found', 'Banner no encontrado.');
    const original = await readFile(resolve(this.directory, `${id}.html`));
    if (!record.hasPoster) return original;
    const html = original.toString('utf8');
    const embedded = /data:image\/(?:png|jpeg|webp|avif);base64,[A-Za-z0-9+/=]+/i.exec(html)?.[0];
    if (!embedded) return original;
    // Serve repeated embedded images once through the web BFF. The private original,
    // scripts and CSS are retained; only identical copies of the extracted URI change.
    return Buffer.from(html.split(embedded).join(`/api/hero-banners/${id}/poster`), 'utf8');
  }
  async poster(id: string): Promise<{ buffer: Buffer; mime: string }> {
    this.checkId(id);
    const record = (await this.list(true)).find((item) => item.id === id);
    if (!record?.hasPoster || !record.posterMime) throw new NotFoundError('hero-banner-poster-not-found', 'Imagen de banner no encontrada.');
    return { buffer: await readFile(resolve(this.directory, `${id}.poster`)), mime: record.posterMime };
  }
}
