import { randomUUID } from 'node:crypto';
import { mkdir, open, readFile, rename, unlink, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { ConflictError, NotFoundError, ValidationError } from '../../../shared/domain/domain-error.js';
import { validateImage } from '../../media/domain/media.js';
import { HERO_VIDEO_MAX_BYTES, heroVideoRange, validateHeroVideo } from './hero-video.js';

export const HERO_BANNER_MAX_BYTES = 16 * 1024 * 1024;
export const HERO_BANNER_EFFECTS = ['none', 'water', 'clouds'] as const;
export type HeroBannerEffect = (typeof HERO_BANNER_EFFECTS)[number];
export interface HeroBanner {
  id: string; title: string; enabled: boolean; sortOrder: number; bytes: number;
  revision: number; createdAt: string; updatedAt: string; hasPoster: boolean; posterMime?: string;
  effect: HeroBannerEffect; sourceType?: 'html' | 'image' | 'video'; titleEmbedded?: boolean;
}
export interface HeroBannerPatch { title?: string; enabled?: boolean; sortOrder?: number; revision: number; effect?: HeroBannerEffect; titleEmbedded?: boolean }
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
    try {
      const records = JSON.parse(await readFile(resolve(this.directory, 'manifest.json'), 'utf8')) as HeroBanner[];
      return records.map((record) => ({ ...record, effect: record.sourceType === 'video' ? 'none' as const : record.effect ?? this.defaultEffect(record.title),
        titleEmbedded: record.titleEmbedded ?? (record.sourceType === undefined && /^Machu Picchu$/i.test(record.title)) }));
    }
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
  private defaultEffect(title: string): HeroBannerEffect {
    return /titicaca/i.test(title) ? 'water' : /machu/i.test(title) ? 'clouds' : 'none';
  }
  private effect(value: unknown): HeroBannerEffect {
    if (!HERO_BANNER_EFFECTS.includes(value as HeroBannerEffect)) throw new ValidationError('invalid-banner-effect', 'El efecto debe ser none, water o clouds.');
    return value as HeroBannerEffect;
  }
  async list(activeOnly = false): Promise<HeroBanner[]> {
    await this.queue;
    return (await this.manifest()).filter((item) => !activeOnly || item.enabled)
      .sort((a, b) => a.sortOrder - b.sortOrder || a.createdAt.localeCompare(b.createdAt));
  }
  async upload(buffer: Buffer, filename: string, title: unknown, effect?: unknown, titleEmbedded?: unknown, videoPoster?: Buffer): Promise<HeroBanner> {
    const normalizedTitle = this.title(title);
    const isVideo = /\.mp4$/i.test(filename);
    const requestedEffect = effect === undefined ? this.defaultEffect(normalizedTitle) : this.effect(effect);
    const normalizedEffect = isVideo ? 'none' : requestedEffect;
    if (titleEmbedded !== undefined && typeof titleEmbedded !== 'boolean') throw new ValidationError('invalid-banner-title-embedded', 'Indica si la imagen ya contiene un título.');
    const isHtml = /\.html?$/i.test(filename);
    if ((!isHtml && !isVideo && !/\.(png|jpe?g|webp|avif)$/i.test(filename)) || buffer.length === 0 || buffer.length > (isVideo ? HERO_VIDEO_MAX_BYTES : HERO_BANNER_MAX_BYTES)) {
      throw new ValidationError('invalid-banner-file', 'Adjunta una imagen o HTML de hasta 16 MB, o un video MP4 de hasta 50 MB.');
    }
    if (isVideo) validateHeroVideo(buffer);
    if (videoPoster && !isVideo) throw new ValidationError('invalid-banner-poster', 'La portada opcional corresponde a un video MP4.');
    let html = '';
    if (isHtml) {
    try { html = new TextDecoder('utf-8', { fatal: true }).decode(buffer); }
    catch { throw new ValidationError('invalid-banner-encoding', 'El archivo debe estar codificado en UTF-8.'); }
    if (!/^\s*<!doctype\s+html\s*>/i.test(html) || !/<html(?:\s|>)/i.test(html) || !/<\/html\s*>\s*$/i.test(html) || html.includes('\0')) {
      throw new ValidationError('invalid-banner-document', 'Adjunta un documento HTML completo con doctype HTML.');
    }
    }
    const embedded = /data:image\/(?:png|jpeg|webp|avif);base64,([A-Za-z0-9+/=]+)/i.exec(html);
    let poster: Buffer | undefined;
    let posterMime: string | undefined;
    if (!isHtml && !isVideo) {
      posterMime = validateImage(buffer, HERO_BANNER_MAX_BYTES).mime;
      poster = buffer;
    }
    if (videoPoster) {
      posterMime = validateImage(videoPoster, HERO_BANNER_MAX_BYTES).mime;
      if (!['image/jpeg', 'image/png', 'image/webp'].includes(posterMime)) throw new ValidationError('invalid-banner-poster', 'La portada debe ser JPEG, PNG o WebP.');
      poster = videoPoster;
    }
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
        hasPoster: Boolean(poster), effect: normalizedEffect, sourceType: isVideo ? 'video' : isHtml ? 'html' : 'image', titleEmbedded: titleEmbedded === true, ...(posterMime ? { posterMime } : {}) };
      const file = resolve(this.directory, `${record.id}.${isVideo ? 'mp4' : 'html'}`);
      try {
        if (isHtml || isVideo) await writeFile(file, buffer, { flag: 'wx', mode: 0o600 });
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
      if (patch.titleEmbedded !== undefined && typeof patch.titleEmbedded !== 'boolean') throw new ValidationError('invalid-banner-title-embedded', 'Indica si la imagen ya contiene un título.');
      if (patch.sortOrder !== undefined && (!Number.isInteger(patch.sortOrder) || patch.sortOrder < 0 || patch.sortOrder > 999)) throw new ValidationError('invalid-banner-order', 'El orden debe estar entre 0 y 999.');
      if (record.sourceType === 'video' && patch.effect !== undefined && patch.effect !== 'none') throw new ValidationError('invalid-banner-effect', 'El video no utiliza efectos de imagen.');
      const updated: HeroBanner = { ...record, title: patch.title === undefined ? record.title : this.title(patch.title),
        effect: patch.effect === undefined ? record.effect : this.effect(patch.effect),
        titleEmbedded: patch.titleEmbedded ?? record.titleEmbedded,
        enabled: patch.enabled ?? record.enabled, sortOrder: patch.sortOrder ?? record.sortOrder,
        revision: record.revision + 1, updatedAt: new Date().toISOString() };
      records[index] = updated;
      await this.save(records);
      return updated;
    });
  }
  /** Elimina el banner (manifiesto y archivos). Exige la revisión vigente para no borrar cambios ajenos. */
  async remove(id: string, revision: number): Promise<void> {
    this.checkId(id);
    await this.serialize(async () => {
      const records = await this.manifest();
      const record = records.find((item) => item.id === id);
      if (!record) throw new NotFoundError('hero-banner-not-found', 'Banner no encontrado.');
      if (revision !== record.revision) throw new ConflictError('banner-revision-conflict', 'El banner cambió. Actualiza la lista antes de eliminar.');
      await this.save(records.filter((item) => item.id !== id));
      // El manifiesto ya no lo referencia: los archivos huérfanos se borran sin bloquear la respuesta.
      await unlink(resolve(this.directory, `${id}.html`)).catch(() => undefined);
      await unlink(resolve(this.directory, `${id}.poster`)).catch(() => undefined);
      await unlink(resolve(this.directory, `${id}.mp4`)).catch(() => undefined);
    });
  }
  async document(id: string): Promise<Buffer> {
    this.checkId(id);
    const record = (await this.list(true)).find((item) => item.id === id);
    if (!record) throw new NotFoundError('hero-banner-not-found', 'Banner no encontrado.');
    if (record.sourceType === 'image' || record.sourceType === 'video') throw new NotFoundError('hero-banner-document-not-found', 'Este banner no utiliza HTML.');
    const original = await readFile(resolve(this.directory, `${id}.html`));
    if (!record.hasPoster) return original;
    const html = original.toString('utf8');
    const embedded = /data:image\/(?:png|jpeg|webp|avif);base64,[A-Za-z0-9+/=]+/i.exec(html)?.[0];
    if (!embedded) return original;
    // Serve repeated embedded images once through the web BFF. The private original,
    // scripts and CSS are retained; only identical copies of the extracted URI change.
    return Buffer.from(html.split(embedded).join(`/api/hero-banners/${id}/poster`), 'utf8');
  }
  /** Imagen del banner. Público: solo activos; panel (`includeInactive`): también los inactivos. */
  async poster(id: string, includeInactive = false): Promise<{ buffer: Buffer; mime: string }> {
    this.checkId(id);
    const record = (await this.list(!includeInactive)).find((item) => item.id === id);
    if (!record?.hasPoster || !record.posterMime) throw new NotFoundError('hero-banner-poster-not-found', 'Imagen de banner no encontrada.');
    return { buffer: await readFile(resolve(this.directory, `${id}.poster`)), mime: record.posterMime };
  }
  /** Open the authorized file once; stream only the requested range and close on completion. */
  async video(id: string, range?: string, includeInactive = false) {
    this.checkId(id);
    const record = (await this.list(!includeInactive)).find(item => item.id === id);
    if (record?.sourceType !== 'video') throw new NotFoundError('hero-banner-video-not-found', 'Video no encontrado.');
    const file = await open(resolve(this.directory, `${id}.mp4`), 'r').catch(() => { throw new NotFoundError('hero-banner-video-not-found', 'Video no encontrado.'); });
    try {
      const { size } = await file.stat();
      const selection = heroVideoRange(range, size);
      if (!selection) { await file.close(); return { status: 416 as const, size }; }
      return { status: selection.partial ? 206 as const : 200 as const, size, start: selection.start, end: selection.end,
        stream: file.createReadStream({ start: selection.start, end: selection.end, autoClose: true }) };
    } catch (error) { await file.close().catch(() => undefined); throw error; }
  }
}
