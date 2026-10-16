import { selectImportable, type ManifestItem } from '../application/legacy-import.js';
import { assertSafeKey, contentAddressedKey, detectImageType, MediaUrlResolver, validateImage } from './media.js';

const png = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13]), Buffer.from('IHDR'), Buffer.from([0, 0, 0, 40, 0, 0, 0, 30])]);
const jpeg = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 16, 0x4a, 0x46, 0x49, 0x46, 0, 1, 1, 0, 0, 1, 0, 1, 0, 0, 0xff, 0xc0, 0, 17, 8, 0, 20, 0, 50, 3, 0, 0]);
const webp = Buffer.concat([Buffer.from('RIFF'), Buffer.from([0, 0, 0, 0]), Buffer.from('WEBPVP8X'), Buffer.alloc(18)]);
const avif = Buffer.concat([Buffer.from([0, 0, 0, 24]), Buffer.from('ftypavif'), Buffer.from([0, 0, 0, 0]), Buffer.from('mif1miaf')]);

describe('Medios: tipo real por magic bytes, claves y política de importación', () => {
  it('detecta JPEG, PNG, WebP y AVIF por contenido y rechaza lo demás aunque la extensión diga imagen', () => {
    expect(detectImageType(jpeg)).toBe('jpeg');
    expect(detectImageType(png)).toBe('png');
    expect(detectImageType(webp)).toBe('webp');
    expect(detectImageType(avif)).toBe('avif');
    expect(detectImageType(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"></svg>'))).toBeNull();
    expect(detectImageType(Buffer.from('GIF89a......'))).toBeNull();
    expect(() => validateImage(Buffer.from('%PDF-1.7 hola'), 1000)).toThrow(/Formato no admitido/);
  });

  it('valida tamaño y lee dimensiones', () => {
    expect(validateImage(png, 1000)).toMatchObject({ type: 'png', width: 40, height: 30, mime: 'image/png' });
    expect(validateImage(jpeg, 1000)).toMatchObject({ type: 'jpeg', width: 50, height: 20 });
    expect(() => validateImage(png, 10)).toThrow(/supera/);
    expect(() => validateImage(new Uint8Array(), 10)).toThrow(/vacío/);
  });

  it('clave direccionada por contenido, segura, y URL pública', () => {
    const key = contentAddressedKey('tours', { sha256: 'ab'.repeat(32), ext: 'png' });
    expect(key).toBe(`tours/ab/${'ab'.repeat(12)}.png`);
    expect(() => assertSafeKey('../etc/passwd')).toThrow();
    expect(() => assertSafeKey('a//b')).toThrow();
    const urls = new MediaUrlResolver('https://cdn.pwt.test/media', 'https://peruwonderstours.test');
    expect(urls.url(key)).toBe(`https://cdn.pwt.test/media/${key}`);
    expect(urls.url('https://old.site/x.jpg')).toBe('https://old.site/x.jpg');
    expect(urls.url(null)).toBeNull();
  });

  it('serves imported media from the owned web origin, with an owned placeholder for missing legacy files', () => {
    const urls = new MediaUrlResolver('https://api.peruwonderstours.test/media', 'https://peruwonderstours.test/');
    const path = '/images/blog/lg/b8b79eb9-73ba-48e9-8de0-1f0c17f5842f-1746491708.jpg';
    expect(urls.url(`https://www.andeanperutours.com${path}`)).toBe('https://peruwonderstours.test/tours/e7d3d7eb7cd52a1965cf.webp');
    expect(urls.url(`http://andeanperutours.com${path}?v=1#photo`)).toBe('https://peruwonderstours.test/tours/e7d3d7eb7cd52a1965cf.webp');
    for (const host of ['www.andeanperutours.com', 'andeanperutours.com', 'turinet.turismoads.com']) {
      expect(urls.url(`https://${host}/images/missing.jpg`)).toBe('https://peruwonderstours.test/brand/media-pending.svg');
    }
    expect(urls.url('tours/new-cms-upload.webp')).toBe('https://api.peruwonderstours.test/media/tours/new-cms-upload.webp');
    expect(urls.url('https://cdn.new-owner.test/photo.webp')).toBe('https://cdn.new-owner.test/photo.webp');
    expect(urls.url('https://www.andeanperutours.com.evil.test/photo.webp')).toBe('https://www.andeanperutours.com.evil.test/photo.webp');
  });

  it('rewrites archived editorial media and links without changing new CMS or unrelated URLs', () => {
    const urls = new MediaUrlResolver('https://api.pwt.test/media', 'https://pwt.test');
    const text = '<img src="https://turinet.turismoads.com/images/missing.jpg"><a href="https://www.andeanperutours.com/es/andean-peru-tours/quienes-somos">About</a> ![new](https://new-owner.test/photo.webp)';
    expect(urls.editorial(text)).toBe('<img src="https://pwt.test/brand/media-pending.svg"><a href="https://pwt.test/es/nosotros">About</a> ![new](https://new-owner.test/photo.webp)');
    const unrelated = 'https://www.andeanperutours.com.evil.test/photo.webp';
    expect(urls.editorial(unrelated)).toBe(unrelated);
  });

  it('importación legacy: solo hosts permitidos y contenido; sin sellos, logos ni otra agencia', () => {
    const item = (id: string, url: string, entityType: string, role = 'gallery', kind = 'jpg'): ManifestItem => ({ id, url, host: new URL(url).host, kind, usages: [{ entityType, role }] });
    const { selected, skipped } = selectImportable(
      [
        item('1', 'https://www.andeanperutours.com/images/tours/a.jpg', 'tour'),
        item('2', 'https://turinet.turismoads.com/images/galleries/b.jpg', 'blogPost', 'body'),
        item('3', 'https://www.perusacredexperiences.com/esnna.jpg', 'trustBadge', 'poster'),
        item('4', 'https://www.andeanperutours.com/images/sello.svg', 'trustBadge', 'badge-legacy', 'svg'),
        item('5', 'https://www.andeanperutours.com/images/logo.svg', 'brand', 'logo', 'svg'),
        item('6', 'https://www.andeanperutours.com/images/x.jpg', 'tour', 'gallery', 'seal'),
      ],
      new Set(['www.andeanperutours.com', 'turinet.turismoads.com']),
    );
    expect(selected.map((s) => s.id)).toEqual(['1', '2']);
    expect(skipped.map((s) => s.id).sort()).toEqual(['3', '4', '5', '6']);
  });
});
