import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { LegalDocumentPage } from "@/components/layout/LegalDocumentPage";
import { localePath } from "@/i18n/paths";
import type { Locale } from "@/i18n/routing";
import { alternatesFor, pageMetadata } from "@/lib/seo/metadata";

const HREF = "/politicas/proteccion-de-datos-personales" as const;

export async function generateMetadata({ params }: PageProps<"/[locale]/politicas/proteccion-de-datos-personales">): Promise<Metadata> {
  const locale = (await params).locale as Locale;
  const t = await getTranslations({ locale, namespace: "legal.pages.privacy" });
  return pageMetadata({ locale, title: t("title"), description: t("description"), paths: alternatesFor(HREF) });
}

/** Texto de docs/legal (borrador de compliance-peru-analyst) con aviso visible de BORRADOR. */
export default async function PrivacyPage({ params }: PageProps<"/[locale]/politicas/proteccion-de-datos-personales">) {
  const locale = (await params).locale as Locale;
  setRequestLocale(locale);
  const [t, tc] = await Promise.all([getTranslations("legal.pages.privacy"), getTranslations("common")]);
  return (
    <LegalDocumentPage
      doc="privacidad"
      locale={locale}
      crumbs={[
        { name: tc("home"), path: localePath(locale, "/") },
        { name: t("title"), path: localePath(locale, HREF) },
      ]}
    />
  );
}
