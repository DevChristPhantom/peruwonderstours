import { getTranslations } from "next-intl/server";

import { getAllTours, getDestinations } from "@/lib/catalog";
import type { TourSummary } from "@/lib/catalog/types";
import { formatMoney } from "@/lib/format";
import { durationText } from "@/lib/i18n/units";
import { absoluteUrl, SITE } from "@/lib/site";

export const revalidate = 3600;

/**
 * `/llms.txt` (propuesta llmstxt.org): resumen en texto plano para asistentes de IA (ChatGPT, Perplexity,
 * Claude, Gemini) que responden preguntas sobre tours en el Perú. Se arma con el catálogo real y los textos
 * del cliente; nada inventado: sin precios si no hay tarifa, sin reseñas ni sellos no confirmados.
 */
export async function GET() {
  const [toursEs, toursEn, destinations, about, aboutEn, footer, units] = await Promise.all([
    getAllTours("es"),
    getAllTours("en"),
    getDestinations("en"),
    getTranslations({ locale: "es", namespace: "about" }),
    getTranslations({ locale: "en", namespace: "about" }),
    getTranslations({ locale: "en", namespace: "footer" }),
    getTranslations({ locale: "en", namespace: "units" }),
  ]);
  const en = new Map(toursEn.map((t) => [t.key, t]));

  const price = (t: TourSummary) => {
    const parts = [
      t.foreignPricing && `from ${formatMoney(t.foreignPricing.adultCents, t.foreignPricing.currency, "en")} (international travelers)`,
      t.pricing && `from ${formatMoney(t.pricing.adultCents, t.pricing.currency, "en")} (Peru residents)`,
    ].filter(Boolean);
    return parts.length ? parts.join(", ") : "price on request";
  };

  const tourLine = (es: TourSummary) => {
    const t = en.get(es.key);
    const english = t && !t.fallback ? t : null;
    const title = english?.title ?? es.title;
    const places = es.destinationNames.join(", ");
    const summary = (english?.excerpt || es.excerpt).replace(/\s+/g, " ").trim().slice(0, 220);
    const links = english ? `[English](${absoluteUrl(english.path)}) · [Español](${absoluteUrl(es.path)})` : `[Español](${absoluteUrl(es.path)})`;
    return `- ${title} — ${durationText(units, es.durationDays, es.durationNights)}${places ? `, ${places}` : ""}; ${price(es)}. ${links}${summary ? `: ${summary}` : ""}`;
  };

  const body = `# ${"Peru Wonders Tours"}

> ${(aboutEn.raw("intro") as string[])[0]} ${aboutEn("slogan")}.

${footer("tagline")}

## About
${(aboutEn.raw("intro") as string[]).slice(1).join(" ")}

- Legal name: ${SITE.legal.businessName ?? "—"} (RUC ${SITE.legal.ruc ?? "—"}), Peru.
- Office: ${SITE.legal.address ?? "—"}, Peru. Hours: ${footer("hours")}.
- Contact: WhatsApp ${SITE.whatsapp.display} (https://wa.me/${SITE.whatsapp.digits}), email ${SITE.legal.email ?? "—"}.
- Languages: Spanish, English, Portuguese.
- Booking: online with a deposit and the balance before the trip; tours with train or Machu Picchu tickets are paid in full. Peru residents pay in soles (S/), international travelers in US dollars.

## Destinations
${destinations.map((d) => `- [${d.name}](${absoluteUrl(d.path)}): ${d.tourCount} tours`).join("\n")}

## Tours
${toursEs.map(tourLine).join("\n")}

## Policies
- [Terms and conditions](${absoluteUrl("/es/politicas/terminos-y-condiciones")})
- [Booking and cancellation policy](${absoluteUrl("/en/booking-and-cancellation-policy")})
- [Privacy](${absoluteUrl("/es/politicas/proteccion-de-datos-personales")})
- [Complaints book (Libro de Reclamaciones)](${absoluteUrl("/es/libro-de-reclamaciones")})

## Optional
- [Sitemap](${absoluteUrl("/sitemap.xml")})
- Spanish version of this summary: ${about("slogan")} — ${(about.raw("intro") as string[])[0]}
`;

  return new Response(body, {
    headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "public, max-age=3600" },
  });
}
