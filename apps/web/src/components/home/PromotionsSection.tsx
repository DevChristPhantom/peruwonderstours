import { ArrowRight, CalendarDays, MessageCircle } from "lucide-react";
import Image from "next/image";
import { getTranslations } from "next-intl/server";

import { buttonClass } from "@/components/ui/button-styles";
import { SectionHeading } from "@/components/ui/SectionHeading";
import Link from "@/components/ui/IntentLink";
import { localePath } from "@/i18n/paths";
import { INTL_LOCALE, type Locale } from "@/i18n/routing";
import type { Promotion } from "@/lib/content/promotions";

/** «2 – 11 de febrero de 2027» (días calendario, sin desfase de zona horaria). */
export function eventDateRange(locale: Locale, startsOn: string | null, endsOn: string | null): string | null {
  if (!startsOn) return null;
  const fmt = new Intl.DateTimeFormat(INTL_LOCALE[locale], { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
  const start = new Date(`${startsOn}T00:00:00Z`);
  if (!endsOn || endsOn === startsOn) return fmt.format(start);
  return fmt.formatRange(start, new Date(`${endsOn}T00:00:00Z`));
}

function CtaLink({ promotion, label, variant }: { promotion: Promotion; label: string; variant: "primary" | "secondary" }) {
  const Icon = promotion.cta.kind === "whatsapp" ? MessageCircle : ArrowRight;
  const className = buttonClass(variant, "md", "pwt-card-link gap-2");
  return promotion.cta.external ? (
    <a href={promotion.cta.href} target="_blank" rel="noopener noreferrer" className={className}>
      {label}
      <Icon aria-hidden size={18} strokeWidth={1.5} />
    </a>
  ) : (
    <Link href={promotion.cta.href} className={className}>
      {label}
      <Icon aria-hidden size={18} strokeWidth={1.5} />
    </Link>
  );
}

/**
 * «Lo más relevante» (Panel → Eventos y promociones): eventos y campañas vigentes, p. ej. la
 * Festividad de la Candelaria. El primero va destacado; sin eventos vigentes no se renderiza.
 */
export async function PromotionsSection({ promotions, locale }: { promotions: Promotion[]; locale: Locale }) {
  if (promotions.length === 0) return null;
  const t = await getTranslations("home.highlights");
  const [first, ...rest] = promotions;

  const card = (p: Promotion, featured: boolean) => {
    const dates = eventDateRange(locale, p.eventStartsOn, p.eventEndsOn);
    const label = p.cta.label || t(`cta.${p.cta.kind}`);
    return (
      <article
        lang={p.fallback ? "es-PE" : undefined}
        className={`group relative flex h-full overflow-hidden rounded-2xl border border-border bg-surface shadow-sm has-[a:focus-visible]:outline-2 has-[a:focus-visible]:outline-offset-2 has-[a:focus-visible]:outline-ring ${
          featured ? "flex-col md:flex-row" : "flex-col"
        }`}
      >
        <div className={`relative shrink-0 overflow-hidden bg-[#133464] ${featured ? "aspect-[16/10] md:aspect-auto md:min-h-[340px] md:w-[55%]" : "aspect-[16/10]"}`}>
          {p.image ? (
            <Image
              src={p.image.src}
              alt={p.image.alt || t("imageAlt", { title: p.title })}
              fill
              sizes={featured ? "(min-width: 768px) 55vw, 100vw" : "(min-width: 1024px) 30vw, (min-width: 640px) 45vw, 100vw"}
              className="object-cover transition-transform duration-(--pwt-duration-slow) ease-out [@media(hover:hover)_and_(pointer:fine)_and_(prefers-reduced-motion:no-preference)]:group-hover:scale-[1.04] motion-reduce:transition-none"
            />
          ) : (
            // Sin foto: fondo de marca con la silueta de la montaña del logo (decorativo).
            <div aria-hidden className="absolute inset-0 bg-[radial-gradient(120%_90%_at_20%_10%,#2c5aa0_0%,#133464_55%,#0b1f3d_100%)]">
              <svg viewBox="0 0 400 160" preserveAspectRatio="none" className="absolute inset-x-0 bottom-0 h-1/2 w-full text-[#e8a33d]/70">
                <path d="M0 160 L95 70 L140 105 L210 30 L285 110 L330 80 L400 130 L400 160 Z" fill="currentColor" opacity=".35" />
                <path d="M0 160 L120 95 L175 125 L245 60 L320 130 L400 110 L400 160 Z" fill="currentColor" opacity=".55" />
              </svg>
            </div>
          )}
        </div>
        <div className={`flex flex-1 flex-col gap-3 ${featured ? "p-6 md:p-10" : "p-5 md:p-6"}`}>
          {p.eyebrow ? <p className="text-label font-medium tracking-[0.08em] text-primary uppercase">{p.eyebrow}</p> : null}
          <h3 className={`font-display font-medium ${featured ? "text-h2" : "text-h4"}`}>{p.title}</h3>
          {dates ? (
            <p className="flex items-center gap-2 text-sm font-medium text-foreground">
              <CalendarDays aria-hidden size={18} strokeWidth={1.5} className="text-primary" />
              <span className="sr-only">{t("eventDate")}: </span>
              {dates}
            </p>
          ) : null}
          <p className="pwt-prose text-foreground-muted">{p.summary}</p>
          <div className="mt-auto flex flex-wrap items-center gap-x-4 gap-y-2 pt-2">
            <CtaLink promotion={p} label={label} variant={featured ? "primary" : "secondary"} />
            {p.cta.kind === "whatsapp" ? <span className="text-xs text-foreground-muted">{t("whatsappNote")}</span> : null}
          </div>
        </div>
      </article>
    );
  };

  return (
    <section className="pwt-section" aria-labelledby="destacados-title">
      <div className="pwt-container">
        <SectionHeading id="destacados-title" title={t("title")} description={t("description")} />
        <div className="grid gap-6" data-reveal-stagger>
          {card(first, true)}
          {rest.length ? (
            <ul className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {rest.map((p) => (
                <li key={p.id}>{card(p, false)}</li>
              ))}
            </ul>
          ) : null}
        </div>
        <p className="mt-4 text-sm text-foreground-muted">
          <Link href={localePath(locale, "/politicas/promociones")} className="pwt-link">
            {t("conditions")}
          </Link>
        </p>
      </div>
    </section>
  );
}
