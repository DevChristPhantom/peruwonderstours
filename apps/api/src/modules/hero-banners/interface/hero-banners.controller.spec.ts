import 'reflect-metadata';
import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { HeroBannersService } from '../application/hero-banners.service.js';
import { HERO_DOCUMENT_CSP, HeroBannersAdminController, HeroBannersPublicController } from './hero-banners.controller.js';

describe('sandboxed hero document response', () => {
  let app: INestApplication;
  beforeAll(async () => {
    const module = await Test.createTestingModule({ controllers: [HeroBannersPublicController], providers: [{ provide: HeroBannersService, useValue: {
      document: async () => Buffer.from('<!doctype html><html><script>window.x=1</script></html>'), list: async () => [],
    } }] }).compile();
    app = module.createNestApplication();
    await app.init();
  });
  afterAll(async () => { await app.close(); });
  it('requires upload and catalog write permissions together for HTML upload', () => {
    expect(Reflect.getMetadata('pwt:required-permissions', HeroBannersAdminController.prototype.upload)).toEqual(['media:upload', 'tours:write']);
    expect(Reflect.getMetadata('pwt:required-permissions', HeroBannersAdminController.prototype.patch)).toEqual(['tours:write']);
    expect(Reflect.getMetadata('pwt:required-permissions', HeroBannersAdminController.prototype.list)).toEqual(['tours:read']);
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
});
