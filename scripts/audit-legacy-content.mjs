import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';

const root = new URL('../', import.meta.url);
const load = async path => JSON.parse(await readFile(new URL(path, root), 'utf8'));
const kinds = ['tours', 'destinations', 'categories', 'blog-posts'];
const seed = {}, coverage = {};
for (const kind of kinds) {
  const es = await load(`data/seed/${kind}.json`), en = await load(`data/seed/en/${kind}.json`);
  seed[kind] = es;
  coverage[kind] = { es: es.length, en: en.length,
    englishMissingOriginalKeys: es.filter(item => !en.some(translation => translation.originalUrl === item.originalUrl)).map(item => item.slug),
    spanishKeys: es.map(item => item.slug),
    bodyEmpty: kind === 'blog-posts' ? es.filter(item => !item.body?.trim()).map(item => item.slug) : undefined };
}
const site = await load('data/seed/site-content.json');
const failures = await load('apps/web/src/lib/content/tour-image-failures.json');
const manifest = await load('apps/web/src/lib/content/tour-image-manifest.json');
const failureUsage = failures.map(failure => ({ ...failure,
  tours: seed.tours.filter(item => [item.heroImage, ...(item.images ?? [])].includes(failure.source)).map(item => item.slug),
  destinations: seed.destinations.filter(item => [item.bannerImage, item.cardImage].includes(failure.source)).map(item => item.slug),
  categories: seed.categories.filter(item => item.bannerImage === failure.source).map(item => item.slug),
  blogCovers: seed['blog-posts'].filter(item => item.image === failure.source).map(item => item.slug),
  blogBodyImages: seed['blog-posts'].filter(item => (item.bodyImages ?? []).includes(failure.source)).map(item => item.slug),
  siteArchive: JSON.stringify(site).includes(failure.source),
}));
const pages = [...new Set([
  'https://www.andeanperutours.com/es/tours', 'https://www.andeanperutours.com/es/blog',
  'https://www.andeanperutours.com/es/destinos', 'https://www.andeanperutours.com/es/tipos-de-tours',
  'https://www.andeanperutours.com/en/tours', site.aboutUs.sourceUrl, site.policies.paymentAndConditions.sourceUrl,
  ...seed.destinations.map(item => item.originalUrl), ...seed.categories.map(item => item.originalUrl),
])];
const remote = [], variants = [];
async function request(url, html = true) {
  const response = await fetch(url, { signal: AbortSignal.timeout(15_000), redirect: 'error' });
  if (!html) { await response.body?.cancel(); return { url, status: response.status, mime: response.headers.get('content-type') }; }
  const chunks = []; let bytes = 0;
  for await (const chunk of response.body) {
    bytes += chunk.length; if (bytes > 2 * 1024 * 1024) throw new Error('HTML exceeds 2MiB'); chunks.push(chunk);
  }
  const body = Buffer.concat(chunks).toString('utf8');
  const links = [...new Set([...body.matchAll(/href\s*=\s*["']([^"']+)["']/gi)].map(match => {
    try { return new URL(match[1], url).pathname; } catch { return ''; }
  }))];
  return { url, status: response.status, bytes, sha256: createHash('sha256').update(body).digest('hex'),
    title: /<title[^>]*>([^<]*)<\/title>/i.exec(body)?.[1] ?? null,
    tourSlugs: links.filter(path => /^\/es\/tours\/[^/]+\/?$/.test(path)).map(path => path.split('/').filter(Boolean).pop()),
    blogSlugs: links.filter(path => /^\/es\/blog\/[^/]+\/?$/.test(path)).map(path => path.split('/').filter(Boolean).pop()),
  };
}
let queue = [...pages];
async function worker() {
  for (;;) {
    const url = queue.shift(); if (!url) return;
    try { remote.push(await request(url)); } catch (error) { remote.push({ url, error: error.cause?.code ?? error.message }); }
  }
}
await Promise.all(Array.from({ length: 4 }, worker));
for (const failure of failures.filter(item => item.reason === 'HTTP 404')) {
  const url = new URL(failure.source);
  // Same filename, only conventional size directories. Do not substitute another photograph.
  for (const size of ['sm', 'md', 'lg']) {
    const candidate = new URL(url); candidate.pathname = url.pathname.replace(/\/([^/]+)$/, `/${size}/$1`);
    try { variants.push({ original: failure.source, ...await request(candidate.href, false) }); }
    catch (error) { variants.push({ original: failure.source, url: candidate.href, error: error.cause?.code ?? error.message }); }
  }
}
const liveTours = [...new Set(remote.flatMap(item => item.tourSlugs ?? []))];
const liveBlog = [...new Set(remote.flatMap(item => item.blogSlugs ?? []))];
const report = { checkedAt: new Date().toISOString(), coverage,
  live: { pages: remote, tourSlugs: liveTours, blogSlugs: liveBlog,
    toursAbsentFromSeed: liveTours.filter(slug => !seed.tours.some(item => item.slug === slug)),
    blogAbsentFromSeed: liveBlog.filter(slug => !seed['blog-posts'].some(item => item.slug === slug)) },
  photos: { mirrored: manifest.length, originalBytes: manifest.reduce((sum, item) => sum + item.originalBytes, 0), localBytes: manifest.reduce((sum, item) => sum + item.localBytes, 0), failures: failureUsage, variants },
  archive: { pages: Object.keys(site), blogBodyImages: seed['blog-posts'].map(item => ({ slug: item.slug, count: (item.bodyImages ?? []).length })), tourPricesMissing: seed.tours.filter(item => item.price == null).length },
};
await writeFile(new URL('docs/qa/legacy-content-coverage-2026-10-16.json', root), `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify({ records: coverage, remotePages: remote.length, newTourSlugs: report.live.toursAbsentFromSeed, newBlogSlugs: report.live.blogAbsentFromSeed, images: manifest.length, failures: failures.length, variants200: variants.filter(item => item.status === 200).length }));
