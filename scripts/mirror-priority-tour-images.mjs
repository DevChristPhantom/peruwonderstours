import { createHash } from 'node:crypto';
import { readFile, mkdir, writeFile, unlink, readdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const webRequire = createRequire(new URL('../apps/web/package.json', import.meta.url));
const sharp = createRequire(webRequire.resolve('next/package.json'))('sharp');

const root = new URL('../', import.meta.url);
const maxBytes = 8 * 1024 * 1024;
const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
const sources = new Map();
function collect(value, key) {
  if (typeof value === 'string') {
    for (const match of value.matchAll(/https?:\/\/(?:(?:www\.)?andeanperutours\.com|turinet\.turismoads\.com)\/images\/[^\s"'<>()[\]\\]+/g)) {
      const source = match[0];
      sources.set(source, [...new Set([...(sources.get(source) ?? []), key])]);
    }
  } else if (Array.isArray(value)) value.forEach(item => collect(item, item?.slug ?? key));
  else if (value && typeof value === 'object') Object.values(value).forEach(item => collect(item, value.slug ?? key));
}
async function collectSeed(directory) {
  for (const item of await readdir(directory, { withFileTypes: true })) {
    const path = new URL(item.name + (item.isDirectory() ? '/' : ''), directory);
    if (item.isDirectory()) await collectSeed(path);
    else if (item.name.endsWith('.json') && item.name !== 'media-manifest.json') collect(JSON.parse(await readFile(path, 'utf8')), item.name);
  }
}
await collectSeed(new URL('data/seed/', root));
const records = [];
const failures = [];
const previousPath = new URL('apps/web/src/lib/content/tour-image-manifest.json', root);
const previous = JSON.parse(await readFile(previousPath, 'utf8').catch(() => '[]'));
await mkdir(new URL('apps/web/public/tours/', root), { recursive: true });
const queue = [...sources];
async function worker() {
for (;;) {
  const next = queue.shift();
  if (!next) return;
  const [source, tourKeys] = next;
  const existing = previous.find(record => record.source === source);
  if (existing && /^\/tours\/[a-f0-9]{20}\.(webp|jpg|png|avif)$/.test(existing.local)) {
    const bytes = await readFile(new URL(`apps/web/public${existing.local}`, root)).catch(() => null);
    if (bytes && sha256(bytes) === existing.localSha256) { records.push({ ...existing, tourKeys }); continue; }
  }
  try {
    const response = await fetch(source, { signal: AbortSignal.timeout(15_000), redirect: 'error' });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const mime = response.headers.get('content-type') ?? '';
    const heicOctetStream = /\.heic(?:$|\?)/i.test(source) && /^application\/octet-stream(?:;|$)/i.test(mime);
    if (!/^image\/(jpeg|png|webp|avif|heic|heif)(?:;|$)/i.test(mime) && !heicOctetStream) throw new Error(`Unsupported image MIME: ${mime}`);
    if (Number(response.headers.get('content-length')) > maxBytes) throw new Error('Image exceeds 8MB');
    const chunks = []; let length = 0;
    for await (const chunk of response.body) {
      length += chunk.length;
      if (length > maxBytes) throw new Error('Image exceeds 8MB');
      chunks.push(chunk);
    }
    const original = Buffer.concat(chunks);
    const inputMetadata = await sharp(original, { limitInputPixels: 40_000_000, animated: false }).metadata();
    if (!['jpeg', 'png', 'webp', 'avif', 'heif'].includes(inputMetadata.format)) throw new Error('Unsupported decoded format');
    const webp = await sharp(original, { limitInputPixels: 40_000_000, animated: false }).rotate().resize({ width: 1600, withoutEnlargement: true }).webp({ quality: 75 }).toBuffer();
    const useOriginal = original.length <= webp.length && (inputMetadata.format !== 'heif' || inputMetadata.compression === 'av1');
    const output = useOriginal ? original : webp;
    const dimensions = await sharp(output).metadata();
    const extension = useOriginal ? ({ jpeg: 'jpg', png: 'png', webp: 'webp', avif: 'avif', heif: 'avif' })[inputMetadata.format] : 'webp';
    const local = `/tours/${sha256(Buffer.from(source)).slice(0, 20)}.${extension}`;
    await writeFile(new URL(`apps/web/public${local}`, root), output);
    records.push({ source, local, tourKeys, encoding: useOriginal ? 'original' : 'webp75', originalBytes: original.length, localBytes: output.length, width: dimensions.width, height: dimensions.height, originalSha256: sha256(original), localSha256: sha256(output) });
    console.log(`${local}: ${original.length} -> ${output.length} bytes (${useOriginal ? 'original' : 'webp75'})`);
  } catch (error) {
    failures.push({ source, reason: String(error.cause?.code ?? error.message) });
    console.warn(`Skipped ${new URL(source).pathname}: ${error.cause?.code ?? error.message}`);
    const kept = previous.find(record => record.source === source);
    if (kept) {
      const localFile = await readFile(new URL(`apps/web/public${kept.local}`, root)).catch(() => null);
      if (localFile && sha256(localFile) === kept.localSha256) records.push(kept);
    }
  }
}
}
await Promise.all(Array.from({ length: 4 }, () => worker()));
if (!records.length) throw new Error('No images mirrored; original URLs remain in use. Manifest unchanged.');
records.sort((a, b) => a.source.localeCompare(b.source));
await writeFile(previousPath, `${JSON.stringify(records, null, 2)}\n`);
await writeFile(new URL('apps/web/src/lib/content/tour-image-failures.json', root), `${JSON.stringify(failures, null, 2)}\n`);
// Remove only prior generated copies replaced in this run, with an exact
// filename allowlist and a matching recorded checksum; never recurse/delete a directory.
for (const old of previous) {
  const replacement = records.find(record => record.source === old.source);
  if (!replacement || replacement.local === old.local || !/^\/tours\/[a-f0-9]{20}\.(webp|jpg|png|avif)$/.test(old.local)) continue;
  const oldPath = new URL(`apps/web/public${old.local}`, root);
  const bytes = await readFile(oldPath).catch(() => null);
  if (bytes && sha256(bytes) === old.localSha256) await unlink(oldPath);
}
console.log(JSON.stringify({ mirrored: records.length, inputBytes: records.reduce((sum, r) => sum + r.originalBytes, 0), outputBytes: records.reduce((sum, r) => sum + r.localBytes, 0), manifest: fileURLToPath(previousPath) }));
