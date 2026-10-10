import { contentAddressedKey, validateImage, type MediaStorage, type MediaUrlResolver, type ValidatedImage } from '../domain/media.js';

export interface StoredImage extends ValidatedImage {
  storageKey: string;
  url: string;
  /** false si la misma imagen (mismo SHA-256) ya estaba guardada. */
  created: boolean;
}

/** Valida (magic bytes + tamaño) y guarda una imagen con clave direccionada por contenido. */
export class MediaUploadService {
  constructor(
    private readonly storage: MediaStorage,
    private readonly urls: MediaUrlResolver,
    private readonly maxBytes: number,
  ) {}

  async store(bytes: Uint8Array, prefix = 'uploads'): Promise<StoredImage> {
    const image = validateImage(bytes, this.maxBytes);
    const storageKey = contentAddressedKey(prefix, image);
    const exists = await this.storage.exists(storageKey);
    if (!exists) await this.storage.put(storageKey, bytes, image.mime);
    return { ...image, storageKey, url: this.urls.url(storageKey)!, created: !exists };
  }
}
