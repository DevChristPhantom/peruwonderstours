import { mkdtemp, readFile, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { HeroBannersService, HERO_BANNER_MAX_BYTES } from './hero-banners.service.js';
import { HERO_VIDEO_MAX_BYTES, heroVideoRange, validateHeroVideo } from './hero-video.js';

export function mp4Box(type: string, payload: Buffer): Buffer {
  const header = Buffer.alloc(8); header.writeUInt32BE(payload.length + 8); header.write(type, 4, 'ascii');
  return Buffer.concat([header, payload]);
}
const video = Buffer.concat([mp4Box('ftyp', Buffer.from('isom\0\0\0\0isommp42', 'binary')), mp4Box('moov', Buffer.from('metadata')), mp4Box('mdat', Buffer.from('video-sample-payload'))]);

describe('private MP4 hero storage and byte range selection', () => {
  let directory: string, service: HeroBannersService;
  beforeEach(async () => { directory = await mkdtemp(join(tmpdir(), 'pwt-hero-video-')); service = new HeroBannersService(directory); });
  afterEach(async () => { await rm(directory, { recursive: true, force: true }); });

  it('persists an inactive MP4 and optional valid poster, streams only requested bytes after activation', async () => {
    const poster = Buffer.from('89504e470d0a1a0a', 'hex');
    const record = await service.upload(video, 'trip.mp4', 'Machu Picchu', 'clouds', false, poster);
    expect(record).toMatchObject({ sourceType: 'video', enabled: false, effect: 'none', hasPoster: true, bytes: video.length });
    await expect(service.video(record.id)).rejects.toMatchObject({ kind: 'not_found' });
    await expect(service.poster(record.id)).rejects.toMatchObject({ kind: 'not_found' });
    const preview = await service.video(record.id, 'bytes=8-15', true);
    expect(preview.status).toBe(206);
    const chunks: Buffer[] = [];
    if (!preview.stream) throw new Error('Missing preview stream');
    for await (const chunk of preview.stream) chunks.push(Buffer.from(chunk));
    expect(Buffer.concat(chunks)).toEqual(video.subarray(8, 16));
    expect(await readFile(join(directory, '.hero-banners', `${record.id}.mp4`))).toEqual(video);
    await service.patch(record.id, { enabled: true, revision: 1 });
    const restarted = new HeroBannersService(directory);
    expect((await restarted.list(true))[0]?.sourceType).toBe('video');
    const suffix = await restarted.video(record.id, 'bytes=-5');
    const tail: Buffer[] = [];
    if (!suffix.stream) throw new Error('Missing stream');
    for await (const chunk of suffix.stream) tail.push(Buffer.from(chunk));
    expect(Buffer.concat(tail)).toEqual(video.subarray(-5));
    expect(await restarted.video(record.id, 'bytes=999999-')).toMatchObject({ status: 416, size: video.length });
    await expect(restarted.patch(record.id, { effect: 'water', revision: 2 })).rejects.toMatchObject({ kind: 'validation' });
    await restarted.remove(record.id, 2);
    await expect(readFile(join(directory, '.hero-banners', `${record.id}.mp4`))).rejects.toMatchObject({ code: 'ENOENT' });
    await expect(readFile(join(directory, '.hero-banners', `${record.id}.poster`))).rejects.toMatchObject({ code: 'ENOENT' });
  });

  it('validates structural boxes, MP4 brands, empty/truncated/oversized input and poster limits', async () => {
    const invalidBrand = Buffer.from(video); invalidBrand.write('qt  ', 8); invalidBrand.write('qt  qt  ', 16);
    for (const invalid of [Buffer.alloc(0), Buffer.from('<html>not video</html>'), video.subarray(0, video.length - 1), invalidBrand, Buffer.alloc(HERO_VIDEO_MAX_BYTES + 1)]) {
      await expect(service.upload(invalid, 'x.mp4', 'X')).rejects.toMatchObject({ kind: 'validation' });
    }
    await expect(service.upload(video, 'x.mp4', 'X', 'none', false, Buffer.alloc(0))).rejects.toMatchObject({ kind: 'validation' });
    await expect(service.upload(video, 'x.mp4', 'X', 'none', false, Buffer.alloc(HERO_BANNER_MAX_BYTES + 1))).rejects.toMatchObject({ kind: 'validation' });
    expect(() => validateHeroVideo(video)).not.toThrow();
    await expect(service.video('../manifest')).rejects.toMatchObject({ kind: 'not_found' });
    expect(await service.list()).toEqual([]);
  });

  it('rolls back video and poster files if the manifest cannot commit', async () => {
    const failing = service as unknown as { save: () => Promise<void> };
    failing.save = async () => { throw new Error('Simulated storage failure'); };
    await expect(service.upload(video, 'x.mp4', 'X', 'none', false, Buffer.from('89504e470d0a1a0a', 'hex'))).rejects.toThrow('Simulated storage failure');
    expect(await readdir(join(directory, '.hero-banners'))).toEqual([]);
  });

  it('handles open, suffix and clipped ranges while refusing malformed or multiple ranges', () => {
    expect(heroVideoRange(undefined, 100)).toEqual({ start: 0, end: 99, partial: false });
    expect(heroVideoRange('bytes=10-', 100)).toEqual({ start: 10, end: 99, partial: true });
    expect(heroVideoRange('bytes=90-200', 100)).toEqual({ start: 90, end: 99, partial: true });
    expect(heroVideoRange('bytes=-200', 100)).toEqual({ start: 0, end: 99, partial: true });
    for (const range of ['bytes=100-', 'bytes=9-2', 'bytes=-0', 'bytes=-', 'bytes=0-1,3-4', 'bytes=99999999999999999-', 'items=0-2']) expect(heroVideoRange(range, 100)).toBeNull();
  });
});
