import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import { runInNewContext } from 'node:vm';
import test from 'node:test';

const require = createRequire(import.meta.url);
const sharp = createRequire(require.resolve('next/package.json'))('sharp');
const ts = require('typescript');
const manifest = JSON.parse(readFileSync(new URL('../src/lib/content/tour-image-manifest.json', import.meta.url), 'utf8'));
const source = readFileSync(new URL('../src/lib/catalog/image-source.ts', import.meta.url), 'utf8');
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
const fixtureModule = { exports: {} };
runInNewContext(compiled, { module: fixtureModule, exports: fixtureModule.exports, URL, require: () => ({ default: manifest }) });
const { catalogImageSource } = fixtureModule.exports;

test('known images resolve locally, retired-site misses use a placeholder and CMS URLs remain intact', () => {
  for (const record of manifest) assert.equal(catalogImageSource(record.source), record.local);
  for (const value of ['/media/new-image.webp', 'https://other.example/photo.jpg']) assert.equal(catalogImageSource(value), value);
  for (const value of [`${manifest[0].source}?updated=1`, 'http://andeanperutours.com/images/missing.jpg', '//www.andeanperutours.com/image.png', 'https://www.turinet.com.pe/image.png']) assert.equal(catalogImageSource(value), '/brand/media-pending.svg');
});

test('API-owned public image URLs become optimizer-safe local paths without authorizing other hosts or paths', () => {
  for (const origin of ['https://peruwonderstours.com', 'https://www.peruwonderstours.com', 'http://localhost:3100', 'http://localhost:4000']) {
    assert.equal(catalogImageSource(`${origin}/tours/example.webp?v=1`), '/tours/example.webp?v=1');
    assert.equal(catalogImageSource(`${origin}/brand/media-pending.svg`), '/brand/media-pending.svg');
    assert.equal(catalogImageSource(`${origin}/media/new-cms.webp`), `${origin}/media/new-cms.webp`);
  }
  assert.equal(catalogImageSource('https://preview.pwt.test/tours/one.webp', 'https://preview.pwt.test/'), '/tours/one.webp');
  assert.equal(catalogImageSource('http://192.168.1.1/tours/one.webp', 'http://192.168.1.1'), 'http://192.168.1.1/tours/one.webp');
  assert.equal(catalogImageSource('https://peruwonderstours.com.evil.test/tours/one.webp'), 'https://peruwonderstours.com.evil.test/tours/one.webp');
  assert.equal(catalogImageSource('https://other.test/tours/one.webp', 'not a URL'), 'https://other.test/tours/one.webp');
});

test('all five priority tours have bounded, deduplicated and verifiable local images', async () => {
  const expected = ['tour-islas-de-los-uros-y-taquile-full-day', 'full-day-machu-picchu-esencia-ciudadela', 'tour-full-day-canon-del-colca', 'tour-complejo-arqueologico-de-sillustani', 'cusco-machu-picchu-premium-4d-3n'];
  assert.ok(manifest.length > 25);
  assert.equal(new Set(manifest.map(record => record.source)).size, manifest.length);
  assert.equal(new Set(manifest.map(record => record.local)).size, manifest.length);
  for (const key of expected) {
    const count = manifest.filter(record => record.tourKeys.includes(key)).length;
    assert.ok(count > 0, key);
  }
  for (const record of manifest) {
    const sourceUrl = new URL(record.source);
    assert.ok(['https://www.andeanperutours.com', 'https://turinet.turismoads.com'].includes(sourceUrl.origin));
    assert.ok(sourceUrl.pathname.startsWith('/images/'));
    assert.match(record.local, /^\/tours\/[a-f0-9]{20}\.(webp|jpg|png|avif)$/);
    assert.match(record.originalSha256, /^[a-f0-9]{64}$/);
    assert.ok(record.originalBytes > 0 && record.originalBytes <= 8 * 1024 * 1024);
    const bytes = readFileSync(new URL(`../public${record.local}`, import.meta.url));
    assert.equal(bytes.length, record.localBytes);
    assert.ok(record.localBytes <= record.originalBytes);
    assert.equal(createHash('sha256').update(bytes).digest('hex'), record.localSha256);
    const dimensions = await sharp(bytes).metadata();
    assert.ok(['webp', 'jpeg', 'png', 'heif', 'avif'].includes(dimensions.format));
    if (record.encoding === 'webp75') assert.equal(dimensions.format, 'webp');
    else {
      assert.equal(record.encoding, 'original');
      assert.equal(record.localSha256, record.originalSha256);
    }
    assert.equal(dimensions.width, record.width);
    assert.equal(dimensions.height, record.height);
    assert.ok(dimensions.width > 0);
    if (record.encoding === 'webp75') assert.ok(dimensions.width <= 1600);
    assert.ok(dimensions.height > 0);
  }
});

test('every image URL in ES/EN seed content resolves without retired-host requests', () => {
  const seedRoot = new URL('../../../data/seed/', import.meta.url);
  let checked = 0;
  for (const filename of readdirSync(seedRoot, { recursive: true })) {
    if (!filename.endsWith('.json') || filename.endsWith('media-manifest.json')) continue;
    const text = readFileSync(new URL(filename.replaceAll('\\', '/'), seedRoot), 'utf8');
    for (const match of text.matchAll(/https?:\/\/(?:(?:www\.)?andeanperutours\.com|turinet\.turismoads\.com)\/images\/[^\s"'<>()[\]\\]+/g)) {
      const resolved = catalogImageSource(match[0]);
      assert.ok(resolved.startsWith('/'), match[0]);
      assert.ok(existsSync(new URL(`../public${resolved}`, import.meta.url)), resolved);
      checked++;
    }
  }
  assert.ok(checked > 500);
});

test('article-body photo links use local copies while external citations stay unchanged', () => {
  const markdownSource = readFileSync(new URL('../src/lib/legal/markdown.tsx', import.meta.url), 'utf8');
  const output = ts.transpileModule(markdownSource, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText;
  const markdownModule = { exports: {} };
  runInNewContext(output, { module: markdownModule, exports: markdownModule.exports, require: id => {
    if (id === '@/lib/catalog/image-source') return { catalogImageSource };
    if (id === 'next/link') return { default: 'local-link' };
    if (id === 'react/jsx-runtime') return { jsx: (type, props) => ({ type, props }) };
    throw new Error(id);
  } });
  const photo = markdownModule.exports.renderInline(`[Photo](${manifest[0].source})`).find(item => item && typeof item === 'object');
  assert.equal(photo.props.href, manifest[0].local);
  const citation = markdownModule.exports.renderInline('[UNESCO](https://ich.unesco.org/en/RL/00166)').find(item => item && typeof item === 'object');
  assert.equal(citation.props.href, 'https://ich.unesco.org/en/RL/00166');
});

test('owned editorial text removes retired-site links but retains external citations and local photo copies', () => {
  const editorial = readFileSync(new URL('../src/lib/content/editorial-brand.ts', import.meta.url), 'utf8');
  const output = ts.transpileModule(editorial, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
  const editorialModule = { exports: {} };
  runInNewContext(output, { module: editorialModule, exports: editorialModule.exports, URL, require: id => {
    if (id === '../catalog/image-source') return { catalogImageSource };
    if (id === '../site') return { SITE: { url: 'https://peruwonderstours.com' } };
    throw new Error(id);
  } });
  const { editorialBrand } = editorialModule.exports;
  assert.equal(editorialBrand('https://www.andeanperutours.com/es/contacto'), 'https://peruwonderstours.com/es/contacto');
  assert.equal(editorialBrand(manifest[0].source), manifest[0].local);
  assert.equal(editorialBrand('[UNESCO](https://ich.unesco.org/en/RL/00166)'), '[UNESCO](https://ich.unesco.org/en/RL/00166)');
  for (const other of ['https://www.andeanperutours.com.evil.test/photo.jpg', 'https://turinet.turismoads.com.other.test/article', 'https://andeanperutours.community/article']) {
    assert.equal(editorialBrand(other), other);
  }
  assert.equal(editorialBrand('http://andeanperutours.com:80/es/contactenos?source=old#form'), 'https://peruwonderstours.com/es/contactenos?source=old#form');
  for (const locale of ['', 'en/']) {
    const posts = JSON.parse(readFileSync(new URL(`../../../data/seed/${locale}blog-posts.json`, import.meta.url), 'utf8'));
    for (const post of posts) assert.equal(/https?:\/\/(?:www\.)?andeanperutours\.com|https?:\/\/turinet\.turismoads\.com/i.test(editorialBrand(post.body ?? '')), false);
  }
});
