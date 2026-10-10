import type { Metadata } from "next";
import { connection } from "next/server";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { Breadcrumbs } from "@/components/layout/Breadcrumbs";
import { ComplaintForm } from "@/components/complaints/ComplaintForm";
import { localePath } from "@/i18n/paths";
import type { Locale } from "@/i18n/routing";
import { alternatesFor, pageMetadata } from "@/lib/seo/metadata";
import { SITE } from "@/lib/site";

export async function generateMetadata({ params }: PageProps<"/[locale]/libro-de-reclamaciones">): Promise<Metadata> {
  const locale = (await params).locale as Locale;
  const t = await getTranslations({ locale, namespace: "complaints.page" });
  return pageMetadata({
    locale,
    title: t("title"),
    description: t("description", { name: SITE.name }),
    paths: alternatesFor("/libro-de-reclamaciones"),
  });
}

/**
 * Libro de Reclamaciones virtual (HU-8.1): público, sin registro ni pagos previos, con la hoja en el
 * orden del Anexo I y constancia imprimible. Se envía por Server Action a `POST /api/v1/complaints`.
 * La hoja oficial se mantiene en español (normativa peruana); en inglés se avisa antes del formulario.
 */
export default async function ComplaintsBookPage({ params }: PageProps<"/[locale]/libro-de-reclamaciones">) {
  const locale = (await params).locale as Locale;
  setRequestLocale(locale);
  // Render dinámico: la CSP con nonce (H-02) exige HTML generado por petición.
  await connection();
  const [t, tc] = await Promise.all([getTranslations("complaints.page"), getTranslations("common")]);
  return (
    <div className="pwt-container-narrow pt-8 pb-20">
      <div className="print:hidden">
        <Breadcrumbs
          items={[
            { name: tc("home"), path: localePath(locale, "/") },
            { name: t("title"), path: localePath(locale, "/libro-de-reclamaciones") },
          ]}
        />
        <h1 className="mt-4 font-display text-h1 font-medium">{t("title")}</h1>
        <p className="mt-4 text-foreground-muted">{t("intro", { name: SITE.name, whatsapp: SITE.whatsapp.display })}</p>
        {locale !== "es" ? (
          <p role="note" className="mt-4 rounded-md border border-border bg-surface-muted px-4 py-3 text-sm">
            {t("spanishForm")}
          </p>
        ) : null}
      </div>
      <div lang="es-PE" className="mt-8">
        <ComplaintForm
          provider={{
            legalName: SITE.legal.businessName,
            ruc: SITE.legal.ruc,
            establishmentAddress: SITE.legal.address,
            establishmentCode: null,
          }}
        />
      </div>
    </div>
  );
}
