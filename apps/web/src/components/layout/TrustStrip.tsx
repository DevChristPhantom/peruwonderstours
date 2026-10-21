import { BadgeCheck, ExternalLink } from "lucide-react";
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
 * - Logos locales: enlaces informativos, separados de las acreditaciones de la agencia.
 */
const INSTITUTIONS = [
  { id: 'safe-travels', image: 'safe-travels', url: 'https://wttc.org/initiatives/crisis-preparedness-management-recovery/safetravels-stamp-application' },
  { id: 'esnna', image: 'esnna-horizontal', url: 'https://www.gob.pe/15106-ministerio-de-comercio-exterior-y-turismo-prevencion-de-la-explotacion-sexual-de-ninas-ninos-y-adolescentes-en-el-ambito-del-turismo-esnna' },
  { id: 'gercetur', image: 'gercetur', url: 'https://www.gob.pe/regioncusco-gercetur' },
  { id: 'promperu', image: 'promperu', url: 'https://www.gob.pe/promperu' },
  { id: 'marca-peru', image: 'marca-peru', url: 'https://peru.info/es-pe/' },
  { id: 'sernanp', image: 'sernanp', url: 'https://www.gob.pe/sernanp' },
] as const;

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
      <OfficialResources resources={INSTITUTIONS.map((item) => ({ ...item, image: `/official/${item.image}.svg`, label: t(`institutions.${item.id}`), logo: true }))} title={t("officialLinks")} description={t("logoDescription")} externalHint={t("externalHint")} pauseLabel={t("pause")} playLabel={t("play")} />
      <ul className="pwt-container flex flex-wrap gap-x-6 gap-y-1 py-5">
        {links.map((link) => <li key={link.id}>
          <a href={link.url} target="_blank" rel="noopener noreferrer" className="pwt-link inline-flex min-h-11 items-center gap-2 text-sm">
            {t(`links.${link.id}`)}<ExternalLink aria-hidden size={14} className="shrink-0" />
            <span className="sr-only">{t('externalHint')}</span>
          </a>
        </li>)}
      </ul>
    </section>
  );
}
