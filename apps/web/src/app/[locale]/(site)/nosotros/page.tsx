import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { PendingContentPage } from "@/components/layout/PendingContentPage";
import { localePath } from "@/i18n/paths";
import type { Locale } from "@/i18n/routing";
import { alternatesFor, pageMetadata } from "@/lib/seo/metadata";
import { SITE } from "@/lib/site";

export async function generateMetadata({ params }: PageProps<"/[locale]/nosotros">): Promise<Metadata> {
  const locale = (await params).locale as Locale;
  const t = await getTranslations({ locale, namespace: "about" });
  return pageMetadata({ locale, title: t("title"), description: t("description", { name: SITE.name }), paths: alternatesFor("/nosotros") });
}

export default async function AboutPage({ params }: PageProps<"/[locale]/nosotros">) {
  const locale = (await params).locale as Locale;
  setRequestLocale(locale);
  const [t, tc] = await Promise.all([getTranslations("about"), getTranslations("common")]);
  return (
    <PendingContentPage
      title={t("title")}
      crumbs={[
        { name: tc("home"), path: localePath(locale, "/") },
        { name: t("title"), path: localePath(locale, "/nosotros") },
      ]}
      notice={t("notice")}
    >
      {/* TODO(contenido): migrar y reescribir "quienes-somos" con la marca nueva. */}
      <p>{t("body", { name: SITE.name })}</p>
    </PendingContentPage>
  );
}
