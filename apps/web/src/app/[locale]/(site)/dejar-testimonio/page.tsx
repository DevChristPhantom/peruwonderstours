import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { TestimonialForm } from "@/components/forms/TestimonialForm";
import { Breadcrumbs } from "@/components/layout/Breadcrumbs";
import { localePath } from "@/i18n/paths";
import type { Locale } from "@/i18n/routing";
import { alternatesFor, pageMetadata } from "@/lib/seo/metadata";

export async function generateMetadata({ params }: PageProps<"/[locale]/dejar-testimonio">): Promise<Metadata> {
  const locale = (await params).locale as Locale;
  const t = await getTranslations({ locale, namespace: "reviews.leave" });
  return pageMetadata({ locale, title: t("title"), description: t("description"), paths: alternatesFor("/dejar-testimonio") });
}

/** Dejar testimonio (F2): se publica solo después de moderación y con consentimiento expreso. */
export default async function LeaveTestimonialPage({ params }: PageProps<"/[locale]/dejar-testimonio">) {
  const locale = (await params).locale as Locale;
  setRequestLocale(locale);
  const [t, tr, tc] = await Promise.all([getTranslations("reviews.leave"), getTranslations("reviews"), getTranslations("common")]);

  return (
    <div className="pwt-container-narrow pt-8 pb-20">
      <Breadcrumbs
        items={[
          { name: tc("home"), path: localePath(locale, "/") },
          { name: tr("title"), path: localePath(locale, "/testimonios") },
          { name: t("title"), path: localePath(locale, "/dejar-testimonio") },
        ]}
      />
      <h1 className="mt-4 font-display text-h1 font-medium">{t("title")}</h1>
      <p className="mt-3 mb-8 text-foreground-muted">{t("intro")}</p>
      <TestimonialForm />
    </div>
  );
}
