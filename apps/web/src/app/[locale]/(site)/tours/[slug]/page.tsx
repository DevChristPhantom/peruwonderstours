import { AlertTriangle, CalendarDays, Check, Gauge, Languages, MapPin, Users, X } from "lucide-react";
import type { Metadata } from "next";
import { notFound, permanentRedirect } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { CompareToggle } from "@/components/compare/CompareToggle";
import { Breadcrumbs } from "@/components/layout/Breadcrumbs";
import { LocaleAlternates } from "@/components/layout/LanguageSwitcher";
import { BookingPanel, MobileBookingBar, type BookableTour } from "@/components/tours/BookingPanel";
import { TourCard } from "@/components/tours/TourCard";
import { TourGallery } from "@/components/tours/TourGallery";
import { Accordion } from "@/components/ui/Accordion";
import { FavoriteButton } from "@/components/wishlist/FavoriteButton";
import { Link } from "@/i18n/navigation";
import { localePath } from "@/i18n/paths";
import { routing, type Locale } from "@/i18n/routing";
import { getAllTours, getDestinations, getRelatedTours, getTour } from "@/lib/catalog";
import { durationText } from "@/lib/i18n/units";
import { faqJsonLd, JsonLd, touristTripJsonLd } from "@/lib/seo/json-ld";
import { pageMetadata } from "@/lib/seo/metadata";

// Slugs nuevos publicados en la API se generan bajo demanda (ISR); los desconocidos dan 404.
export const dynamicParams = true;
export const revalidate = 3600;

export async function generateStaticParams() {
  const all = await Promise.all(routing.locales.map(async (locale) => (await getAllTours(locale)).map((t) => ({ locale, slug: t.slug }))));
  return all.flat();
}

export async function generateMetadata({ params }: PageProps<"/[locale]/tours/[slug]">): Promise<Metadata> {
  const { slug, locale: raw } = await params;
  const locale = raw as Locale;
  const tour = await getTour(decodeURIComponent(slug), locale);
  if (!tour) return {};
  return pageMetadata({ locale, title: tour.metaTitle, description: tour.metaDescription, paths: tour.alternates, image: tour.image?.src });
}

/** Avisos de altura por destino (clave en español). */
const ALTITUDE_KEYS: Record<string, "puno" | "cusco"> = { "tours-en-puno": "puno", cuzco: "cusco" };

function SectionTitle({ id, children }: { id: string; children: React.ReactNode }) {
  return (
    <h2 id={id} className="scroll-mt-32 font-display text-h2 font-medium" data-reveal>
      {children}
    </h2>
  );
}

export default async function TourPage({ params }: PageProps<"/[locale]/tours/[slug]">) {
  const { slug: rawSlug, locale: raw } = await params;
  const locale = raw as Locale;
  setRequestLocale(locale);
  const slug = decodeURIComponent(rawSlug);
  const tour = await getTour(slug, locale);
  if (!tour) notFound();
  // Slug de otro idioma (carrito, favoritos, enlaces viejos) → URL canónica de este idioma.
  if (tour.slug !== slug) permanentRedirect(tour.path);

  const [related, destinations, t, tu, tc] = await Promise.all([
    getRelatedTours(tour, locale, 3),
    getDestinations(locale),
    getTranslations("tour"),
    getTranslations("units"),
    getTranslations("common"),
  ]);
  const primaryDestination = destinations.find((d) => tour.destinationSlugs.includes(d.key));
  const places = tour.destinationNames.length ? tour.destinationNames.join(", ") : tc("severalDestinations");
  const multiDay = (tour.durationDays ?? 1) > 1 && tour.itinerary.length > 1;
  const altitudeNotes = tour.destinationSlugs.map((d) => ALTITUDE_KEYS[d]).filter(Boolean).map((k) => t(`altitude.${k}`));
  const summaryLines = tour.summaryText?.split("\n").map((l) => l.trim()).filter(Boolean) ?? [];
  const contentLang = tour.fallback ? "es-PE" : undefined;

  const bookable: BookableTour = {
    slug: tour.key,
    title: tour.shortTitle,
    path: tour.path,
    image: tour.image,
    destinationLabel: places,
    durationLabel: durationText(tu, tour.durationDays, tour.durationNights),
    minPax: tour.minPax,
    pricing: tour.pricing,
    paymentPolicy: tour.paymentPolicy,
    durationDays: tour.durationDays,
    destinationSlugs: tour.destinationSlugs,
    difficulty: tour.difficulty,
  };

  const sections = [
    { id: "resumen", label: t("sections.summary") },
    { id: "itinerario", label: t("sections.itinerary"), show: tour.itinerary.length > 0 },
    { id: "incluye", label: t("sections.includes"), show: tour.includes.length + tour.notIncludes.length > 0 },
    { id: "antes-de-viajar", label: t("sections.beforeTravel") },
    { id: "politicas", label: t("sections.policies") },
    { id: "preguntas", label: t("sections.faq"), show: tour.faqs.length > 0 },
  ].filter((s) => s.show !== false);

  const faq = faqJsonLd(tour.faqs);
  const trip = touristTripJsonLd(tour, locale, (day) => t("day", { day }));

  return (
    <div className="pb-28 lg:pb-0">
      <JsonLd data={faq ? [trip, faq] : trip} />
      <LocaleAlternates value={tour.alternates} />

      <div className="pwt-container pt-6">
        <Breadcrumbs
          items={[
            { name: tc("home"), path: localePath(locale, "/") },
            ...(primaryDestination
              ? [
                  { name: tc("destinations"), path: localePath(locale, "/destinos") },
                  { name: primaryDestination.name, path: primaryDestination.path },
                ]
              : [{ name: tc("tours"), path: localePath(locale, "/tours") }]),
            { name: tour.shortTitle, path: tour.path },
          ]}
        />
        <div className="mt-4">
          <TourGallery images={tour.gallery} title={tour.shortTitle} />
        </div>

        <header className="mt-8 max-w-4xl">
          {tour.fallback ? (
            <p className="mb-3 inline-flex items-center gap-2 rounded-pill bg-surface-muted px-3 py-1 text-sm text-foreground-muted">
              <Languages aria-hidden size={16} strokeWidth={1.5} />
              {tc("fallbackNotice")}
            </p>
          ) : null}
          <h1 lang={contentLang} className="font-display text-display-xl font-normal">
            {tour.title}
          </h1>
          <ul className="mt-5 flex flex-wrap gap-x-6 gap-y-2 text-foreground-muted">
            <li className="inline-flex items-center gap-2">
              <CalendarDays aria-hidden size={20} strokeWidth={1.5} />
              {durationText(tu, tour.durationDays, tour.durationNights)}
            </li>
            <li className="inline-flex items-center gap-2">
              <MapPin aria-hidden size={20} strokeWidth={1.5} />
              {places}
            </li>
            <li className="inline-flex items-center gap-2">
              <Users aria-hidden size={20} strokeWidth={1.5} />
              {t("minPax", { count: tour.minPax })}
            </li>
            {tour.difficulty ? (
              <li className="inline-flex items-center gap-2">
                <Gauge aria-hidden size={20} strokeWidth={1.5} />
                {t("difficulty", { value: tour.difficulty })}
              </li>
            ) : null}
          </ul>
          {tour.paymentPolicy.depositPercent < 100 ? (
            <p className="mt-4 inline-block rounded-pill bg-success-soft px-3 py-1 text-sm text-success">
              {t("depositBadge", { percent: tour.paymentPolicy.depositPercent })}
            </p>
          ) : (
            <p className="mt-4 inline-block rounded-pill bg-warning-soft px-3 py-1 text-sm text-warning">{t("fullPaymentBadge")}</p>
          )}
          <div className="mt-5 flex flex-wrap gap-2">
            <FavoriteButton slug={tour.key} title={tour.shortTitle} destinationSlugs={tour.destinationSlugs} variant="inline" />
            <CompareToggle slug={tour.key} title={tour.shortTitle} />
          </div>
        </header>
      </div>

      {/* Índice de secciones (sticky ≥ 768) */}
      <nav aria-label={t("sectionsNav")} className="sticky top-16 z-[5] mt-8 hidden border-y border-border bg-background/95 backdrop-blur md:block">
        <ul className="pwt-container flex gap-6 overflow-x-auto">
          {sections.map((s) => (
            <li key={s.id}>
              <a href={`#${s.id}`} className="inline-flex min-h-12 items-center text-sm font-medium whitespace-nowrap text-foreground-muted hover:text-foreground">
                {s.label}
              </a>
            </li>
          ))}
        </ul>
      </nav>

      <div className="pwt-container mt-10 grid gap-12 lg:grid-cols-[1fr_380px] xl:grid-cols-[1fr_400px] xl:gap-12">
        <div className="min-w-0 space-y-16" lang={contentLang}>
          <section aria-labelledby="resumen">
            <SectionTitle id="resumen">{t("sections.summary")}</SectionTitle>
            <p className="pwt-prose mt-4 text-body-lg">{tour.description}</p>
            {summaryLines.length ? (
              <ul className="mt-6 space-y-3">
                {summaryLines.map((line) => (
                  <li key={line} className="flex gap-3">
                    <Check aria-hidden size={20} strokeWidth={1.5} className="mt-1 shrink-0 text-success" />
                    <span>{line}</span>
                  </li>
                ))}
              </ul>
            ) : null}
          </section>

          {/* Reserva en flujo para móvil/tablet (en desktop va en la columna lateral). */}
          <div className="lg:hidden" lang={locale}>
            <BookingPanel tour={bookable} />
          </div>

          {tour.itinerary.length ? (
            <section aria-labelledby="itinerario">
              <SectionTitle id="itinerario">{t("sections.itinerary")}</SectionTitle>
              <div className="mt-6">
                {multiDay ? (
                  <Accordion
                    defaultOpen={["dia-1"]}
                    items={tour.itinerary.map((step, i) => ({
                      key: `dia-${i + 1}`,
                      title: (
                        <>
                          <span className="text-primary">{t("day", { day: step.day })}</span>
                          {step.title ? ` · ${step.title}` : ""}
                        </>
                      ),
                      content: <p className="pwt-prose text-foreground-muted">{step.description}</p>,
                    }))}
                  />
                ) : (
                  <ol className="relative space-y-8 border-l border-border pl-6">
                    {tour.itinerary.map((step, i) => (
                      <li key={i} className="relative">
                        <span aria-hidden="true" className="absolute top-1.5 -left-[31px] size-3 rounded-pill border-2 border-primary bg-surface" />
                        {step.title ? <h3 className="text-h4 font-medium">{step.title}</h3> : null}
                        <p className="pwt-prose mt-1 text-foreground-muted">{step.description}</p>
                      </li>
                    ))}
                  </ol>
                )}
              </div>
            </section>
          ) : null}

          {tour.includes.length + tour.notIncludes.length > 0 ? (
            <section aria-labelledby="incluye" className="grid gap-10 md:grid-cols-2">
              <div>
                <SectionTitle id="incluye">{t("sections.includes")}</SectionTitle>
                <ul className="mt-4 space-y-3">
                  {tour.includes.map((item) => (
                    <li key={item} className="flex gap-3">
                      <Check aria-hidden size={20} strokeWidth={1.5} className="mt-0.5 shrink-0 text-success" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <h2 className="font-display text-h2 font-medium" data-reveal>
                  {t("notIncludes")}
                </h2>
                <ul className="mt-4 space-y-3">
                  {tour.notIncludes.map((item) => (
                    <li key={item} className="flex gap-3">
                      <X aria-hidden size={20} strokeWidth={1.5} className="mt-0.5 shrink-0 text-foreground-muted" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </section>
          ) : null}

          <section aria-labelledby="antes-de-viajar">
            <SectionTitle id="antes-de-viajar">{t("sections.beforeTravel")}</SectionTitle>
            {altitudeNotes.map((note) => (
              <p key={note} lang={locale} className="mt-4 flex gap-3 rounded-md bg-warning-soft p-4 text-warning">
                <AlertTriangle aria-hidden size={20} strokeWidth={1.5} className="mt-0.5 shrink-0" />
                {note}
              </p>
            ))}
            {tour.recommendations.length ? (
              <>
                <h3 className="mt-6 text-h4 font-medium">{t("recommendations")}</h3>
                <ul className="mt-3 list-disc space-y-2 pl-5">
                  {tour.recommendations.map((r) => (
                    <li key={r}>{r}</li>
                  ))}
                </ul>
              </>
            ) : null}
            {tour.important.length ? (
              <>
                <h3 className="mt-6 text-h4 font-medium">{t("important")}</h3>
                <ul className="mt-3 list-disc space-y-2 pl-5">
                  {tour.important.map((r) => (
                    <li key={r}>{r}</li>
                  ))}
                </ul>
              </>
            ) : null}
          </section>

          <section aria-labelledby="politicas">
            <SectionTitle id="politicas">{t("policiesTitle")}</SectionTitle>
            {tour.policies ? <p className="pwt-prose mt-4">{tour.policies}</p> : null}
            <p lang={locale} className="mt-4 text-foreground-muted">
              {t.rich("policiesText", {
                link: (chunks) => (
                  <Link href="/politicas/condiciones-de-pago" className="pwt-link">
                    {chunks}
                  </Link>
                ),
              })}
            </p>
          </section>

          {tour.faqs.length ? (
            <section aria-labelledby="preguntas">
              <SectionTitle id="preguntas">{t("faqTitle")}</SectionTitle>
              <div className="mt-6">
                <Accordion
                  items={tour.faqs.map((f, i) => ({
                    key: `faq-${i}`,
                    title: f.question,
                    content: <p className="pwt-prose text-foreground-muted">{f.answer}</p>,
                  }))}
                />
              </div>
            </section>
          ) : null}
        </div>

        <aside className="hidden lg:block" aria-label={t("bookingAside")}>
          <div className="sticky top-[88px]">
            <BookingPanel tour={bookable} anchorId="reservar-panel" />
          </div>
        </aside>
      </div>

      {related.length ? (
        <section aria-labelledby="relacionados" className="pwt-section mt-16 bg-surface-muted">
          <div className="pwt-container">
            <h2 id="relacionados" className="mb-8 font-display text-h2 font-medium" data-reveal>
              {t("related")}
            </h2>
            <ul className="grid gap-6 md:grid-cols-2 lg:grid-cols-3" data-reveal-stagger>
              {related.map((r) => (
                <li key={r.key}>
                  <TourCard tour={r} />
                </li>
              ))}
            </ul>
          </div>
        </section>
      ) : null}

      <MobileBookingBar pricing={tour.pricing} />
    </div>
  );
}
