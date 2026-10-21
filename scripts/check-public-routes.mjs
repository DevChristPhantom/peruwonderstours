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
    const html = await result.text();
    assert.doesNotMatch(html, /(?:andeanperutours\.com|turinet\.turismoads\.com|turinet\.com\.pe)/i, `${path}: retired website reference in public response`);
    return html;
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

// Native banners expose images; uploaded scripts are never served by the web.
for (const id of ["builtin-titicaca", "builtin-machu-picchu"]) {
  const document = await fetch(new URL(`/api/hero-banners/${id}/document`, origin));
  assert.equal(document.status, 404, `${id}: executable document exposed`);
}
for (const image of ["titicaca-0.webp", "machu-picchu-0.webp"]) {
  const result = await fetch(new URL(`/hero-motion/${image}`, origin));
  assert.equal(result.status, 200, `${image}: image unavailable`);
  assert.ok(result.headers.get("content-type")?.startsWith("image/"));
}

for (const locale of ["es", "en", "pt"]) {
  const html = await response(`/${locale}`);
  assert.match(html, /<title>[^<]*peruwonderstours[^<]*<\/title>/, `${locale}: branded title missing`);
  const title = /<title>([^<]+)<\/title>/.exec(html)?.[1] ?? "";
  assert.ok(title.replace("peruwonderstours", "").trim().length > 10, `${locale}: descriptive title missing`);
  assert.match(html, /<meta name="description" content="[^"]{40,}"/, `${locale}: home description missing`);
  assert.ok(html.includes(`rel="canonical" href="https://peruwonderstours.com/${locale}"`), `${locale}: wrong home canonical`);
  for (const language of ["es-PE", "en", "pt-BR", "x-default"]) {
    assert.ok(html.includes(`hrefLang="${language}"`) || html.includes(`hreflang="${language}"`), `${locale}: missing ${language} alternate`);
  }
  assert.ok(html.includes("nativeScene"), `${locale}: native hero missing`);
  assert.ok(!html.includes("<iframe"), `${locale}: legacy hero frame still rendered`);
  const productPosition = html.indexOf('id="paquetes-title"');
  const resourcesPosition = html.indexOf('id="enlaces-oficiales"');
  assert.ok(productPosition >= 0 && resourcesPosition > productPosition, `${locale}: resources precede products`);
  assert.ok(html.includes("enlaces-oficiales"), `${locale}: official resources missing`);
  assert.ok(html.includes("/icons/whatsapp.svg"), `${locale}: floating WhatsApp symbol missing`);
  assert.ok(html.includes("complaints-book.webp"), `${locale}: complaints notice missing`);
  assert.ok(html.includes("peruwonderstours"), `${locale}: site brand missing`);
  assert.ok(html.includes("51924278597"), `${locale}: confirmed WhatsApp missing`);
  assert.ok(html.includes("peruwonderstours-dorado.png"), `${locale}: owner logo missing`);
  const contacts = { es: "/es/contactenos", en: "/en/contact", pt: "/pt/contato" };
  const contact = await response(contacts[locale]);
  assert.ok(contact.includes("mailto:jorgechaveztourt@gmail.com"), `${locale}: confirmed contact email missing`);
}

const sitemap = await response("/sitemap.xml");
const robots = await response("/robots.txt");
assert.ok(robots.includes("Sitemap: https://peruwonderstours.com/sitemap.xml"), "Robots sitemap mismatch");
assert.ok(!/^Disallow:\s*\/(?:es|en|pt)(?:\/|$)/m.test(robots), "Crawlers cannot read personal-page noindex");
for (const path of ["/es/carrito", "/en/cart", "/pt/carrinho", "/es/checkout", "/en/checkout", "/pt/checkout", "/es/favoritos", "/en/favorites", "/pt/favoritos"]) {
  const html = await response(path);
  assert.match(html, /<meta name="robots" content="[^"]*noindex/, `${path}: missing noindex`);
  assert.ok(!sitemap.includes(`<loc>https://peruwonderstours.com${path}</loc>`), `${path}: personal page in sitemap`);
}
for (const asset of ["/icons/whatsapp.svg", "/icons/rune/receipt.svg", "/official/complaints-book.webp", "/brand/peruwonderstours-dorado.png"]) {
  const image = await fetch(new URL(asset, origin));
  assert.equal(image.status, 200, `${asset}: visual asset unavailable`);
  assert.ok(image.headers.get("content-type")?.startsWith("image/"), `${asset}: unexpected content type`);
}
const urls = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((match) => new URL(match[1]));
assert.ok(urls.length > 100, "Sitemap is missing catalog pages");
assert.ok(urls.every((url) => url.hostname === "peruwonderstours.com"), "Wrong canonical domain");
assert.equal(new Set(urls.map((url) => url.href)).size, urls.length, "Duplicate sitemap entries");
const paths = new Set(urls.map((url) => url.pathname));
paths.add("/es/tours?destino=cuzco");
paths.add("/en/tours?adultos=2");
paths.add("/pt/tours?adultos=2");
for (const path of ["/es/nosotros", "/en/about", "/es/contactenos", "/en/contact", "/es/blog", "/en/blog", "/es/testimonios", "/en/reviews", "/pt/sobre-nos", "/pt/contato", "/pt/blog", "/pt/avaliacoes"]) {
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
console.log(`PASS: ${checked} public and legacy routes; canonical domain, es/en/pt, WhatsApp and email verified.`);

// Warm production-server HTTP timings, not browser Web Vitals or Internet latency.
for (const path of ["/es", "/es/tours", "/en", "/en/tours", "/pt", "/pt/tours"]) {
  const samples = [];
  for (let sample = 0; sample < 5; sample++) {
    const start = performance.now();
    await response(path);
    samples.push(Math.round(performance.now() - start));
  }
  const sorted = [...samples].sort((a, b) => a - b);
  console.log(`HTTP_TIMING ${JSON.stringify({ path, samples_ms: samples, median_ms: sorted[2], max_ms: sorted[4], mode: "production-local-warm", catalogSource: process.env.CATALOG_SOURCE ?? "not asserted" })}`);
}
