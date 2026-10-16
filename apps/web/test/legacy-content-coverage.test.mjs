import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const load = path => JSON.parse(readFileSync(new URL(path, import.meta.url), 'utf8'));
const manifest = load('../src/lib/content/tour-image-manifest.json');
const sources = new Set(manifest.map(item => item.source));

test('ES and EN preserve every extracted canonical catalogue and blog record', () => {
  for (const [kind, count] of [['tours', 41], ['destinations', 5], ['categories', 5], ['blog-posts', 6]]) {
    const es = load(`../../../data/seed/${kind}.json`), en = load(`../../../data/seed/en/${kind}.json`);
    assert.equal(es.length, count); assert.equal(en.length, count);
    assert.equal(new Set(es.map(item => item.slug)).size, count);
    assert.equal(new Set(en.map(item => item.slug)).size, count);
    assert.deepEqual(es.map(item => item.originalUrl).sort(), en.map(item => item.originalUrl).sort());
    if (kind === 'blog-posts') for (const post of [...es, ...en]) assert.ok(post.body.trim());
  }
});

test('every actual tour, destination, category and blog-cover image has its own local source copy', () => {
  const tours = load('../../../data/seed/tours.json');
  const destinations = load('../../../data/seed/destinations.json');
  const categories = load('../../../data/seed/categories.json');
  const blog = load('../../../data/seed/blog-posts.json');
  const groups = [tours.flatMap(item => [item.heroImage, ...(item.images ?? [])]), destinations.flatMap(item => [item.bannerImage, item.cardImage]), categories.map(item => item.bannerImage), blog.map(item => item.image)];
  for (const group of groups) for (const source of group.filter(Boolean)) assert.ok(sources.has(source), source);
  // All four extension-mislabelled source images are recovered, rather than substituted.
  assert.equal(manifest.filter(item => /\.heic$/i.test(item.source)).length, 4);
});
