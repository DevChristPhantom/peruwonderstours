import assert from "node:assert/strict";
import test from "node:test";
import { blogLocaleSlugs } from "../src/lib/content/blog-locale-slugs.ts";

test("new articles use published translations absent from the legacy seed", () => {
  const article = {
    slug: "viaje-a-las-islas",
    locale: "es",
    alternateLocales: [
      { locale: "es", slug: "viaje-a-las-islas" },
      { locale: "en", slug: "journey-to-the-islands" },
    ],
  };
  assert.deepEqual(blogLocaleSlugs(article, "es"), {
    es: "viaje-a-las-islas", en: "journey-to-the-islands", pt: "viaje-a-las-islas",
  });
  assert.deepEqual(blogLocaleSlugs({ ...article, slug: "journey-to-the-islands", locale: "en" }, "en"), {
    es: "viaje-a-las-islas", en: "journey-to-the-islands", pt: "viaje-a-las-islas",
  });
});

test("an editor's translation overrides an outdated legacy slug", () => {
  assert.equal(blogLocaleSlugs({
    slug: "guia-del-lago", locale: "es",
    alternateLocales: [{ locale: "en", slug: "updated-lake-guide" }],
  }, "es", "guia-del-lago", "old-lake-guide").en, "updated-lake-guide");
});

test("untranslated articles retain the existing fallback paths", () => {
  assert.deepEqual(blogLocaleSlugs({ slug: "guia-del-lago", locale: "es", fallback: true }, "en"), {
    es: "guia-del-lago", en: "guia-del-lago", pt: "guia-del-lago",
  });
  assert.equal(blogLocaleSlugs({ slug: "lake-guide", locale: "en" }, "en", "guia-del-lago").en, "lake-guide");
});

test("Portuguese uses its published slug and otherwise the Spanish canonical key", () => {
  const card = { slug: "viaje-a-las-islas", locale: "es", alternateLocales: [
    { locale: "en", slug: "journey-to-the-islands" }, { locale: "pt", slug: "viagem-as-ilhas" },
  ] };
  assert.equal(blogLocaleSlugs(card, "es").pt, "viagem-as-ilhas");
  assert.equal(blogLocaleSlugs({ slug: "viaje-a-las-islas", locale: "es", fallback: true }, "pt").pt, "viaje-a-las-islas");
});
