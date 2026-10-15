import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import { runInNewContext } from 'node:vm';
import test from 'node:test';
const require = createRequire(import.meta.url);
const ts = require('typescript');
const source = readFileSync(new URL('../src/lib/content/journal-articles.ts', import.meta.url), 'utf8');
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
const fixtureModule = { exports: {} };
runInNewContext(compiled, { module: fixtureModule, exports: fixtureModule.exports, require: id => {
  assert.equal(id, '@/i18n/paths');
  return { blogPostPath: (locale, slug) => `/${locale}/blog/${slug}` };
} });
const { journalArticles, mergeJournalArticles } = fixtureModule.exports;

test('editorial articles are translated, sourced and never presented as traveller testimony', () => {
  for (const locale of ['es', 'en', 'pt']) {
    const posts = journalArticles(locale);
    assert.equal(posts.length, 2);
    assert.equal(new Set(posts.map(post => post.key)).size, 2);
    for (const post of posts) {
      assert.equal(post.author, null);
      assert.equal(post.publishedAt, null);
      assert.equal(post.fallback, false);
      assert.ok(post.body.includes('https://'));
      assert.ok(post.body.includes('\n\n'), 'Editorial uses real Markdown paragraph breaks');
      assert.equal(post.body.includes('\\n'), false);
      assert.ok(['leyendas', 'guias'].includes(post.tags[0]));
      assert.ok(existsSync(new URL(`../public${post.image.src}`, import.meta.url)));
      assert.ok(post.alternates.es && post.alternates.en && post.alternates.pt);
    }
  }
  assert.notEqual(journalArticles('pt')[0].body, journalArticles('es')[0].body);
});

test('published CMS canonical keys and colliding locale paths take priority', () => {
  const curated = journalArticles('pt');
  const cms = { ...curated[0], title: 'CMS title', path: '/pt/blog/custom' };
  const result = mergeJournalArticles([cms], curated);
  assert.equal(result.length, 2);
  assert.equal(result[0].title, 'CMS title');
  const collision = { ...curated[0], key: 'another-key' };
  assert.equal(mergeJournalArticles([collision], curated).length, 2);
  assert.equal(mergeJournalArticles([], curated).length, 2);
});
