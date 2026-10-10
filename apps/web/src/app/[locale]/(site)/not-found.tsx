import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { buttonClass } from "@/components/ui/button-styles";
import { Link } from "@/i18n/navigation";

export const metadata: Metadata = { robots: { index: false } };

/** 404 útil y neutro (HU-0.2, L10): no asume que se buscaba un tour. */
export default async function NotFound() {
  const t = await getTranslations("notFound");
  return (
    <div className="pwt-container-narrow py-24 text-center">
      <title>{t("title")}</title>
      <p className="text-label font-medium tracking-[0.08em] text-foreground-muted uppercase">{t("eyebrow")}</p>
      <h1 className="mt-2 font-display text-h1 font-medium">{t("title")}</h1>
      <p className="mt-3 text-foreground-muted">{t("body")}</p>
      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <Link href="/" className={buttonClass("primary", "lg")}>
          {t("home")}
        </Link>
        <Link href="/tours" className={buttonClass("outline", "lg")}>
          {t("tours")}
        </Link>
        <Link href="/contactenos" className={buttonClass("ghost", "lg")}>
          {t("contact")}
        </Link>
      </div>
    </div>
  );
}
