import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { runInNewContext } from 'node:vm';
import test from 'node:test';

const require = createRequire(import.meta.url);
const ts = require('typescript');
// Execute the real helpers without starting Next or a browser. Only framework
// routing is supplied as a fixture; SITE and URL normalization come from source.
function load(relative, dependencies = {}) {
  const source = readFileSync(new URL(relative, import.meta.url), 'utf8');
  const output = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText;
  const compiledModule = { exports: {} };
  runInNewContext(output, { exports: compiledModule.exports, module: compiledModule, URL, process: { env: {} }, require: id => {
    if (Object.hasOwn(dependencies, id)) return dependencies[id];
    if (id === 'react/jsx-runtime') return require(id);
    throw new Error(`Unexpected SEO helper dependency: ${id}`);
  } });
  return compiledModule.exports;
}
const site = load('../src/lib/site.ts');
const jsonLd = load('../src/lib/seo/json-ld.tsx', { '@/lib/site': site });
const metadata = load('../src/lib/seo/metadata.ts', {
  '@/lib/site': site,
  '@/i18n/paths': { localePath: (locale, href) => `/${locale}${href === '/' ? '' : href}` },
  '@/i18n/routing': { HREFLANG: { es: 'es-PE', en: 'en', pt: 'pt-BR' }, OG_LOCALE: { es: 'es_PE', en: 'en_US', pt: 'pt_BR' }, routing: { locales: ['es', 'en', 'pt'], defaultLocale: 'es' } },
});

test('organization publishes confirmed contact, SUNAT identity and owner logo without invented ratings', () => {
  const agency = jsonLd.organizationJsonLd();
  assert.equal(agency['@id'], 'https://peruwonderstours.com/#organization');
  assert.equal(agency.logo, 'https://peruwonderstours.com/brand/peruwonderstours-logo-color.png');
  assert.equal(agency.email, 'jorgechaveztourt@gmail.com');
  assert.equal(agency.telephone, '+51924278597');
  assert.equal(agency.address.streetAddress, site.SITE.legal.address);
  assert.equal(agency.address.addressCountry, 'PE');
  assert.equal('aggregateRating' in agency, false);
  assert.equal(agency.legalName, 'PERU WONDERS TOURS S.A.C.');
  assert.equal(agency.taxID, '20616102339');
  assert.equal('vatID' in agency, false);
  assert.equal(JSON.stringify(agency).includes('20000000000'), false);
});

test('a tour price is not misrepresented as confirmed stock or availability', () => {
  const tour = { title: 'Tour fixture', metaDescription: 'Tour description', excerpt: '', path: '/pt/tours/fixture', fallback: false, gallery: [], categorySlugs: [], itinerary: [], pricing: { adultCents: 12345, currency: 'PEN' } };
  const trip = jsonLd.touristTripJsonLd(tour, 'pt', day => `Dia ${day}`);
  assert.equal(trip.offers.price, '123.45');
  assert.equal(trip.offers.priceCurrency, 'PEN');
  assert.equal('availability' in trip.offers, false);
  assert.equal(trip.provider['@id'], jsonLd.organizationJsonLd()['@id']);
  assert.equal('offers' in jsonLd.touristTripJsonLd({ ...tour, pricing: null }, 'pt', () => ''), false);
});

test('public metadata has matching social cards, a real logo fallback and large image previews', () => {
  const page = metadata.pageMetadata({ locale: 'pt', title: 'Passeios', description: 'Viagens pelo Peru', paths: { es: '/es/tours', en: '/en/tours', pt: '/pt/tours' } });
  assert.equal(page.openGraph.images[0].url, site.absoluteUrl('/brand/peruwonderstours-logo-color.png'));
  assert.equal(page.twitter.images[0].url, page.openGraph.images[0].url);
  assert.equal(page.twitter.title, 'Passeios');
  assert.equal(page.twitter.description, page.description);
  assert.equal(page.openGraph.locale, 'pt_BR');
  assert.equal(page.alternates.languages['pt-BR'], '/pt/tours');
  assert.equal(page.robots.googleBot['max-image-preview'], 'large');
});

test('explicit page images are retained and noindex is not turned into an indexing directive', () => {
  const page = metadata.pageMetadata({ locale: 'es', title: 'Reserva', description: 'Private fixture', paths: { es: '/es/reserva/fixture', en: '/en/booking/fixture', pt: '/pt/reserva/fixture' }, image: '/photo.webp', index: false });
  assert.equal(page.twitter.images[0].url, site.absoluteUrl('/photo.webp'));
  assert.equal(page.openGraph.images[0].url, site.absoluteUrl('/photo.webp'));
  assert.equal(page.robots.index, false);
  assert.equal('googleBot' in page.robots, false);
});
