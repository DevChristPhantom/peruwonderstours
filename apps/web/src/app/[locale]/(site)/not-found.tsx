import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";

import { BrokenLinkReport, NotFoundSearch } from "@/components/errors/NotFoundSearch";
import { TourCard } from "@/components/tours/TourCard";
import { buttonClass } from "@/components/ui/button-styles";
import { Link } from "@/i18n/navigation";
import { localePath } from "@/i18n/paths";
import type { Locale } from "@/i18n/routing";
import { getFeaturedTours, type TourSummary } from "@/lib/catalog";

// Next ya añade un noindex propio a los 404, pero sin esto también saldría el "index, follow" del layout.
export const metadata: Metadata = { robots: { index: false } };

/**
 * 404 útil y neutro (HU-0.2, L10): no asume que se buscaba un tour, pero ofrece buscarlo (prellenado
 * con la URL rota), los tours más reservados y un aviso por WhatsApp para corregir el enlace.
 */
export default async function NotFound() {
  const locale = (await getLocale()) as Locale;
  const t = await getTranslations("notFound");
  // El 404 nunca debe fallar: sin catálogo se muestra igual, solo sin sugerencias.
  const popular: TourSummary[] = await getFeaturedTours(locale, 3).catch(() => []);
  return (
    <>
      <section>
        <div className="pwt-container-narrow pt-20 pb-16 text-center">
          <title>{t("title")}</title>
          <p className="text-label font-medium tracking-[0.08em] text-foreground-muted uppercase">{t("eyebrow")}</p>
          <h1 className="mt-2 font-display text-h1 font-medium">{t("title")}</h1>
          <p className="mx-auto mt-3 max-w-prose text-foreground-muted">{t("body")}</p>
          <NotFoundSearch action={localePath(locale, "/tours")} />
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <Link href="/" className={buttonClass("secondary", "md")}>
              {t("home")}
            </Link>
            <Link href="/tours" className={buttonClass("outline", "md")}>
              {t("tours")}
            </Link>
            <Link href="/contactenos" className={buttonClass("ghost", "md")}>
              {t("contact")}
            </Link>
          </div>
          <BrokenLinkReport />
        </div>
      </section>

      {popular.length ? (
        <section aria-labelledby="populares-404" className="pwt-section bg-surface-muted">
          <div className="pwt-container">
            <h2 id="populares-404" className="mb-8 font-display text-h2 font-medium">
              {t("popular")}
            </h2>
            <ul className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {popular.map((tour) => (
                <li key={tour.key}>
                  <TourCard tour={tour} />
                </li>
              ))}
            </ul>
          </div>
        </section>
      ) : null}
    </>
  );
}
