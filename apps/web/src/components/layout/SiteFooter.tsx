import { BookOpenText, Clock, CreditCard, ExternalLink, MessageCircle } from "lucide-react";
import Image from "next/image";
import { getLocale, getTranslations } from "next-intl/server";
import type { ComponentProps } from "react";

import { Link } from "@/i18n/navigation";
import { SITE, whatsappHref } from "@/lib/site";
import { SOCIAL_LINKS } from "@/lib/social";

import { AndesSkyline } from "./AndesSkyline";
import { BrandLogo } from "./BrandLogo";

type Href = ComponentProps<typeof Link>["href"];
type LinkKey = "allTours" | "tourTypes" | "about" | "blog" | "reviews" | "contact" | "myBookings" | "myBooking" | "complaintStatus" | "favorites" | "terms" | "payments" | "privacy" | "cookies" | "promotions" | "reviewsPolicy" | "esnna";

/** Slug por idioma (data/seed/en/_slug-map.json) para enlazar sin el salto 308 entre idiomas. */
const DESTINATIONS = [
  { es: "tours-en-puno", en: "puno", key: "puno" },
  { es: "cuzco", en: "cusco", key: "cusco" },
  { es: "tours-en-arequipa", en: "arequipa", key: "arequipa" },
  { es: "tours-en-ica-paracas", en: "ica-paracas", key: "ica" },
  { es: "tours-en-lima", en: "lima", key: "lima" },
] as const;

const COMPANY: [Href, LinkKey][] = [["/nosotros", "about"], ["/blog", "blog"], ["/testimonios", "reviews"], ["/contactenos", "contact"]];
const HELP: [Href, LinkKey][] = [["/mis-reservas", "myBookings"], ["/reserva/acceso", "myBooking"], ["/libro-de-reclamaciones/consulta", "complaintStatus"], ["/favoritos", "favorites"]];
const LEGAL: [Href, LinkKey][] = [
  ["/politicas/terminos-y-condiciones", "terms"],
  ["/politicas/condiciones-de-pago", "payments"],
  ["/politicas/proteccion-de-datos-personales", "privacy"],
  ["/politicas/cookies", "cookies"],
  ["/politicas/promociones", "promotions"],
  ["/politicas/resenas", "reviewsPolicy"],
  ["/politicas/esnna", "esnna"],
];

const linkClass = "inline-flex min-h-11 items-center hover:text-white md:min-h-9";
const headingClass = "mb-3 text-xs font-medium tracking-[0.08em] text-hero-muted uppercase";

function Column({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  return (
    <nav aria-labelledby={id}>
      <h3 id={id} className={headingClass}>
        {title}
      </h3>
      <ul className="space-y-1 text-sm">{children}</ul>
    </nav>
  );
}

function LegalItem({ label, value, pending }: { label: string; value: string | null; pending: string }) {
  return (
    <li>
      <span className="text-hero-muted">{label}: </span>
      {value ?? <span className="italic">{pending}</span>}
    </li>
  );
}

/**
 * Pie del sitio (home.md §11) con la paleta del logo (titicaca/terracota vía variables CSS).
 * - Columnas: tours, empresa, ayuda y legal. El Libro de Reclamaciones siempre visible (Ley 32495).
 * - Redes: solo Facebook y TripAdvisor (lib/social.ts, URL codificada). Medios de pago en texto neutro.
 * - Datos legales no confirmados → "por confirmar"; nunca se publican nombres ni correos del equipo.
 */
export async function SiteFooter({ variant = "full" }: { variant?: "full" | "minimal" }) {
  const [t, tc, locale] = await Promise.all([getTranslations("footer"), getTranslations("common"), getLocale()]);
  const { legal } = SITE;
  const pending = tc("pending");
  const rucDisplay = legal.ruc ?? pending;
  const year = new Date().getFullYear();

  if (variant === "minimal") {
    return (
      <footer className="border-t border-border bg-surface-muted">
        <div className="pwt-container flex flex-col gap-3 py-6 text-sm text-foreground-muted md:flex-row md:items-center md:justify-between">
          <p>
            {legal.businessName ?? SITE.name} · RUC: {rucDisplay}
          </p>
          <ul className="flex flex-wrap gap-x-5 gap-y-2">
            {LEGAL.slice(0, 3).map(([href, key]) => (
              <li key={key}>
                <Link className="pwt-link inline-flex min-h-11 items-center" href={href}>
                  {t(`links.${key}`)}
                </Link>
              </li>
            ))}
            <li>
              <Link className="pwt-link inline-flex min-h-11 items-center" href="/libro-de-reclamaciones">
                {t("complaintsBook")}
              </Link>
            </li>
          </ul>
        </div>
      </footer>
    );
  }

  const item = ([href, key]: [Href, LinkKey]) => (
    <li key={key}>
      <Link href={href} className={linkClass}>
        {t(`links.${key}`)}
      </Link>
    </li>
  );

  return (
    <footer aria-labelledby="footer-title" className="pwt-defer mt-16 text-[color:var(--pwt-hero-soft)]">
      <h2 id="footer-title" className="sr-only">
        {t("title")}
      </h2>
      <AndesSkyline className="block h-[clamp(100px,15.75vw,252px)] w-full object-cover object-bottom" />
      <div className="bg-[#133464]">
        <div className="pwt-container grid gap-10 py-12 md:grid-cols-2 lg:grid-cols-[1.4fr_1fr_1fr_1fr_1fr]">
          <div>
            <Link href="/" className="inline-flex min-h-11 items-center" aria-label={tc("logoHome")}>
              <BrandLogo alt={tc("logoAlt")} wide />
            </Link>
            <p className="mt-3 text-sm">{t("tagline")}</p>
            <ul className="mt-4 space-y-1 text-sm">
              <LegalItem label={t("legal.businessName")} value={legal.businessName} pending={pending} />
              <LegalItem label={t("legal.ruc")} value={rucDisplay} pending={pending} />
              <LegalItem label={t("legal.fiscalAddress")} value={legal.fiscalAddress} pending={pending} />
              <LegalItem label={t("legal.mincetur")} value={legal.minceturRegistry} pending={pending} />
              <LegalItem label={t("legal.office")} value={legal.address} pending={pending} />
            </ul>
            <p className="mt-4 flex items-start gap-2 text-sm">
              <Clock aria-hidden size={18} strokeWidth={1.5} className="mt-0.5 shrink-0" />
              {t("hours")}
            </p>
            <a href={whatsappHref()} target="_blank" rel="noopener noreferrer" className={`${linkClass} gap-2 text-sm`}>
              <MessageCircle aria-hidden size={18} strokeWidth={1.5} />
              {t("whatsapp", { number: SITE.whatsapp.display })}
            </a>
          </div>

          <Column id="footer-tours" title={t("columns.tours")}>
            {DESTINATIONS.map(({ key, ...slugs }) => (
              <li key={key}>
                <Link href={{ pathname: "/destinos/[slug]", params: { slug: slugs[locale === "pt" ? "es" : locale] } }} className={linkClass}>
                  {t(`destinations.${key}`)}
                </Link>
              </li>
            ))}
            {item(["/tours", "allTours"])}
            {item(["/tipos-de-tours", "tourTypes"])}
          </Column>

          <Column id="footer-empresa" title={t("columns.company")}>
            {COMPANY.map(item)}
          </Column>

          <Column id="footer-ayuda" title={t("columns.help")}>
            {HELP.map(item)}
            <li>
              <Link href="/libro-de-reclamaciones" className={`${linkClass} gap-2 font-medium text-white`}>
                <BookOpenText aria-hidden size={18} strokeWidth={1.5} />
                {t("complaintsBook")}
              </Link>
            </li>
          </Column>

          <Column id="footer-legal" title={t("columns.legal")}>
            {LEGAL.map(item)}
          </Column>
        </div>

        <div className={`pwt-container grid gap-8 border-t border-[color:var(--pwt-hero-line)] py-8 text-sm ${SOCIAL_LINKS.length ? "md:grid-cols-3" : "md:grid-cols-2"}`}>
          {SOCIAL_LINKS.length ? <div>
            <h3 className={headingClass}>{t("follow")}</h3>
            <ul className="flex flex-wrap gap-x-5">
              {SOCIAL_LINKS.map((s) => (
                <li key={s.network}>
                  <a href={s.url} target="_blank" rel="noopener noreferrer" className={`${linkClass} gap-1`}>
                    {s.network === "facebook" ? "Facebook" : "TripAdvisor"}
                    <ExternalLink aria-hidden size={14} strokeWidth={1.5} />
                    <span className="sr-only">{t(`social.${s.network}`, { name: SITE.name })}</span>
                  </a>
                </li>
              ))}
            </ul>
          </div> : null}
          <div>
            <h3 className={headingClass}>{t("payments")}</h3>
            <p className="flex items-start gap-2">
              <CreditCard aria-hidden size={18} strokeWidth={1.5} className="mt-0.5 shrink-0" />
              {t("paymentsText")}
            </p>
          </div>
          <div>
            <Link
              href="/libro-de-reclamaciones"
              className="flex min-h-11 w-full flex-wrap items-center gap-3 rounded-lg border border-[color:var(--pwt-hero-line)] bg-white/5 px-4 py-4 text-white hover:bg-hero-hover"
            >
              <Image src="/official/complaints-book.webp" alt="" width={686} height={386} className="h-auto w-[120px] shrink-0 rounded-sm" />
              <span>
                <span className="block font-medium">{t("complaintsBook")}</span>
                <span className="block text-xs text-hero-muted">{t("complaintsBookHint")}</span>
              </span>
            </Link>
          </div>
        </div>

        <div className="border-t border-[color:var(--pwt-hero-line)]">
          <div className="pwt-container flex flex-col gap-2 py-6 text-sm text-hero-muted md:flex-row md:justify-between">
            <p>{t("copyright", { year, name: SITE.name })}</p>
            <p className="max-w-2xl">{t("esnna", { name: SITE.name })}</p>
          </div>
        </div>
      </div>
    </footer>
  );
}
