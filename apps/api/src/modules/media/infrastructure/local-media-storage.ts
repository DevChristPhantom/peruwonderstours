import { access, mkdir, rm, writeFile, rename } from 'node:fs/promises';
import { dirname, join, resolve, sep } from 'node:path';
import { randomBytes } from 'node:crypto';
import { assertSafeKey, type MediaStorage } from '../domain/media.js';

/**
 * Adaptador de desarrollo: guarda en `MEDIA_LOCAL_DIR` (por defecto apps/api/uploads, gitignored)
 * y la API lo sirve en /media/* con cabeceras de caché inmutable (claves direccionadas por contenido).
 */
export class LocalMediaStorage implements MediaStorage {
  readonly kind = 'local' as const;
  readonly root: string;

  constructor(dir: string) {
    this.root = resolve(dir);
  }

  private pathFor(key: string): string {
    const full = resolve(join(this.root, assertSafeKey(key)));
    if (!full.startsWith(this.root + sep)) throw new Error('Ruta fuera del directorio de medios.');
    return full;
  }

  async put(key: string, bytes: Uint8Array): Promise<void> {
    const target = this.pathFor(key);
    await mkdir(dirname(target), { recursive: true });
    // Escritura atómica: archivo temporal + rename (nunca se sirve una imagen a medias).
    const tmp = `${target}.${randomBytes(6).toString('hex')}.tmp`;
    await writeFile(tmp, bytes);
    await rename(tmp, target);
  }

  async exists(key: string): Promise<boolean> {
    try {
      await access(this.pathFor(key));
      return true;
    } catch {
      return false;
    }
  }

  async delete(key: string): Promise<void> {
    await rm(this.pathFor(key), { force: true });
  }
}
