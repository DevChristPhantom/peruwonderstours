import { setRequestLocale } from "next-intl/server";

import { CompareTray } from "@/components/compare/CompareTray";
import { SiteFooter } from "@/components/layout/SiteFooter";
import { SiteHeader } from "@/components/layout/SiteHeader";
import type { Locale } from "@/i18n/routing";
import { getNavMedia } from "@/lib/catalog";

// ISR del catálogo: se regenera cada hora o al invalidar el tag `catalog` (lib/catalog/api-repository.ts).
export const revalidate = 3600;

export default async function SiteLayout({ children, params }: LayoutProps<"/[locale]">) {
  const locale = (await params).locale as Locale;
  setRequestLocale(locale);
  const media = await getNavMedia(locale);
  return (
    <>
      <SiteHeader media={media} />
      <main id="contenido" tabIndex={-1} className="focus:outline-none">
        {children}
      </main>
      <SiteFooter />
      <CompareTray />
    </>
  );
}
