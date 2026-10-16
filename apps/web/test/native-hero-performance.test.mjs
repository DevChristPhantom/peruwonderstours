import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { runInNewContext } from 'node:vm';
import test from 'node:test';

const require = createRequire(import.meta.url);
const ts = require('typescript');
const source = readFileSync(new URL('../src/components/home/NativeHeroScene.tsx', import.meta.url), 'utf8');
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText;

// Execute the real effect with deterministic DOM/RAF doubles. No browser or GPU
// benchmark: these assertions measure allocation, geometry reads and paint calls.
function mount(effect, active = true) {
  const calls = { reads: 0, contexts: 0, clears: 0, allocations: 0 };
  const listeners = new Map(), frames = new Map();
  let sequence = 0, now = 1000, cleanup;
  const context = { clearRect: () => calls.clears++, setTransform() {}, beginPath() {}, ellipse() {}, stroke() {}, arc() {}, fill() {} };
  const surface = { height: 150, getContext: () => { calls.contexts++; return context; } };
  let bitmapWidth = 300;
  Object.defineProperty(surface, 'width', { get: () => bitmapWidth, set: value => { bitmapWidth = value; calls.allocations++; } });
  const host = { clientWidth: 1200, clientHeight: 800, getBoundingClientRect: () => { calls.reads++; return { left: 0, top: 0 }; }, addEventListener: (name, fn) => listeners.set(name, fn), removeEventListener: name => listeners.delete(name) };
  const layer = { style: {} };
  const refs = [host, layer, effect === 'water' ? surface : null];
  const fixtureModule = { exports: {} };
  const jsx = () => null;
  runInNewContext(compiled, {
    module: fixtureModule, exports: fixtureModule.exports, Math, performance: { now: () => now },
    window: { devicePixelRatio: 2 },
    ResizeObserver: class { observe() {} disconnect() {} },
    requestAnimationFrame: fn => { frames.set(++sequence, fn); return sequence; },
    cancelAnimationFrame: id => frames.delete(id),
    require: id => {
      if (id === 'react') return { useRef: () => ({ current: refs.shift() }), useEffect: fn => { cleanup = fn(); } };
      if (id === 'react/jsx-runtime') return { jsx, jsxs: jsx };
      if (id === 'next/image') return { default: jsx };
      if (id.endsWith('.css')) return { default: {} };
      throw new Error(id);
    },
  });
  fixtureModule.exports.NativeHeroScene({ scene: { effect, title: 'Fixture' }, active, alt: '' });
  const step = () => { now += 16.67; const pending = [...frames.values()]; frames.clear(); pending.forEach(fn => fn(now)); };
  return { calls, surface, layer, listeners, frames, step, cleanup, pointer: (x, y) => listeners.get('pointermove')?.({ clientX: x, clientY: y }) };
}

test('cloud parallax allocates no canvas and samples a pointer burst once per frame', () => {
  const scene = mount('clouds');
  for (let i = 0; i < 100; i++) scene.pointer(300 + i, 200);
  assert.equal(scene.calls.reads, 0);
  assert.equal(scene.frames.size, 1);
  scene.step();
  assert.equal(scene.calls.reads, 1);
  assert.equal(scene.calls.contexts, 0);
  assert.equal(scene.calls.allocations, 0);
  assert.match(scene.layer.style.transform, /translate3d/);
  scene.cleanup();
  assert.equal(scene.frames.size, 0);
  assert.equal(scene.listeners.size, 0);
});

test('water allocates only on a ripple, stops repainting at rest and releases its bitmap', () => {
  const scene = mount('water');
  scene.pointer(400, 100); scene.step();
  assert.equal(scene.calls.allocations, 0);
  assert.equal(scene.calls.clears, 0);
  scene.pointer(400, 700); scene.step();
  assert.equal(scene.surface.width, 1800);
  assert.equal(scene.surface.height, 1200);
  assert.equal(scene.calls.allocations, 1);
  assert.ok(scene.calls.clears > 0);
  for (let i = 0; i < 200; i++) scene.step();
  assert.equal(scene.frames.size, 0);
  const painted = scene.calls.clears;
  scene.pointer(500, 100); scene.step();
  assert.equal(scene.calls.clears, painted);
  scene.cleanup();
  assert.equal(scene.surface.width, 0);
  assert.equal(scene.surface.height, 0);
});

test('inactive and no-effect scenes install no animation work', () => {
  for (const scene of [mount('water', false), mount('none')]) {
    assert.equal(scene.listeners.size, 0);
    assert.equal(scene.frames.size, 0);
    assert.equal(scene.calls.contexts, 0);
  }
});
