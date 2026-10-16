import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { runInNewContext } from 'node:vm';
import test from 'node:test';

const ts = createRequire(import.meta.url)('typescript');
const source = readFileSync(new URL('../src/lib/catalog/retired-image-guard.ts', import.meta.url), 'utf8');
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
const fixtureModule = { exports: {} };
runInNewContext(compiled, { module: fixtureModule, exports: fixtureModule.exports, URL });
const { retiredImageGuard } = fixtureModule.exports;

test('persisted legacy cart photos never request retired hosts and require no manifest imports', () => {
  for (const value of ['https://www.andeanperutours.com/images/a.jpg', '//andeanperutours.com/images/a.png', 'https://turinet.turismoads.com/images/a.jpg']) assert.equal(retiredImageGuard(value), '/brand/media-pending.svg');
  for (const value of ['/tours/local.webp', 'https://media.example/photo.jpg', 'https://andeanperutours.com.other.example/photo.jpg']) assert.equal(retiredImageGuard(value), value);
  assert.equal(/^\s*import\b/m.test(source), false);
});
