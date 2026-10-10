import { BadgeCheck, ExternalLink } from "lucide-react";
import { getTranslations } from "next-intl/server";

import { ComplaintsBookNotice } from "@/components/complaints/ComplaintsBookNotice";
import type { Locale } from "@/i18n/routing";
import { enabledBadges, officialLinks } from "@/lib/trust";

/**
 * Franja de confianza (data/seed/trust-badges.json, reglas en lib/trust.ts):
 * - Siempre: el aviso del Libro de Reclamaciones (obligatorio en la home).
 * - Sellos con logo: solo los encendidos en `BADGE_SWITCHES` (hoy todos `enabled: false`); al
 *   encenderlos se muestra un distintivo neutro con su nombre, nunca una imagen enlazada de un sitio del Estado.
 * - "Enlaces oficiales": enlaces de TEXTO a las URLs oficiales verificadas.
 */
export async function TrustStrip({ locale }: { locale: Locale }) {
  const t = await getTranslations("trust");
  const badges = enabledBadges(locale);
  const links = officialLinks().map((link) => ({
    ...link,
    // peru.travel tiene versión en inglés.
    url: link.id === "peru-travel" && locale === "en" ? link.url.replace(/\/es\/?$/, "/en") : link.url,
  }));

  return (
    <section aria-label={t("label")} className="mt-8">
      <ComplaintsBookNotice />
      <div className="pwt-container mt-4">
        {badges.length ? (
          <div className="mb-3">
            <h2 className="sr-only">{t("badges")}</h2>
            <ul className="flex flex-wrap gap-2">
              {badges.map((badge) => (
                <li key={badge.id}>
                  <a
                    href={badge.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex min-h-11 items-center gap-2 rounded-pill border border-border bg-surface px-4 text-sm hover:bg-surface-muted"
                  >
                    <BadgeCheck aria-hidden size={18} strokeWidth={1.5} className="text-primary" />
                    {badge.alt}
                    <span className="sr-only">{t("externalHint")}</span>
                  </a>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
        <nav aria-labelledby="enlaces-oficiales" className="flex flex-col gap-1 text-sm sm:flex-row sm:flex-wrap sm:items-center sm:gap-x-5">
          <h2 id="enlaces-oficiales" className="text-xs font-medium tracking-[0.08em] text-foreground-muted uppercase">
            {t("officialLinks")}
          </h2>
          <ul className="flex flex-wrap gap-x-5">
            {links.map((link) => (
              <li key={link.id}>
                <a
                  href={link.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="pwt-link inline-flex min-h-11 items-center gap-1"
                >
                  {t(`links.${link.id}`)}
                  <ExternalLink aria-hidden size={14} strokeWidth={1.5} />
                  <span className="sr-only">{t("externalHint")}</span>
                </a>
              </li>
            ))}
          </ul>
        </nav>
      </div>
    </section>
  );
}
