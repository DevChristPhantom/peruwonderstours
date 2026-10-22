import 'reflect-metadata';
import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { Readable } from 'node:stream';
import type { Response as SupertestResponse } from 'supertest';
import { BigIntSerializerInterceptor } from '../../../shared/interface/bigint-serializer.interceptor.js';
import { heroVideoRange } from '../application/hero-video.js';
import { StaffAuthGuard } from '../../identity/interface/staff-auth.guard.js';
import { HeroBannersService } from '../application/hero-banners.service.js';
import { HERO_DOCUMENT_CSP, HeroBannersAdminController, HeroBannersPublicController } from './hero-banners.controller.js';

const binaryFixture = Buffer.from(Array.from({ length: 4096 }, (_, index) => index % 251));
function binaryBody(response: SupertestResponse, callback: (error: Error | null, body?: Buffer) => void): void {
  const chunks: Buffer[] = [];
  response.on('data', (chunk: Buffer) => chunks.push(chunk));
  response.on('end', () => callback(null, Buffer.concat(chunks)));
  response.on('error', callback);
}

describe('sandboxed hero document response', () => {
  let app: INestApplication;
  beforeAll(async () => {
    const module = await Test.createTestingModule({ controllers: [HeroBannersPublicController, HeroBannersAdminController], providers: [{ provide: HeroBannersService, useValue: {
      document: async () => Buffer.from('<!doctype html><html><script>window.x=1</script></html>'), list: async () => [],
      video: async (_id: string, range?: string) => {
        const bytes = _id === 'large' ? binaryFixture : Buffer.from('abcdefghij');
        const selection = heroVideoRange(range, bytes.length);
        return selection ? { status: selection.partial ? 206 : 200, size: bytes.length, ...selection, stream: Readable.from(bytes.subarray(selection.start, selection.end + 1)) } : { status: 416, size: bytes.length };
      },
      upload: async (buffer: Buffer, filename: string, title: string, effect: string, embedded: boolean, poster?: Buffer) => ({ bytes: buffer.length, filename, title, effect, titleEmbedded: embedded, posterBytes: poster?.length ?? 0 }),
    } }] }).overrideGuard(StaffAuthGuard).useValue({ canActivate: () => true }).compile();
    app = module.createNestApplication();
    app.useGlobalInterceptors(new BigIntSerializerInterceptor());
    await app.init();
  });
  afterAll(async () => { await app.close(); });
  it('requires upload and catalog write permissions together for HTML upload', () => {
    const permissions = (method: string) => Reflect.getMetadata('pwt:required-permissions', Object.getOwnPropertyDescriptor(HeroBannersAdminController.prototype, method)!.value as object) as string[];
    expect(permissions('upload')).toEqual(['media:upload', 'tours:write']);
    expect(permissions('patch')).toEqual(['tours:write']);
    expect(permissions('list')).toEqual(['tours:read']);
    expect(permissions('video')).toEqual(['tours:read']);
    const videoMethod = Object.getOwnPropertyDescriptor(HeroBannersAdminController.prototype, 'video')!.value as object;
    const headers = Reflect.getMetadata('__headers__', videoMethod) as { name: string; value: string }[];
    expect(headers).toContainEqual({ name: 'Cache-Control', value: 'private, no-store' });
  });
  it('serves HTML with sandboxed inline-only scripts and no network access', async () => {
    const response = await request(app.getHttpServer()).get('/hero-banners/test/document').expect(200);
    expect(response.headers['content-security-policy']).toBe(HERO_DOCUMENT_CSP);
    expect(response.headers['x-content-type-options']).toBe('nosniff');
    expect(response.headers['cache-control']).toBe('no-store');
    expect(response.headers['content-type']).toContain('text/html');
    expect(response.text).toContain('<!doctype html>');
    expect(HERO_DOCUMENT_CSP).not.toContain('allow-same-origin');
  });
  it('streams public MP4 with correct range, length, media type and non-cacheable headers', async () => {
    await request(app.getHttpServer()).get('/hero-banners/test/video').expect(200)
      .expect('Content-Type', 'video/mp4').expect('Content-Length', '10').expect('Accept-Ranges', 'bytes')
      .expect('X-Content-Type-Options', 'nosniff').expect('Cache-Control', 'no-store');
    await request(app.getHttpServer()).get('/hero-banners/test/video').set('Range', 'bytes=2-5').expect(206)
      .expect('Content-Range', 'bytes 2-5/10').expect('Content-Length', '4');
    await request(app.getHttpServer()).get('/hero-banners/test/video').set('Range', 'bytes=10-').expect(416)
      .expect('Content-Range', 'bytes */10').expect('Content-Length', '0');
    await request(app.getHttpServer()).get('/admin/hero-banners/test/video').set('Range', 'bytes=-3').expect(206)
      .expect('Content-Range', 'bytes 7-9/10').expect('Cache-Control', 'private, no-store');
  });
  it('accepts multipart MP4 plus optional poster while preserving existing upload fields', async () => {
    const response = await request(app.getHttpServer()).post('/admin/hero-banners')
      .field('title', 'Video fixture').field('effect', 'none').field('titleEmbedded', 'false')
      .attach('file', Buffer.from('video-fixture'), 'trip.mp4').attach('poster', Buffer.from('poster-fixture'), 'poster.png').expect(201);
    expect(response.body).toMatchObject({ data: { bytes: 13, filename: 'trip.mp4', title: 'Video fixture', effect: 'none', titleEmbedded: false, posterBytes: 14 } });
  });
  it('delivers exact binary range bytes through the real global serializer', async () => {
    const first = await request(app.getHttpServer()).get('/hero-banners/large/video').set('Range', 'bytes=0-1023')
      .buffer(true).parse(binaryBody).expect(206).expect('Content-Length', '1024').expect('Content-Range', 'bytes 0-1023/4096');
    expect(first.body).toEqual(binaryFixture.subarray(0, 1024));
    const tail = await request(app.getHttpServer()).get('/admin/hero-banners/large/video').set('Range', 'bytes=-32')
      .buffer(true).parse(binaryBody).expect(206).expect('Content-Length', '32').expect('Content-Range', 'bytes 4064-4095/4096');
    expect(tail.body).toEqual(binaryFixture.subarray(-32));
  });
});

describe('public hero configuration state', () => {
  it('distinguishes a fresh install from configured but entirely inactive banners without leaking their data', async () => {
    let calls = 0;
    const inactive = { id: 'private-id', enabled: false, title: 'Private draft', sourceType: 'video' };
    const makeController = (records: object[]) => new HeroBannersPublicController({ list: async () => { calls++; return records; } } as unknown as HeroBannersService);
    expect(await makeController([]).list()).toEqual({ data: [], configured: false });
    const hidden = await makeController([inactive]).list();
    expect(hidden).toEqual({ data: [], configured: true });
    expect(JSON.stringify(hidden)).not.toContain('Private draft');
    const active = { ...inactive, id: 'public-id', title: 'Public banner', enabled: true };
    expect(await makeController([inactive, active]).list()).toEqual({ data: [active], configured: true });
    expect(calls).toBe(3);
  });
});
