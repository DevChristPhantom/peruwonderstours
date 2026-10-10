import type { Metadata, Viewport } from "next";
import { notFound } from "next/navigation";
import { hasLocale, NextIntlClientProvider } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { colors } from "@pwt/ui/tokens";

import { AppProviders } from "@/components/providers/AppProviders";
import { INTL_LOCALE, OG_LOCALE, routing } from "@/i18n/routing";
import { SITE } from "@/lib/site";

import { fontVariables } from "../fonts";
import "../globals.css";

/** Layout raíz por idioma (I1): `<html lang>` dinámico, diccionario y proveedores. */
export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export async function generateMetadata({ params }: LayoutProps<"/[locale]">): Promise<Metadata> {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) return {};
  const t = await getTranslations({ locale, namespace: "site" });
  return {
    metadataBase: new URL(SITE.url),
    title: { default: `${SITE.name} · ${t("tagline")}`, template: `%s · ${SITE.name}` },
    description: t("description"),
    applicationName: SITE.name,
    openGraph: { type: "website", siteName: SITE.name, locale: OG_LOCALE[locale] },
    twitter: { card: "summary_large_image" },
    robots: { index: true, follow: true },
    formatDetection: { telephone: false },
  };
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: colors.light.background },
    { media: "(prefers-color-scheme: dark)", color: colors.dark.background },
  ],
};

export default async function LocaleLayout({ children, params }: LayoutProps<"/[locale]">) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: "common" });
  return (
    <html lang={INTL_LOCALE[locale]} className={fontVariables}>
      <body>
        <a href="#contenido" className="pwt-skip-link">
          {t("skipToContent")}
        </a>
        <NextIntlClientProvider>
          <AppProviders>{children}</AppProviders>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
