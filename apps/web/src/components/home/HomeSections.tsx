import { MapPinned, MessageCircle, Users, Wallet } from 'lucide-react';
import { getTranslations } from 'next-intl/server';
import Image from 'next/image';

import { buttonClass } from '@/components/ui/button-styles';
import { SectionHeading } from '@/components/ui/SectionHeading';
import { Link } from '@/i18n/navigation';
import { localePath } from '@/i18n/paths';
import type { Locale } from '@/i18n/routing';
import type { PublicTestimonial } from '@/lib/content/testimonials';
import type { CatalogImage } from '@/lib/catalog/types';
import { SITE, whatsappHref } from '@/lib/site';

import { TestimonialCard } from './TestimonialCard';

/* ---------- Por qué viajar con nosotros (home.md §7) ---------- */

export async function WhyUsSection({
  tourCount,
  destinationCount,
  photo,
}: {
  tourCount: number;
  destinationCount: number;
  photo?: CatalogImage | null;
}) {
  const t = await getTranslations('home.whyUs');
  // Solo datos verificables: conteos del catálogo y reglas ya publicadas por el cliente (RN-01).
  // PENDIENTE(cliente): año de apertura de la oficina y certificación de guías antes de afirmarlos.
  const reasons = [
    { icon: MapPinned, key: 'office' },
    { icon: Users, key: 'guides' },
    { icon: Wallet, key: 'deposit' },
    { icon: MessageCircle, key: 'whatsapp' },
  ] as const;
  return (
    <section className="pwt-section" aria-labelledby="porque-title">
      <div className="pwt-container">
        <div
          className={
            photo ? 'grid items-center gap-10 lg:grid-cols-[.9fr_1.1fr] lg:gap-16' : undefined
          }
        >
          {photo ? (
            <figure data-reveal-scene="up" className="relative aspect-[4/3] overflow-hidden rounded-2xl bg-surface-muted lg:aspect-[4/5]">
              <Image
                src={photo.src}
                alt={photo.alt}
                fill
                loading="lazy"
                sizes="(min-width: 1024px) 45vw, 100vw"
                className="object-cover"
              />
            </figure>
          ) : null}
          <div>
            <SectionHeading id="porque-title" title={t('title')} />
            <dl
              className="mb-12 grid grid-cols-2 gap-6 border-y border-border py-8 md:max-w-xl"
              data-reveal
            >
              <div>
                <dt className="text-sm text-foreground-muted">{t('toursPublished')}</dt>
                <dd className="tabular font-display text-display-xl" data-count-to={tourCount}>
                  {tourCount}
                </dd>
              </div>
              <div>
                <dt className="text-sm text-foreground-muted">{t('destinations')}</dt>
                <dd
                  className="tabular font-display text-display-xl"
                  data-count-to={destinationCount}
                >
                  {destinationCount}
                </dd>
              </div>
            </dl>
            <ul
              className={`grid gap-8 sm:grid-cols-2 ${photo ? '' : 'lg:grid-cols-4'}`}
              data-reveal-stagger
            >
              {reasons.map(({ icon: Icon, key }) => (
                <li key={key} className="rounded-xl border border-border bg-surface p-5">
                  <span className="inline-flex size-12 items-center justify-center rounded-full bg-surface-muted text-primary">
                    <Icon aria-hidden size={22} strokeWidth={1.5} />
                  </span>
                  <h3 className="mt-3 text-h4 font-medium">{t(`reasons.${key}.title`)}</h3>
                  <p className="mt-1 text-foreground-muted">{t(`reasons.${key}.text`)}</p>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ---------- Testimonios reales (W7): sin testimonios, no hay sección ---------- */

export async function TestimonialsSection({
  testimonials,
  locale,
}: {
  testimonials: PublicTestimonial[];
  locale: Locale;
}) {
  if (!testimonials.length) return null;
  const t = await getTranslations('testimonials');
  return (
    <section className="pwt-section bg-surface-muted" aria-labelledby="testimonios-title">
      <div className="pwt-container">
        <SectionHeading
          id="testimonios-title"
          title={t('homeTitle')}
          link={{ href: localePath(locale, '/testimonios'), label: t('viewAll') }}
        />
        <ul className="grid gap-6 md:grid-cols-2 lg:grid-cols-4" data-reveal-stagger>
          {testimonials.slice(0, 4).map((item) => (
            <li key={item.id}>
              <TestimonialCard testimonial={item} locale={locale} />
            </li>
          ))}
        </ul>
        <p className="mt-6">
          <Link href="/dejar-testimonio" className="pwt-link inline-flex min-h-11 items-center">
            {t('leaveCta')}
          </Link>
        </p>
      </div>
    </section>
  );
}

/* ---------- CTA final ---------- */

export async function FinalCta({ photo }: { photo?: CatalogImage | null } = {}) {
  const t = await getTranslations('home.finalCta');
  return (
    <section
      className="relative isolate overflow-hidden bg-primary py-20 text-on-primary md:py-28 [&_:focus-visible]:outline-on-primary"
      aria-labelledby="cta-title"
    >
      {photo ? (
        <>
          <Image
            src={photo.src}
            alt=""
            fill
            loading="lazy"
            sizes="100vw"
            className="-z-20 object-cover"
          />
          <div className="absolute inset-0 -z-10 bg-linear-to-r from-black/85 via-black/70 to-black/60" />
        </>
      ) : null}
      <div className="pwt-container relative flex flex-col items-start gap-6 md:flex-row md:items-center md:justify-between">
        <div className="max-w-xl" data-reveal>
          <h2 id="cta-title" className="font-display text-h2 font-medium">
            {t('title')}
          </h2>
          <p className="mt-3 text-body-lg opacity-90">{t('text')}</p>
        </div>
        <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row">
          <a
            href={whatsappHref(t('whatsappMessage', { name: SITE.name }))}
            target="_blank"
            rel="noopener noreferrer"
            className={buttonClass('inverse', 'lg')}
          >
            <MessageCircle aria-hidden size={20} strokeWidth={1.5} />
            {t('whatsapp')}
          </a>
          <Link
            href={{
              pathname: '/categorias/[slug]',
              params: { slug: 'paquetes-turisticos-en-peru' },
            }}
            className={buttonClass('outline-inverse', 'lg')}
          >
            {t('packages')}
          </Link>
        </div>
      </div>
    </section>
  );
}
