import { AlertTriangle, CalendarDays, Check, Gauge, MapPin, Users, X } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { CompareToggle } from "@/components/compare/CompareToggle";
import { Breadcrumbs } from "@/components/layout/Breadcrumbs";
import { BookingPanel, MobileBookingBar, type BookableTour } from "@/components/tours/BookingPanel";
import { TourCard } from "@/components/tours/TourCard";
import { TourGallery } from "@/components/tours/TourGallery";
import { Accordion } from "@/components/ui/Accordion";
import { FavoriteButton } from "@/components/wishlist/FavoriteButton";
import { getAllTours, getDestinations, getRelatedTours, getTour } from "@/lib/catalog";
import { formatDuration } from "@/lib/catalog/rules";
import { faqJsonLd, JsonLd, touristTripJsonLd } from "@/lib/seo/json-ld";
import { pageMetadata } from "@/lib/seo/metadata";

// Slugs nuevos publicados en la API se generan bajo demanda (ISR); los desconocidos dan 404.
export const dynamicParams = true;
export const revalidate = 3600;

export async function generateStaticParams() {
  const tours = await getAllTours();
  return tours.map((t) => ({ slug: t.slug }));
}

export async function generateMetadata({ params }: PageProps<"/es/tours/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const tour = await getTour(slug);
  if (!tour) return {};
  return pageMetadata({
    title: tour.metaTitle,
    description: tour.metaDescription,
    path: tour.path,
    image: tour.image?.src,
  });
}

const ALTITUDE_NOTES: Record<string, string> = {
  "tours-en-puno": "Puno está a 3 812 m s. n. m. Te recomendamos llegar un día antes para aclimatarte.",
  cuzco: "Cusco está a unos 3 400 m s. n. m. Descansa el primer día y evita esfuerzos fuertes al llegar.",
};

function SectionTitle({ id, children }: { id: string; children: React.ReactNode }) {
  return (
    <h2 id={id} className="scroll-mt-32 font-display text-h2 font-medium" data-reveal>
      {children}
    </h2>
  );
}

export default async function TourPage({ params }: PageProps<"/es/tours/[slug]">) {
  const { slug } = await params;
  const tour = await getTour(slug);
  if (!tour) notFound();

  const [related, destinations] = await Promise.all([getRelatedTours(tour, 3), getDestinations()]);
  const primaryDestination = destinations.find((d) => tour.destinationSlugs.includes(d.slug));
  const places = tour.destinationNames.length ? tour.destinationNames.join(", ") : "Varios destinos";
  const multiDay = (tour.durationDays ?? 1) > 1 && tour.itinerary.length > 1;
  const altitudeNotes = tour.destinationSlugs.map((d) => ALTITUDE_NOTES[d]).filter(Boolean);
  const summaryLines = tour.summaryText?.split("\n").map((l) => l.trim()).filter(Boolean) ?? [];

  const bookable: BookableTour = {
    slug: tour.slug,
    title: tour.shortTitle,
    path: tour.path,
    image: tour.image,
    destinationLabel: places,
    durationLabel: formatDuration(tour.durationDays, tour.durationNights),
    minPax: tour.minPax,
    pricing: tour.pricing,
    paymentPolicy: tour.paymentPolicy,
    durationDays: tour.durationDays,
    destinationSlugs: tour.destinationSlugs,
    difficulty: tour.difficulty,
  };

  const sections = [
    { id: "resumen", label: "Resumen" },
    { id: "itinerario", label: "Itinerario", show: tour.itinerary.length > 0 },
    { id: "incluye", label: "Incluye", show: tour.includes.length + tour.notIncludes.length > 0 },
    { id: "antes-de-viajar", label: "Antes de viajar" },
    { id: "politicas", label: "Políticas" },
    { id: "preguntas", label: "Preguntas", show: tour.faqs.length > 0 },
  ].filter((s) => s.show !== false);

  const faq = faqJsonLd(tour.faqs);

  return (
    <div className="pb-28 lg:pb-0">
      <JsonLd data={faq ? [touristTripJsonLd(tour), faq] : touristTripJsonLd(tour)} />

      <div className="pwt-container pt-6">
        <Breadcrumbs
          items={[
            { name: "Inicio", path: "/es" },
            ...(primaryDestination
              ? [
                  { name: "Destinos", path: "/es/destinos" },
                  { name: primaryDestination.name, path: primaryDestination.path },
                ]
              : [{ name: "Tours", path: "/es/tours" }]),
            { name: tour.shortTitle, path: tour.path },
          ]}
        />
        <div className="mt-4">
          <TourGallery images={tour.gallery} title={tour.shortTitle} />
        </div>

        <header className="mt-8 max-w-4xl">
          <h1 className="font-display text-display-xl font-normal">{tour.title}</h1>
          <ul className="mt-5 flex flex-wrap gap-x-6 gap-y-2 text-foreground-muted">
            <li className="inline-flex items-center gap-2">
              <CalendarDays aria-hidden size={20} strokeWidth={1.5} />
              {formatDuration(tour.durationDays, tour.durationNights)}
            </li>
            <li className="inline-flex items-center gap-2">
              <MapPin aria-hidden size={20} strokeWidth={1.5} />
              {places}
            </li>
            <li className="inline-flex items-center gap-2">
              <Users aria-hidden size={20} strokeWidth={1.5} />
              Mínimo {tour.minPax} viajeros
            </li>
            {tour.difficulty ? (
              <li className="inline-flex items-center gap-2">
                <Gauge aria-hidden size={20} strokeWidth={1.5} />
                Dificultad: {tour.difficulty}
              </li>
            ) : null}
          </ul>
          {tour.paymentPolicy.depositPercent < 100 ? (
            <p className="mt-4 inline-block rounded-pill bg-success-soft px-3 py-1 text-sm text-success">
              Reserva con el {tour.paymentPolicy.depositPercent} %
            </p>
          ) : (
            <p className="mt-4 inline-block rounded-pill bg-warning-soft px-3 py-1 text-sm text-warning">
              Pago completo al reservar: {tour.paymentPolicy.fullPaymentReason?.toLowerCase()}
            </p>
          )}
          <div className="mt-5 flex flex-wrap gap-2">
            <FavoriteButton slug={tour.slug} title={tour.shortTitle} destinationSlugs={tour.destinationSlugs} variant="inline" />
            <CompareToggle slug={tour.slug} title={tour.shortTitle} />
          </div>
        </header>
      </div>

      {/* Índice de secciones (sticky ≥ 768) */}
      <nav
        aria-label="Secciones del tour"
        className="sticky top-16 z-[5] mt-8 hidden border-y border-border bg-background/95 backdrop-blur md:block"
      >
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
        <div className="min-w-0 space-y-16">
          <section aria-labelledby="resumen">
            <SectionTitle id="resumen">Resumen</SectionTitle>
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
          <div className="lg:hidden">
            <BookingPanel tour={bookable} />
          </div>

          {tour.itinerary.length ? (
            <section aria-labelledby="itinerario">
              <SectionTitle id="itinerario">Itinerario</SectionTitle>
              <div className="mt-6">
                {multiDay ? (
                  <Accordion
                    defaultOpen={["dia-1"]}
                    items={tour.itinerary.map((step, i) => ({
                      key: `dia-${i + 1}`,
                      title: (
                        <>
                          <span className="text-primary">Día {step.day}</span>
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
                <SectionTitle id="incluye">Incluye</SectionTitle>
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
                  No incluye
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
            <SectionTitle id="antes-de-viajar">Antes de viajar</SectionTitle>
            {altitudeNotes.map((note) => (
              <p key={note} className="mt-4 flex gap-3 rounded-md bg-warning-soft p-4 text-warning">
                <AlertTriangle aria-hidden size={20} strokeWidth={1.5} className="mt-0.5 shrink-0" />
                {note}
              </p>
            ))}
            {tour.recommendations.length ? (
              <>
                <h3 className="mt-6 text-h4 font-medium">Recomendaciones</h3>
                <ul className="mt-3 list-disc space-y-2 pl-5">
                  {tour.recommendations.map((r) => (
                    <li key={r}>{r}</li>
                  ))}
                </ul>
              </>
            ) : null}
            {tour.important.length ? (
              <>
                <h3 className="mt-6 text-h4 font-medium">Importante</h3>
                <ul className="mt-3 list-disc space-y-2 pl-5">
                  {tour.important.map((r) => (
                    <li key={r}>{r}</li>
                  ))}
                </ul>
              </>
            ) : null}
          </section>

          <section aria-labelledby="politicas">
            <SectionTitle id="politicas">Políticas de pago y cancelación</SectionTitle>
            {tour.policies ? <p className="pwt-prose mt-4">{tour.policies}</p> : null}
            <p className="mt-4 text-foreground-muted">
              Reservas con el 50 % del total; el saldo se paga al menos 7 días antes del servicio. Las cancelaciones se
              rigen por las{" "}
              <Link href="/es/politicas/condiciones-de-pago" className="pwt-link">
                condiciones de pago
              </Link>
              . {/* TODO(cliente): política de cancelación completa y tabla de penalidades (RN-04, RN-05, RN-07). */}
              La política de cancelación detallada se mostrará antes de pagar.
            </p>
          </section>

          {tour.faqs.length ? (
            <section aria-labelledby="preguntas">
              <SectionTitle id="preguntas">Preguntas frecuentes</SectionTitle>
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

        <aside className="hidden lg:block" aria-label="Reserva">
          <div className="sticky top-[88px]">
            <BookingPanel tour={bookable} anchorId="reservar-panel" />
          </div>
        </aside>
      </div>

      {related.length ? (
        <section aria-labelledby="relacionados" className="pwt-section mt-16 bg-surface-muted">
          <div className="pwt-container">
            <h2 id="relacionados" className="mb-8 font-display text-h2 font-medium" data-reveal>
              Tours relacionados
            </h2>
            <ul className="grid gap-6 md:grid-cols-2 lg:grid-cols-3" data-reveal-stagger>
              {related.map((t) => (
                <li key={t.slug}>
                  <TourCard tour={t} />
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
