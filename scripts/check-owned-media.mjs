import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';

// GET-only checks against an isolated local server. Never contacts the retired website.
const origin = new URL(process.env.PWT_SMOKE_ORIGIN ?? 'http://localhost:3100');
assert.ok(['localhost', '127.0.0.1', '[::1]'].includes(origin.hostname), 'Local preview required');
const manifest = JSON.parse(await readFile(new URL('../apps/web/src/lib/content/tour-image-manifest.json', import.meta.url), 'utf8'));
const queue = [...manifest];
let verified = 0;
await Promise.all(Array.from({ length: 4 }, async () => {
  while (queue.length) {
    const entry = queue.shift();
    assert.match(entry.local, /^\/tours\/[a-f0-9]+\.(?:webp|jpg|jpeg|png)$/);
    const result = await fetch(new URL(entry.local, origin), { redirect: 'error', signal: AbortSignal.timeout(15_000) });
    assert.equal(result.status, 200, `${entry.local}: unavailable`);
    assert.match(result.headers.get('content-type') ?? '', /^image\//);
    const bytes = Buffer.from(await result.arrayBuffer());
    assert.equal(bytes.length, entry.localBytes, `${entry.local}: size differs`);
    assert.equal(createHash('sha256').update(bytes).digest('hex'), entry.localSha256, `${entry.local}: content differs`);
    verified++;
  }
}));
const image = manifest[0].local;
const optimized = await fetch(new URL(`/_next/image?url=${encodeURIComponent(image)}&w=640&q=75`, origin), {
  headers: { Accept: 'image/webp' }, redirect: 'error', signal: AbortSignal.timeout(30_000),
});
assert.equal(optimized.status, 200, 'Owned catalog image rejected by the image optimizer');
assert.match(optimized.headers.get('content-type') ?? '', /^image\//);
assert.ok((await optimized.arrayBuffer()).byteLength > 0);
console.log(`PASS: ${verified} archived images served from own origin with matching SHA-256; image optimizer returns 200.`);
