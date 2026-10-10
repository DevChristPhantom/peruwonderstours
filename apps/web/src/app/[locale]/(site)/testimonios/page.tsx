import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { TestimonialCard } from "@/components/home/TestimonialCard";
import { Breadcrumbs } from "@/components/layout/Breadcrumbs";
import { buttonClass } from "@/components/ui/button-styles";
import { Link } from "@/i18n/navigation";
import { localePath } from "@/i18n/paths";
import type { Locale } from "@/i18n/routing";
import { getTestimonials } from "@/lib/content/testimonials";
import { alternatesFor, pageMetadata } from "@/lib/seo/metadata";

export const revalidate = 3600;

export async function generateMetadata({ params }: PageProps<"/[locale]/testimonios">): Promise<Metadata> {
  const locale = (await params).locale as Locale;
  const t = await getTranslations({ locale, namespace: "reviews" });
  return pageMetadata({ locale, title: t("title"), description: t("description"), paths: alternatesFor("/testimonios") });
}

/** Testimonios (F2): solo reales (aprobados con consentimiento y reseñas de TripAdvisor atribuidas). */
export default async function TestimonialsPage({ params }: PageProps<"/[locale]/testimonios">) {
  const locale = (await params).locale as Locale;
  setRequestLocale(locale);
  const [testimonials, t, tc] = await Promise.all([getTestimonials(locale), getTranslations("reviews"), getTranslations("common")]);

  return (
    <div className="pwt-container pt-8 pb-20">
      <Breadcrumbs
        items={[
          { name: tc("home"), path: localePath(locale, "/") },
          { name: t("title"), path: localePath(locale, "/testimonios") },
        ]}
      />
      <div className="mt-4 flex flex-wrap items-end justify-between gap-4">
        <h1 className="font-display text-h1 font-medium">{t("title")}</h1>
        <Link href="/dejar-testimonio" className={buttonClass("secondary", "md")}>
          {t("leaveCta")}
        </Link>
      </div>
      <p className="mt-3 max-w-2xl text-foreground-muted">{t("description")}</p>
      {testimonials.length ? (
        <ul className="mt-10 grid gap-6 md:grid-cols-2 lg:grid-cols-3" data-reveal-stagger>
          {testimonials.map((item) => (
            <li key={item.id}>
              <TestimonialCard testimonial={item} locale={locale} />
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-10 rounded-lg border border-dashed border-border-strong p-6 text-foreground-muted">{t("empty")}</p>
      )}
    </div>
  );
}
