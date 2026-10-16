import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { HeroBannersService, HERO_BANNER_MAX_BYTES } from './hero-banners.service.js';

const html = Buffer.from('<!doctype html><html><body><script>window.test = 1</script></body></html>');
describe('private hero banner repository', () => {
  let directory: string;
  let service: HeroBannersService;
  beforeEach(async () => { directory = await mkdtemp(join(tmpdir(), 'pwt-hero-')); service = new HeroBannersService(directory); });
  afterEach(async () => { await rm(directory, { recursive: true, force: true }); });

  it('persists exact HTML privately and hides newly uploaded banners until enabled', async () => {
    const record = await service.upload(html, 'motion.html', ' Titicaca ');
    expect(record.title).toBe('Titicaca');
    expect(record.enabled).toBe(false);
    expect(await service.list(true)).toEqual([]);
    await expect(service.document(record.id)).rejects.toMatchObject({ kind: 'not_found' });
    expect(await readFile(join(directory, '.hero-banners', `${record.id}.html`))).toEqual(html);
    await service.patch(record.id, { enabled: true, revision: 1 });
    expect(await new HeroBannersService(directory).document(record.id)).toEqual(html);
  });
  it('serializes concurrent uploads and detects stale edits without losing another update', async () => {
    const records = await Promise.all(Array.from({ length: 8 }, (_, i) => service.upload(html, 'banner.html', `Banner ${i}`)));
    expect(await service.list()).toHaveLength(8);
    const first = records[0]!;
    const results = await Promise.allSettled([
      service.patch(first.id, { title: 'Updated', revision: 1 }),
      service.patch(first.id, { enabled: true, revision: 1 }),
    ]);
    expect(results.map((item) => item.status)).toEqual(['fulfilled', 'rejected']);
    expect((await service.list()).find((item) => item.id === first.id)).toMatchObject({ title: 'Updated', enabled: false, revision: 2 });
  });
  it('rejects traversal, invalid UTF-8, fragments, wrong extensions and oversized input', async () => {
    await expect(service.document('../manifest')).rejects.toMatchObject({ kind: 'not_found' });
    for (const [buffer, filename] of [[Buffer.from([0xff, 0xfe]), 'a.html'], [Buffer.from('<html></html>'), 'a.html'], [html, 'a.svg'], [Buffer.alloc(HERO_BANNER_MAX_BYTES + 1), 'a.html']] as const) {
      await expect(service.upload(buffer, filename, 'Banner')).rejects.toMatchObject({ kind: 'validation' });
    }
    expect(await service.list()).toEqual([]);
  });
  it('orders active banners and refuses invalid order without committing', async () => {
    const a = await service.upload(html, 'a.html', 'A');
    const b = await service.upload(html, 'b.html', 'B');
    await service.patch(a.id, { enabled: true, sortOrder: 5, revision: 1 });
    await service.patch(b.id, { enabled: true, sortOrder: 1, revision: 1 });
    expect((await service.list(true)).map((item) => item.title)).toEqual(['B', 'A']);
    await expect(service.patch(a.id, { sortOrder: -1, revision: 2 })).rejects.toMatchObject({ kind: 'validation' });
    expect((await service.list(true))[1]?.revision).toBe(2);
  });
  it('extracts only a supported raster poster and hides it while disabled', async () => {
    const png = Buffer.from('89504e470d0a1a0a', 'hex');
    const file = Buffer.from(`<!doctype html><html><img src="data:image/png;base64,${png.toString('base64')}"></html>`);
    const record = await service.upload(file, 'a.html', 'A');
    expect(record.hasPoster).toBe(true);
    await expect(service.poster(record.id)).rejects.toMatchObject({ kind: 'not_found' });
    await service.patch(record.id, { enabled: true, revision: 1 });
    expect(await service.poster(record.id)).toEqual({ buffer: png, mime: 'image/png' });
    const malformed = await service.upload(Buffer.from('<!doctype html><html><img src="data:image/png;base64,SGVsbG8="></html>'), 'b.html', 'B');
    expect(malformed.hasPoster).toBe(false);
  });
  it('deduplicates only the extracted image URI in responses and retains the exact private original', async () => {
    const embedded = `data:image/png;base64,${Buffer.from('89504e470d0a1a0a', 'hex').toString('base64')}`;
    const different = 'data:image/jpeg;base64,/9j/AA==';
    const script = '<script>window.addEventListener("pointermove", () => { window.x = 1; });</script>';
    const original = Buffer.from(`<!doctype html><html><style>.hero{background:url('${embedded}')}</style><img src="${embedded}"><img src="${different}">${script}</html>`);
    const record = await service.upload(original, 'motion.html', 'Motion');
    await service.patch(record.id, { enabled: true, revision: 1 });
    const response = (await service.document(record.id)).toString('utf8');
    expect(response).not.toContain(embedded);
    expect(response.split(`/api/hero-banners/${record.id}/poster`)).toHaveLength(3);
    expect(response).toContain(different);
    expect(response).toContain(script);
    expect(await readFile(join(directory, '.hero-banners', `${record.id}.html`))).toEqual(original);
  });
  it('uploads raster banners with a native effect and no executable document', async () => {
    const png = Buffer.from('89504e470d0a1a0a', 'hex');
    const record = await service.upload(png, 'hero.png', 'Landscape', 'water');
    expect(record).toMatchObject({ effect: 'water', sourceType: 'image', hasPoster: true, enabled: false });
    await service.patch(record.id, { enabled: true, effect: 'clouds', revision: 1 });
    expect(await service.poster(record.id)).toEqual({ buffer: png, mime: 'image/png' });
    await expect(service.document(record.id)).rejects.toMatchObject({ code: 'hero-banner-document-not-found' });
    await expect(readFile(join(directory, '.hero-banners', `${record.id}.html`))).rejects.toMatchObject({ code: 'ENOENT' });
    expect((await service.list(true))[0]?.effect).toBe('clouds');
  });
  it('rejects fake raster content and invalid upload or edit effects', async () => {
    await expect(service.upload(html, 'fake.png', 'Fake')).rejects.toMatchObject({ kind: 'validation' });
    await expect(service.upload(html, 'ok.html', 'Okay', 'explode')).rejects.toMatchObject({ code: 'invalid-banner-effect' });
    const record = await service.upload(html, 'ok.html', 'Okay');
    await expect(service.patch(record.id, { revision: 1, effect: 'explode' as 'none' })).rejects.toMatchObject({ code: 'invalid-banner-effect' });
    expect((await service.list())[0]?.revision).toBe(1);
  });
  it('normalizes existing manifests without effect fields using destination defaults', async () => {
    const records = await Promise.all(['Lago Titicaca', 'Machu Picchu', 'Coast'].map((title) => service.upload(html, 'legacy.html', title)));
    const legacy = records.map(({ effect: _effect, ...record }) => record);
    await writeFile(join(directory, '.hero-banners', 'manifest.json'), JSON.stringify(legacy));
    expect((await service.list()).map((record) => record.effect)).toEqual(['water', 'clouds', 'none']);
  });
  it('validates titleEmbedded and defaults legacy Machu titles without affecting new uploads', async () => {
    await expect(service.upload(html, 'a.html', 'A', undefined, 'true')).rejects.toMatchObject({ code: 'invalid-banner-title-embedded' });
    const record = await service.upload(html, 'a.html', 'Machu Picchu', undefined, true);
    expect(record.titleEmbedded).toBe(true);
    await expect(service.patch(record.id, { revision: 1, titleEmbedded: 'false' as unknown as boolean })).rejects.toMatchObject({ code: 'invalid-banner-title-embedded' });
    expect((await service.patch(record.id, { revision: 1, titleEmbedded: false })).titleEmbedded).toBe(false);
    const { sourceType: _sourceType, titleEmbedded: _titleEmbedded, ...legacy } = record;
    await writeFile(join(directory, '.hero-banners', 'manifest.json'), JSON.stringify([legacy]));
    expect((await service.list())[0]?.titleEmbedded).toBe(true);
  });
});
