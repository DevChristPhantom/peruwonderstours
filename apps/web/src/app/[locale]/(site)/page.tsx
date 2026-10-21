import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';

import { DestinationsSection } from '@/components/home/DestinationsSection';
import { FeaturedTours, type FeaturedGroup } from '@/components/home/FeaturedTours';
import { Hero } from '@/components/home/Hero';
import { JournalSection } from '@/components/home/JournalSection';
import { PhotoGallery } from '@/components/home/PhotoGallery';
import { FinalCta, TestimonialsSection, WhyUsSection } from '@/components/home/HomeSections';
import { TrustStrip } from '@/components/layout/TrustStrip';
import { SearchBar } from '@/components/search/SearchBar';
import type { Locale } from '@/i18n/routing';
import {
  getAllTours,
  getDestinations,
  getFeaturedTours,
  getNavMedia,
  getSearchOptions,
} from '@/lib/catalog';
import { getTestimonials } from '@/lib/content/testimonials';
import { JsonLd, organizationJsonLd } from '@/lib/seo/json-ld';
import { alternatesFor, pageMetadata } from '@/lib/seo/metadata';
import { SITE } from '@/lib/site';

export async function generateMetadata({ params }: PageProps<'/[locale]'>): Promise<Metadata> {
  const locale = (await params).locale as Locale;
  const [t, ts] = await Promise.all([
    getTranslations({ locale, namespace: 'home' }),
    getTranslations({ locale, namespace: 'site' }),
  ]);
  const title = `${SITE.name} · ${t('metaTitle')}`;
  return {
    ...pageMetadata({ locale, title, description: ts('description'), paths: alternatesFor('/') }),
    title: { absolute: title },
  };
}

export default async function HomePage({ params }: PageProps<'/[locale]'>) {
  const locale = (await params).locale as Locale;
  setRequestLocale(locale);
  const [media, destinations, allTours, featured, searchOptions, testimonials, t] =
    await Promise.all([
      getNavMedia(locale),
      getDestinations(locale),
      getAllTours(locale),
      getFeaturedTours(locale, 5),
      getSearchOptions(locale),
      getTestimonials(locale),
      getTranslations('home.featured'),
    ]);

  const groups: FeaturedGroup[] = [
    { key: 'todos', label: t('groups.all'), tours: featured, emptyText: t('emptyFeatured') },
    {
      key: 'altiplano',
      label: t('groups.altiplano'),
      tours: allTours
        .filter(
          (tour) =>
            tour.destinationSlugs.includes('tours-en-puno') ||
            tour.categorySlugs.includes('rutas-del-altiplano'),
        )
        .slice(0, 6),
      emptyText: t('emptyGroup'),
    },
    {
      key: 'machu-picchu',
      label: t('groups.machuPicchu'),
      tours: allTours
        .filter((tour) => tour.categorySlugs.includes('tours-a-machu-picchu'))
        .slice(0, 6),
      emptyText: t('emptyGroup'),
    },
    {
      key: 'multidestino',
      label: t('groups.multi'),
      tours: allTours
        .filter(
          (tour) =>
            tour.destinationSlugs.length > 1 ||
            (tour.destinationSlugs.length === 0 && (tour.durationDays ?? 0) > 1),
        )
        .sort((a, b) => (b.durationDays ?? 0) - (a.durationDays ?? 0))
        .slice(0, 6),
      emptyText: t('emptyGroup'),
    },
  ];

  const photo = (key: string) => {
    const image = allTours.find((tour) => tour.key === key)?.image;
    return image && !image.src.includes('media-pending.svg') ? image : null;
  };

  return (
    <>
      <JsonLd data={organizationJsonLd()} />
      <Hero image={media.heroImage} />
      <div className="pwt-container">
        <SearchBar options={searchOptions} />
      </div>
      <FeaturedTours groups={groups} totalTours={allTours.length} locale={locale} />
      <DestinationsSection destinations={destinations} locale={locale} />
      <PhotoGallery tours={allTours} />
      <WhyUsSection
        tourCount={allTours.length}
        destinationCount={destinations.length}
        photo={photo('tour-complejo-arqueologico-de-sillustani')}
      />
      <TestimonialsSection testimonials={testimonials} locale={locale} />
      <JournalSection
        locale={locale}
        photos={{
          historias: photo('tour-islas-de-los-uros-y-taquile-full-day'),
          leyendas: photo('tour-complejo-arqueologico-de-sillustani'),
          guias: photo('full-day-maras-moray-sal-anden'),
        }}
      />
      <FinalCta photo={photo('full-day-machu-picchu-esencia-ciudadela')} />
      <TrustStrip locale={locale} />
    </>
  );
}
