import { ArrowUpRight, BookOpen, Compass, Feather } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { getTranslations } from 'next-intl/server';

import { localePath } from '@/i18n/paths';
import type { Locale } from '@/i18n/routing';
import { JOURNAL_TOPICS, type JournalTopic } from '@/lib/content/journal-topics';
import type { CatalogImage } from '@/lib/catalog/types';
import s from './EditorialMotion.module.css';

const icons = { historias: Feather, leyendas: BookOpen, guias: Compass };
const images = {
  historias: '/tours/ef9691fc2acf9e9da2ba.jpg',
  leyendas: '/tours/9e45462e326d8eb311f5.webp',
  guias: '/tours/68fa8606c8c73557ef5f.webp',
};

export async function JournalSection({
  locale,
  photos,
}: {
  locale: Locale;
  photos?: Partial<Record<JournalTopic, CatalogImage | null>>;
}) {
  const t = await getTranslations('journal');
  const blog = localePath(locale, '/blog');
  return (
    <section
      aria-labelledby="journal-title"
      className={`${s.section} border-y border-border bg-surface-muted py-14 md:py-20`}
    >
      <div className="pwt-container">
        <p className="text-sm font-medium uppercase tracking-[.16em] text-primary">
          {t('eyebrow')}
        </p>
        <div className="mt-3 flex flex-wrap items-end justify-between gap-5" data-reveal-scene="up">
          <div className="max-w-2xl">
            <h2 id="journal-title" className="font-display text-h2 font-medium">
              {t('title')}
            </h2>
            <p className="mt-3 text-foreground-muted">{t('intro')}</p>
          </div>
          <Link href={blog} className="pwt-link inline-flex min-h-11 items-center gap-2">
            {t('viewAll')}
            <ArrowUpRight aria-hidden size={18} />
          </Link>
        </div>
        <ul className="mt-8 grid gap-5 md:grid-cols-3">
          {JOURNAL_TOPICS.map((topic, index) => {
            const Icon = icons[topic];
            return (
              <li key={topic} data-reveal-scene={index === 0 ? 'left' : index === 2 ? 'right' : 'up'}>
                <Link
                  href={`${blog}?tema=${topic}`}
                  className={`${s.card} group relative flex min-h-72 overflow-hidden rounded-lg bg-foreground text-white no-underline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring`}
                >
                  <Image
                    src={photos?.[topic]?.src ?? images[topic]}
                    alt=""
                    fill
                    loading="lazy"
                    sizes="(min-width: 768px) 33vw, 100vw"
                    className="object-cover opacity-65 transition-transform duration-500 [@media(hover:hover)_and_(pointer:fine)_and_(prefers-reduced-motion:no-preference)]:group-hover:scale-105 motion-reduce:transition-none"
                  />
                  <div className="absolute inset-0 bg-linear-to-t from-black/90 via-black/35 to-black/10" />
                  <div className={`${s.body} relative flex w-full flex-col justify-end p-6`}>
                    <Icon aria-hidden size={24} strokeWidth={1.6} />
                    <h3 className="mt-4 text-h3 font-medium">{t(`${topic}.title`)}</h3>
                    <p className="mt-2 text-sm text-white/90">{t(`${topic}.description`)}</p>
                    <span className={`${s.action} mt-4 inline-flex items-center gap-2 text-sm font-medium`}>
                      {t('explore')}
                      <ArrowUpRight aria-hidden size={16} />
                    </span>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}
