import type { Metadata } from "next";
import { connection } from "next/server";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { ArrowUpRight, BookOpenCheck } from "lucide-react";
import Link from "next/link";

import { Breadcrumbs } from "@/components/layout/Breadcrumbs";
import { ComplaintForm } from "@/components/complaints/ComplaintForm";
import { localePath } from "@/i18n/paths";
import type { Locale } from "@/i18n/routing";
import { alternatesFor, pageMetadata } from "@/lib/seo/metadata";
import { SITE } from "@/lib/site";
import { buttonClass } from "@/components/ui/button-styles";
import styles from "./complaints.module.css";

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
  const [t, tc, tf, ta] = await Promise.all([getTranslations("complaints.page"), getTranslations("common"), getTranslations("complaints.form.help"), getTranslations("access.complaint")]);
  return (
    <div className="pwt-container-narrow pt-8 pb-20 sm:pt-10">
      <div className="print:hidden">
        <Breadcrumbs
          items={[
            { name: tc("home"), path: localePath(locale, "/") },
            { name: t("title"), path: localePath(locale, "/libro-de-reclamaciones") },
          ]}
        />
        <header className="mt-6 rounded-xl border border-border bg-surface p-5 sm:p-8">
          <div className="flex items-start gap-4">
            <span className="flex size-12 shrink-0 items-center justify-center rounded-md bg-primary text-on-primary sm:size-14"><BookOpenCheck aria-hidden size={26} strokeWidth={1.5} /></span>
            <div className="min-w-0">
              <p className="text-xs font-semibold tracking-[0.08em] text-primary uppercase">{SITE.name}</p>
              <h1 className="mt-2 font-display text-h2 font-medium leading-tight sm:text-h1">{t("title")}</h1>
            </div>
          </div>
          <p className="mt-5 text-sm leading-relaxed text-foreground-muted sm:text-base">{t("intro", { name: SITE.name, whatsapp: SITE.whatsapp.display })}</p>
          <Link href={localePath(locale, "/libro-de-reclamaciones/consulta")} className={buttonClass("outline", "md", "mt-5 max-w-full whitespace-normal text-left")}>
            {ta("title")} <ArrowUpRight aria-hidden size={17} className="shrink-0" />
          </Link>
        </header>
        <ol className="mt-5 grid gap-3 sm:grid-cols-3">
          {(["section1", "section2", "section3"] as const).map((section, index) => (
            <li key={section} className="flex items-start gap-3 rounded-md border border-border bg-surface px-4 py-4">
              <span className="flex size-7 shrink-0 items-center justify-center rounded-pill bg-surface-muted text-xs font-semibold text-primary" aria-hidden>{String(index + 1).padStart(2, "0")}</span>
              <span className="text-xs font-medium leading-relaxed">{tf(section)}</span>
            </li>
          ))}
        </ol>
        {locale !== "es" ? (
          <p role="note" className="mt-4 rounded-md border border-border bg-surface-muted px-4 py-3 text-sm">
            {t("spanishForm")}
          </p>
        ) : null}
      </div>
      <div lang="es-PE" className={`mt-8 ${styles.sheet}`}>
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
