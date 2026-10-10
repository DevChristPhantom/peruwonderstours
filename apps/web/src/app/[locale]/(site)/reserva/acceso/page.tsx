import type { Metadata } from "next";
import { connection } from "next/server";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { AccessExchangeForm, AccessRequestForm } from "@/components/access/AccessForms";
import { Breadcrumbs } from "@/components/layout/Breadcrumbs";
import { localePath } from "@/i18n/paths";
import type { Locale } from "@/i18n/routing";
import { exchangeAccessLinkAction, requestAccessLinkAction } from "@/lib/access/actions";
import { alternatesFor, pageMetadata } from "@/lib/seo/metadata";

export async function generateMetadata({ params }: PageProps<"/[locale]/reserva/acceso">): Promise<Metadata> {
  const locale = (await params).locale as Locale;
  const t = await getTranslations({ locale, namespace: "access.booking" });
  return {
    ...pageMetadata({ locale, title: t("title"), description: t("description"), paths: alternatesFor("/reserva/acceso"), index: false }),
    // El token del enlace no debe filtrarse a terceros vía Referer.
    referrer: "no-referrer",
  };
}

/**
 * Acceso a la reserva sin contraseña (F0/F0b): `?token=` del correo → botón que canjea el enlace;
 * sin token → formulario para pedir un enlace nuevo (código + correo).
 */
export default async function BookingAccessPage({ params, searchParams }: PageProps<"/[locale]/reserva/acceso">) {
  const locale = (await params).locale as Locale;
  setRequestLocale(locale);
  // Render dinámico: depende del token de la URL y de la CSP con nonce.
  await connection();
  const raw = (await searchParams).token;
  const token = typeof raw === "string" && raw.length >= 20 && raw.length <= 200 ? raw : null;
  const [t, ta, tc] = await Promise.all([getTranslations("access.booking"), getTranslations("access"), getTranslations("common")]);

  return (
    <div className="pwt-container-narrow pt-8 pb-20">
      <Breadcrumbs
        items={[
          { name: tc("home"), path: localePath(locale, "/") },
          { name: t("title"), path: localePath(locale, "/reserva/acceso") },
        ]}
      />
      <h1 className="mt-4 font-display text-h1 font-medium">{t("title")}</h1>
      {token ? (
        <section aria-labelledby="acceso-token" className="mt-8 rounded-lg border border-border bg-surface p-6">
          <h2 id="acceso-token" className="text-h3 font-medium">
            {t("tokenTitle")}
          </h2>
          <p className="mt-2 mb-5 text-foreground-muted">{t("tokenText")}</p>
          <AccessExchangeForm kind="booking" token={token} action={exchangeAccessLinkAction.bind(null, "booking")} />
        </section>
      ) : null}
      <section aria-labelledby="acceso-pedir" className="mt-8">
        <h2 id="acceso-pedir" className={token ? "text-h4 font-medium" : "sr-only"}>
          {ta("submit")}
        </h2>
        <p className="mt-2 mb-6 text-foreground-muted">{t("intro")}</p>
        <AccessRequestForm kind="booking" action={requestAccessLinkAction.bind(null, "booking")} />
        <p className="mt-6 text-sm text-foreground-muted">{ta("privacy")}</p>
      </section>
    </div>
  );
}
