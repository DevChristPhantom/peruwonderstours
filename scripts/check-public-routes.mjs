import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { setTimeout as delay } from "node:timers/promises";

// GET-only smoke checks against a local preview, never customer data or payments.
// NextURL normalizes loopback IPs to localhost; use the same host for rewrites.
const origin = new URL(process.env.PWT_SMOKE_ORIGIN ?? "http://localhost:3100");
assert.ok(["127.0.0.1", "localhost", "[::1]"].includes(origin.hostname), "Use a local preview server");

async function response(path) {
  let url = new URL(path, origin);
  const visited = new Set();
  let result;
  for (;;) {
    assert.ok(!visited.has(url.href), `${path}: redirect loop at ${url.href}`);
    assert.ok(visited.size < 10, `${path}: too many redirects`);
    visited.add(url.href);
    try {
      result = await fetch(url, { redirect: "manual", signal: AbortSignal.timeout(30_000) });
    } catch (error) {
      throw new Error(`${path}: request failed at ${url.href}: ${error.message}`, { cause: error });
    }
    if (![301, 302, 303, 307, 308].includes(result.status)) break;
    const location = result.headers.get("location");
    assert.ok(location, `${path}: redirect without location`);
    url = new URL(location, url);
    assert.equal(url.origin, origin.origin, `${path}: redirect left local preview`);
  }
  assert.equal(result.status, 200, `${path}: expected 200, got ${result.status}`);
  try {
    return await result.text();
  } catch (error) {
    throw new Error(`${path}: response body failed: ${error.message}`, { cause: error });
  }
}

let ready = false;
for (let attempt = 0; attempt < 30; attempt++) {
  try { await response("/es"); ready = true; break; }
  catch { await delay(1_000); }
}
assert.ok(ready, "Preview server did not become ready");

// Assert final HTTP headers: the page proxy must not overwrite the frame policy.
for (const id of ["builtin-titicaca", "builtin-machu-picchu"]) {
  const banner = await fetch(`${origin.origin}/api/hero-banners/${id}/document`);
  assert.equal(banner.status, 200, `${id}: document unavailable`);
  assert.equal(banner.headers.get("x-frame-options"), "SAMEORIGIN", `${id}: frame blocked`);
  const policy = banner.headers.get("content-security-policy") ?? "";
  assert.ok(policy.includes("frame-ancestors 'self'"), `${id}: ancestors blocked`);
  assert.ok(policy.includes("sandbox allow-scripts"), `${id}: sandbox missing`);
  assert.ok(policy.includes("connect-src 'none'"), `${id}: network isolation missing`);
  assert.ok(!policy.includes("allow-same-origin"), `${id}: opaque isolation missing`);
  assert.ok((await banner.text()).includes("pointermove"), `${id}: mouse effects missing`);
}

for (const locale of ["es", "en"]) {
  const html = await response(`/${locale}`);
  assert.ok(html.includes("nativeScene"), `${locale}: native hero missing`);
  assert.ok(!html.includes("<iframe"), `${locale}: legacy hero frame still rendered`);
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

// Warm production-server HTTP timings, not browser Web Vitals or Internet latency.
for (const path of ["/es", "/es/tours", "/en", "/en/tours"]) {
  const samples = [];
  for (let sample = 0; sample < 5; sample++) {
    const start = performance.now();
    await response(path);
    samples.push(Math.round(performance.now() - start));
  }
  const sorted = [...samples].sort((a, b) => a - b);
  console.log(`HTTP_TIMING ${JSON.stringify({ path, samples_ms: samples, median_ms: sorted[2], max_ms: sorted[4], mode: "production-seed-local-warm" })}`);
}
