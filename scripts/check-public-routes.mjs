import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { setTimeout as delay } from "node:timers/promises";

// GET-only smoke checks against a local preview, never customer data or payments.
const origin = new URL(process.env.PWT_SMOKE_ORIGIN ?? "http://127.0.0.1:3100");
assert.ok(["127.0.0.1", "localhost", "[::1]"].includes(origin.hostname), "Use a local preview server");

async function response(path) {
  const result = await fetch(new URL(path, origin), { signal: AbortSignal.timeout(30_000) });
  assert.equal(result.status, 200, `${path}: expected 200, got ${result.status}`);
  return result.text();
}

let ready = false;
for (let attempt = 0; attempt < 30; attempt++) {
  try { await response("/es"); ready = true; break; }
  catch { await delay(1_000); }
}
assert.ok(ready, "Preview server did not become ready");

for (const locale of ["es", "en"]) {
  const html = await response(`/${locale}`);
  assert.ok(html.includes("Peru Wonders Tours"), `${locale}: site brand missing`);
  assert.ok(html.includes("51924278597"), `${locale}: confirmed WhatsApp missing`);
  const contact = await response(locale === "es" ? "/es/contactenos" : "/en/contact");
  assert.ok(contact.includes("mailto:jorgechaveztourt@gmail.com"), `${locale}: confirmed contact email missing`);
}

const sitemap = await response("/sitemap.xml");
const urls = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((match) => new URL(match[1]));
assert.ok(urls.length > 100, "Sitemap is missing catalog pages");
assert.ok(urls.every((url) => url.hostname === "peruwonderstours.com"), "Wrong canonical domain");
assert.equal(new Set(urls.map((url) => url.href)).size, urls.length, "Duplicate sitemap entries");
const paths = new Set(urls.map((url) => url.pathname));
paths.add("/es/tours?destino=cuzco");
paths.add("/en/tours?adultos=2");
for (const path of ["/es/nosotros", "/en/about", "/es/contactenos", "/en/contact", "/es/blog", "/en/blog", "/es/testimonios", "/en/reviews"]) {
  assert.ok(paths.has(path), `Sitemap missing ${path}`);
}

const redirects = JSON.parse(await readFile(new URL("../data/seed/redirects.json", import.meta.url), "utf8"));
for (const rule of redirects.rules) paths.add(new URL(rule.from).pathname);
let checked = 0;
const queue = [...paths];
await Promise.all(Array.from({ length: 4 }, async () => {
  while (queue.length) {
    const path = queue.shift();
    await response(path);
    checked++;
  }
}));
console.log(`PASS: ${checked} public and legacy routes; canonical domain, es/en, WhatsApp and email verified.`);
