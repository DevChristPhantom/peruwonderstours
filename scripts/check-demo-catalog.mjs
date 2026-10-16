import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const tours = JSON.parse(await readFile(new URL('../data/seed/tours.json', import.meta.url), 'utf8'));
const selected = [
  'tour-islas-de-los-uros-y-taquile-full-day',
  'full-day-machu-picchu-esencia-ciudadela',
  'tour-full-day-canon-del-colca',
  'tour-complejo-arqueologico-de-sillustani',
  'cusco-machu-picchu-premium-4d-3n',
];
const report = selected.map(slug => {
  const tour = tours.find(item => item.slug === slug);
  assert.ok(tour, `Missing presentation tour: ${slug}`);
  assert.ok(tour.title && tour.description?.length >= 100, `${slug}: incomplete introduction`);
  assert.ok(tour.itinerary?.length && tour.includes?.length && tour.images?.length, `${slug}: missing itinerary, inclusions or images`);
  return {
    slug, title: tour.title, path: `/es/tours/${slug}`,
    days: tour.durationDays, itineraryDays: tour.itinerary.length,
    images: tour.images.length, inclusions: tour.includes.length,
    confirmedSeedPrice: tour.price !== null,
    note: tour.price === null ? 'Sin tarifa confirmada en el contenido inicial; cotizar o cargar precio autorizado desde admin.' : 'Verificar vigencia en admin.',
  };
});
console.log(JSON.stringify({ tours: report, scope: 'Contenido editorial del seed; no acredita tarifas, cupos ni pagos reales.' }, null, 2));
