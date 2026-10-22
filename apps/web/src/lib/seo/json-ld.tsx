import type { Locale } from "@/i18n/routing";
import type { Faq, Tour, TourSummary } from "@/lib/catalog/types";
import { absoluteUrl, SITE } from "@/lib/site";

type JsonLdObject = Record<string, unknown>;

/** Inserta JSON-LD escapando `<` (guía JSON-LD de Next 16: evita inyección de HTML). */
export function JsonLd({ data }: { data: JsonLdObject | JsonLdObject[] }) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data).replace(/</g, "\\u003c") }}
    />
  );
}

export interface Crumb {
  name: string;
  path: string;
}

export function breadcrumbJsonLd(crumbs: Crumb[]): JsonLdObject {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: crumbs.map((c, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: c.name,
      item: absoluteUrl(c.path),
    })),
  };
}

/** Agencia con datos confirmados; nunca incluye registros, RUC o reseñas de ejemplo. */
export function organizationJsonLd(): JsonLdObject {
  return {
    "@context": "https://schema.org",
    "@type": "TravelAgency",
    "@id": absoluteUrl('/#organization'),
    name: SITE.name,
    url: SITE.url,
    logo: absoluteUrl('/brand/peruwonderstours-logo-color.png'),
    ...(SITE.legal.email ? { email: SITE.legal.email } : {}),
    telephone: SITE.whatsapp.display.replace(/[^+\d]/g, ''),
    ...(SITE.legal.address ? { address: { '@type': 'PostalAddress', streetAddress: SITE.legal.address, addressLocality: 'Puno', addressCountry: 'PE' } } : {}),
    areaServed: { "@type": "Country", name: "Peru" },
  };
}

/**
 * TouristTrip (+ Offer solo si hay tarifa real). Sin AggregateRating: no hay reseñas reales aún.
 * `dayLabel` traduce "Día N" para pasos sin título.
 */
export function touristTripJsonLd(tour: Tour, locale: Locale, dayLabel: (day: number) => string): JsonLdObject {
  const url = absoluteUrl(tour.path);
  const data: JsonLdObject = {
    "@context": "https://schema.org",
    "@type": "TouristTrip",
    name: tour.title,
    description: tour.metaDescription || tour.excerpt,
    url,
    inLanguage: tour.fallback ? "es" : locale,
    image: tour.gallery.slice(0, 6).map((g) => g.src),
    touristType: tour.categorySlugs,
    provider: { "@type": "TravelAgency", '@id': absoluteUrl('/#organization'), name: SITE.name, url: SITE.url },
    itinerary: {
      "@type": "ItemList",
      numberOfItems: tour.itinerary.length,
      itemListElement: tour.itinerary.map((step, i) => ({
        "@type": "ListItem",
        position: i + 1,
        name: step.title ?? dayLabel(step.day),
        description: step.description.slice(0, 300),
      })),
    },
  };
  if (tour.pricing) {
    data.offers = {
      "@type": "Offer",
      url,
      priceCurrency: tour.pricing.currency,
      price: (tour.pricing.adultCents / 100).toFixed(2),
      seller: { "@type": "TravelAgency", '@id': absoluteUrl('/#organization'), name: SITE.name },
    };
  }
  return data;
}

export function faqJsonLd(faqs: Faq[]): JsonLdObject | null {
  if (!faqs.length) return null;
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqs.map((f) => ({
      "@type": "Question",
      name: f.question,
      acceptedAnswer: { "@type": "Answer", text: f.answer },
    })),
  };
}

export function itemListJsonLd(name: string, tours: TourSummary[]): JsonLdObject {
  return {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name,
    itemListElement: tours.map((t, i) => ({
      "@type": "ListItem",
      position: i + 1,
      url: absoluteUrl(t.path),
      name: t.title,
    })),
  };
}

export function blogPostingJsonLd(post: { title: string; excerpt: string; path: string; image: string | null; publishedAt: string | null; author: string | null; fallback?: boolean }, locale: Locale): JsonLdObject {
  return {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    headline: post.title,
    description: post.excerpt,
    url: absoluteUrl(post.path),
    inLanguage: post.fallback ? "es" : locale,
    ...(post.image ? { image: [post.image] } : {}),
    ...(post.publishedAt ? { datePublished: post.publishedAt } : {}),
    author: { "@type": post.author ? "Person" : "Organization", name: post.author ?? SITE.name },
    publisher: { "@type": "TravelAgency", '@id': absoluteUrl('/#organization'), name: SITE.name, url: SITE.url },
  };
}
