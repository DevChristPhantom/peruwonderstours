import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import { bypassesMaintenance, isMaintenanceOn, MAINTENANCE_HEADERS, maintenanceHtml } from '../src/lib/maintenance/maintenance.mjs';
import { SITE } from '../src/lib/site.ts';

test('maintenance mode turns on only with an explicit value', () => {
  for (const value of ['on', 'ON', 'true', '1', ' on ']) assert.equal(isMaintenanceOn(value), true, value);
  for (const value of [undefined, '', 'off', 'false', '0', 'yes']) assert.equal(isMaintenanceOn(value), false, String(value));
});

test('pages answer maintenance while the API and static files keep working', () => {
  for (const path of ['/', '/es', '/es/tours', '/en/checkout', '/pt/passeios/x']) assert.equal(bypassesMaintenance(path), false, path);
  for (const path of ['/api/revalidate', '/brand/logo.png', '/mantenimiento.html', '/icons/whatsapp.svg']) assert.equal(bypassesMaintenance(path), true, path);
});

test('maintenance response is temporary, unindexed and self-contained', () => {
  assert.equal(MAINTENANCE_HEADERS['Retry-After'], '600');
  assert.equal(MAINTENANCE_HEADERS['Cache-Control'], 'no-store');
  assert.match(MAINTENANCE_HEADERS['X-Robots-Tag'], /noindex/);
  assert.match(MAINTENANCE_HEADERS['Content-Security-Policy'], /default-src 'none'/);
  const html = maintenanceHtml({ whatsappDigits: '51924278597', whatsappDisplay: '+51 924 278 597' });
  assert.match(html, /https:\/\/wa\.me\/51924278597\?text=/);
  for (const lang of ['lang="es-PE"', 'lang="en"', 'lang="pt-BR"']) assert.ok(html.includes(lang), lang);
  // Must render with the rest of the site down: no scripts, external styles or images.
  assert.doesNotMatch(html, /<script|<link|<img|src=/);
});

test('static page served by the reverse proxy matches the generator', () => {
  const file = readFileSync(new URL('../public/mantenimiento.html', import.meta.url), 'utf8');
  assert.equal(file, maintenanceHtml({ whatsappDigits: SITE.whatsapp.digits, whatsappDisplay: SITE.whatsapp.display }));
});
