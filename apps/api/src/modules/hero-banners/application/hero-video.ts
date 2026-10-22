import { ValidationError } from '../../../shared/domain/domain-error.js';

export const HERO_VIDEO_MAX_BYTES = 50 * 1024 * 1024;

/** Structural ISO BMFF validation, not a codec/transcoding guarantee. */
export function validateHeroVideo(buffer: Buffer): void {
  const invalid = () => { throw new ValidationError('invalid-banner-video', 'Adjunta un archivo MP4 completo de hasta 50 MB.'); };
  if (buffer.length < 32 || buffer.length > HERO_VIDEO_MAX_BYTES) invalid();
  let offset = 0, boxes = 0, ftyp = false, moov = false, mdat = false;
  while (offset < buffer.length) {
    if (++boxes > 10000 || buffer.length - offset < 8) invalid();
    let length = buffer.readUInt32BE(offset), header = 8;
    const type = buffer.toString('ascii', offset + 4, offset + 8);
    if (length === 1) {
      if (buffer.length - offset < 16) invalid();
      const extended = buffer.readBigUInt64BE(offset + 8);
      if (extended > BigInt(buffer.length)) invalid();
      length = Number(extended); header = 16;
    } else if (length === 0) length = buffer.length - offset;
    if (length < header || length > buffer.length - offset) invalid();
    if (offset === 0 && type !== 'ftyp') invalid();
    if (type === 'ftyp') {
      if (offset !== 0 || length < header + 8 || (length - header) % 4 !== 0) invalid();
      const brands = [buffer.toString('ascii', offset + header, offset + header + 4)];
      for (let i = offset + header + 8; i < offset + length; i += 4) brands.push(buffer.toString('ascii', i, i + 4));
      if (!brands.some(brand => /^(isom|iso[2-9]|mp4[12]|avc1|M4V |dash)$/.test(brand))) invalid();
      ftyp = true;
    }
    if (type === 'moov' && length > header) moov = true;
    if (type === 'mdat' && length > header) mdat = true;
    offset += length;
  }
  if (!ftyp || !moov || !mdat) invalid();
}

export function heroVideoRange(header: string | undefined, size: number): { start: number; end: number; partial: boolean } | null {
  if (size <= 0) return null;
  if (header === undefined) return { start: 0, end: size - 1, partial: false };
  const match = /^bytes=(\d*)-(\d*)$/.exec(header);
  if (!match || (!match[1] && !match[2])) return null;
  if (!match[1]) {
    const suffix = Number(match[2]);
    if (!Number.isSafeInteger(suffix) || suffix <= 0) return null;
    return { start: Math.max(0, size - suffix), end: size - 1, partial: true };
  }
  const start = Number(match[1]), requestedEnd = match[2] ? Number(match[2]) : size - 1;
  if (!Number.isSafeInteger(start) || !Number.isSafeInteger(requestedEnd) || start >= size || requestedEnd < start) return null;
  return { start, end: Math.min(requestedEnd, size - 1), partial: true };
}
