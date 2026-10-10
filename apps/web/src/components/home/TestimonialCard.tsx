import { Star } from "lucide-react";
import { getTranslations } from "next-intl/server";

import type { Locale } from "@/i18n/routing";
import type { PublicTestimonial } from "@/lib/content/testimonials";
import { formatDate } from "@/lib/format";

/** Tarjeta de testimonio real: calificación en texto (no solo estrellas) y fuente visible. */
export async function TestimonialCard({ testimonial: t, locale }: { testimonial: PublicTestimonial; locale: Locale }) {
  const tr = await getTranslations("testimonials");
  return (
    <figure className="flex h-full flex-col rounded-lg border border-border bg-surface p-6 shadow-xs">
      {t.rating ? (
        <p className="flex items-center gap-1 text-accent">
          {Array.from({ length: 5 }, (_, i) => (
            <Star key={i} aria-hidden size={16} strokeWidth={1.5} fill={i < t.rating! ? "currentColor" : "none"} />
          ))}
          <span className="sr-only">{tr("rating", { rating: t.rating })}</span>
        </p>
      ) : null}
      {t.title ? (
        <p lang={t.lang} className="mt-3 font-medium">
          {t.title}
        </p>
      ) : null}
      <blockquote lang={t.lang} className="mt-2 flex-1 text-foreground-muted">
        <p>{t.body}</p>
      </blockquote>
      <figcaption className="mt-4 text-sm">
        <span className="font-medium text-foreground">{t.author}</span>
        {t.country ? <span className="text-foreground-muted"> · {t.country}</span> : null}
        {t.tourTitle ? <span className="block text-foreground-muted">{t.tourTitle}</span> : null}
        {t.date ? <span className="block text-foreground-muted">{formatDate(t.date, locale)}</span> : null}
        {t.source === "tripadvisor" ? (
          <span className="mt-1 block text-foreground-muted">
            {t.sourceUrl ? (
              <a href={t.sourceUrl} target="_blank" rel="noopener noreferrer" className="pwt-link">
                {tr("viaTripadvisor")}
              </a>
            ) : (
              tr("viaTripadvisor")
            )}
          </span>
        ) : null}
      </figcaption>
    </figure>
  );
}
