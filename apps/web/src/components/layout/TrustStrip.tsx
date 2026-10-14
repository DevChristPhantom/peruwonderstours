import { BadgeCheck } from "lucide-react";
import { getTranslations } from "next-intl/server";

import { ComplaintsBookNotice } from "@/components/complaints/ComplaintsBookNotice";
import { OfficialResources } from "./OfficialResources";
import type { Locale } from "@/i18n/routing";
import { enabledBadges, officialLinks } from "@/lib/trust";

/**
 * Franja de confianza (data/seed/trust-badges.json, reglas en lib/trust.ts):
 * - Siempre: el aviso del Libro de Reclamaciones (obligatorio en la home).
 * - Sellos con logo: solo los encendidos en `BADGE_SWITCHES` (hoy todos `enabled: false`); al
 *   encenderlos se muestra un distintivo neutro con su nombre, nunca una imagen enlazada de un sitio del Estado.
 * - Recursos oficiales: tarjetas con fotografías ilustrativas e iconos, sin afirmar acreditaciones.
 */
const RESOURCE_ART = {
  "machu-picchu-tickets": { image: "/hero-motion/machu-picchu-0.webp", photo: true },
  "mincetur-directory": { image: "/icons/rune/receipt.svg" },
  "peru-travel": { image: "/hero-motion/titicaca-0.webp", photo: true },
  "iperu": { image: "/icons/rune/phone.svg" },
  "sernanp-visit": { image: "/icons/rune/map.svg" },
  "esnna-info": { image: "/icons/rune/shield-check.svg" },
} as const;

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
      </div>
      <OfficialResources resources={links.map((link) => ({ ...link, label: t(`links.${link.id}`), ...RESOURCE_ART[link.id] }))} title={t("officialLinks")} description={t("description")} externalHint={t("externalHint")} pauseLabel={t("pause")} playLabel={t("play")} />
    </section>
  );
}
