import { Clock, MapPin, MessageCircle } from "lucide-react";
import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { ContactForm } from "@/components/forms/ContactForm";
import { Breadcrumbs } from "@/components/layout/Breadcrumbs";
import { localePath } from "@/i18n/paths";
import type { Locale } from "@/i18n/routing";
import { alternatesFor, pageMetadata } from "@/lib/seo/metadata";
import { SITE, whatsappHref } from "@/lib/site";

export async function generateMetadata({ params }: PageProps<"/[locale]/contactenos">): Promise<Metadata> {
  const locale = (await params).locale as Locale;
  const t = await getTranslations({ locale, namespace: "contact" });
  return pageMetadata({ locale, title: t("title"), description: t("description"), paths: alternatesFor("/contactenos") });
}

/** Contacto (F3): datos de atención y formulario (Server Action → `POST /contact`). */
export default async function ContactPage({ params }: PageProps<"/[locale]/contactenos">) {
  const locale = (await params).locale as Locale;
  setRequestLocale(locale);
  const [t, tc, th] = await Promise.all([getTranslations("contact"), getTranslations("common"), getTranslations("header")]);

  return (
    <div className="pwt-container pt-8 pb-20">
      <Breadcrumbs
        items={[
          { name: tc("home"), path: localePath(locale, "/") },
          { name: t("title"), path: localePath(locale, "/contactenos") },
        ]}
      />
      <h1 className="mt-4 font-display text-h1 font-medium">{t("title")}</h1>
      <div className="mt-8 grid gap-10 lg:grid-cols-[1fr_1.4fr]">
        <div>
          <p className="text-body-lg text-foreground-muted">{t("intro")}</p>
          <ul className="mt-6 space-y-3">
            <li>
              <a
                href={whatsappHref(th("whatsappMessage"))}
                target="_blank"
                rel="noopener noreferrer"
                className="pwt-link inline-flex min-h-11 items-center gap-2"
              >
                <MessageCircle aria-hidden size={20} strokeWidth={1.5} />
                {t("whatsapp", { number: SITE.whatsapp.display })}
              </a>
            </li>
            {SITE.legal.address ? (
              <li className="inline-flex items-center gap-2">
                <MapPin aria-hidden size={20} strokeWidth={1.5} />
                {t("office", { address: SITE.legal.address })}
              </li>
            ) : null}
            <li className="flex items-center gap-2">
              <Clock aria-hidden size={20} strokeWidth={1.5} />
              {t("hours")}
            </li>
          </ul>
        </div>
        <section aria-labelledby="contacto-form" className="rounded-lg border border-border bg-surface p-6">
          <h2 id="contacto-form" className="mb-5 text-h3 font-medium">
            {t("formTitle")}
          </h2>
          <ContactForm />
        </section>
      </div>
    </div>
  );
}
