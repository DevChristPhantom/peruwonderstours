import { Clock, Mail, MapPin, MessageCircle } from "lucide-react";
import type { Metadata } from "next";
import Image from "next/image";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { ContactForm } from "@/components/forms/ContactForm";
import { Breadcrumbs } from "@/components/layout/Breadcrumbs";
import { localePath } from "@/i18n/paths";
import type { Locale } from "@/i18n/routing";
import { getDestinations } from "@/lib/catalog";
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
  const [t, tc, th, destinations] = await Promise.all([getTranslations("contact"), getTranslations("common"), getTranslations("header"), getDestinations(locale)]);
  const puno = destinations.find((destination) => destination.key === "tours-en-puno");
  const punoImage = puno?.bannerImage ?? puno?.cardImage;

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
            {SITE.legal.email ? (
              <li>
                <a href={`mailto:${SITE.legal.email}`} className="pwt-link inline-flex min-h-11 items-center gap-2 break-all">
                  <Mail aria-hidden size={20} strokeWidth={1.5} />
                  {SITE.legal.email}
                </a>
              </li>
            ) : null}
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
          {puno && punoImage ? (
            <figure className="mt-8 overflow-hidden rounded-lg border border-border bg-surface" lang={puno.fallback ? "es-PE" : undefined}>
              <div className="relative aspect-[4/3]">
                <Image src={punoImage.src} alt={punoImage.alt || puno.name} fill sizes="(min-width: 1280px) 470px, (min-width: 1024px) 38vw, 100vw" className="object-cover" loading="lazy" />
              </div>
              <figcaption className="px-5 py-3 text-sm text-foreground-muted">{puno.name}</figcaption>
            </figure>
          ) : null}
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
