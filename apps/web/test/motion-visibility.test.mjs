import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { runInNewContext } from 'node:vm';
import test from 'node:test';
const require = createRequire(import.meta.url);
const ts = require('typescript');
const source = readFileSync(new URL('../src/components/motion/MotionEffects.tsx', import.meta.url), 'utf8');
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;

test('Lenis ticker detaches while hidden, resumes once and cleans up on unmount', async () => {
  const listeners = new Map(), ticks = new Set(), idle = [], cleanups = [];
  let destroyed = 0, rafCalls = 0;
  const document = { visibilityState: 'visible', body: {}, querySelectorAll: () => [],
    addEventListener: (name, fn) => listeners.set(name, fn), removeEventListener: name => listeners.delete(name) };
  const media = query => ({ matches: query === '(pointer: fine)', addEventListener() {}, removeEventListener() {} });
  const gsap = { registerPlugin() {}, ticker: { add: fn => ticks.add(fn), remove: fn => ticks.delete(fn), lagSmoothing() {} },
    matchMedia: () => ({ add() {}, revert() {} }), context: fn => { fn(); return { revert() {} }; } };
  const fixtureModule = { exports: {} };
  runInNewContext(compiled, { module: fixtureModule, exports: fixtureModule.exports, document, Promise,
    window: { matchMedia: media, requestIdleCallback: fn => { idle.push(fn); return idle.length; }, cancelIdleCallback() {} },
    require: id => {
      if (id === '@pwt/ui/tokens') return { motion: { bezier: { out: [.25, 1, .5, 1] } }, REDUCED_MOTION_QUERY: '(prefers-reduced-motion: reduce)' };
      if (id === 'next/navigation') return { usePathname: () => '/es' };
      if (id === 'react') return { useEffect: fn => cleanups.push(fn()) };
      if (id === 'gsap') return { gsap };
      if (id === 'gsap/ScrollTrigger') return { ScrollTrigger: { refresh() {}, update() {} } };
      if (id === 'gsap/CustomEase') return { CustomEase: { create() {} } };
      if (id === 'lenis') return { default: class { on() {} raf() { rafCalls++; } destroy() { destroyed++; } } };
      throw new Error(id);
    },
  });
  fixtureModule.exports.default();
  idle.forEach(fn => fn());
  // Imports are asynchronous in the actual effect, including its race guards.
  for (let i = 0; i < 20; i++) await Promise.resolve();
  assert.equal(ticks.size, 1);
  ticks.forEach(fn => fn(1)); assert.equal(rafCalls, 1);
  document.visibilityState = 'hidden'; listeners.get('visibilitychange')();
  assert.equal(ticks.size, 0);
  document.visibilityState = 'visible'; listeners.get('visibilitychange')(); listeners.get('visibilitychange')();
  assert.equal(ticks.size, 1);
  cleanups.forEach(fn => fn());
  assert.equal(ticks.size, 0);
  assert.equal(listeners.size, 0);
  assert.equal(destroyed, 1);
});
