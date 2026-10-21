import { ArrowUpRight } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { getTranslations } from 'next-intl/server';

import type { TourSummary } from '@/lib/catalog/types';
import s from './PhotoGallery.module.css';

const selection = [
  'tour-islas-de-los-uros-y-taquile-full-day',
  'full-day-machu-picchu-esencia-ciudadela',
  'laguna-humantay-espejo-turquesa',
  'full-day-vinicunca-montana-arcoiris',
  'tour-full-day-canon-del-colca',
];

/** Server-rendered photographs from the current catalog; no extra API requests or carousel JS. */
export async function PhotoGallery({ tours }: { tours: TourSummary[] }) {
  const t = await getTranslations('home.gallery');
  const byKey = new Map(tours.map((tour) => [tour.key, tour]));
  const ordered = [...selection.map((key) => byKey.get(key)), ...tours];
  const seen = new Set<string>();
  const photos = ordered
    .filter((tour): tour is TourSummary => {
      if (!tour?.image || tour.image.src.includes('media-pending.svg') || seen.has(tour.image.src))
        return false;
      seen.add(tour.image.src);
      return true;
    })
    .slice(0, 5);
  if (!photos.length) return null;
  return (
    <section className={`pwt-section ${s.section}`} aria-labelledby="photo-gallery-title">
      <div className="pwt-container">
        <div className="mb-8 max-w-2xl" data-reveal-scene="up">
          <p className="text-sm font-medium uppercase tracking-[.16em] text-primary">
            {t('eyebrow')}
          </p>
          <h2 id="photo-gallery-title" className="mt-3 font-display text-h2 font-medium">
            {t('title')}
          </h2>
          <p className="mt-3 text-foreground-muted">{t('intro')}</p>
        </div>
        <ul className={s.grid} data-photo-gallery>
          {photos.map((tour, index) => (
            <li
              key={tour.key}
              className={index === 0 ? s.featured : undefined}
              lang={tour.fallback ? 'es-PE' : undefined}
              data-reveal-scene={index === 0 ? 'left' : 'up'}
            >
              <Link href={tour.path} className={s.card}>
                <Image
                  src={tour.image!.src}
                  alt={tour.image!.alt || tour.title}
                  fill
                  loading="lazy"
                  sizes={
                    index === 0
                      ? '(min-width: 1024px) 50vw, 100vw'
                      : '(min-width: 1024px) 25vw, 50vw'
                  }
                  className={s.photo}
                />
                <div className={s.shade} />
                <div className={s.caption}>
                  <span className={s.place}>{tour.destinationNames.join(' · ')}</span>
                  <h3 className={s.title}>{tour.shortTitle}</h3>
                  <span className={s.action}>
                    {t('openTour')}
                    <ArrowUpRight aria-hidden size={18} />
                  </span>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
