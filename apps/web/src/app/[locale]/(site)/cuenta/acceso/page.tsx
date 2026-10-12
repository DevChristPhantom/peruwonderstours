import type { Metadata } from "next";
import { connection } from "next/server";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { LoginExchangeForm, LoginRequestForm } from "@/components/account/AccountForms";
import { Breadcrumbs } from "@/components/layout/Breadcrumbs";
import { Link } from "@/i18n/navigation";
import { localePath } from "@/i18n/paths";
import type { Locale } from "@/i18n/routing";
import { readCustomerSession } from "@/lib/account/session";
import { alternatesFor, pageMetadata } from "@/lib/seo/metadata";

export async function generateMetadata({ params }: PageProps<"/[locale]/cuenta/acceso">): Promise<Metadata> {
  const locale = (await params).locale as Locale;
  const t = await getTranslations({ locale, namespace: "account.access" });
  return {
    ...pageMetadata({ locale, title: t("title"), description: t("description"), paths: alternatesFor("/cuenta/acceso"), index: false }),
    // El token del enlace no debe filtrarse a terceros vía Referer.
    referrer: "no-referrer",
  };
}

/**
 * Acceso sin contraseña a "Mis reservas": sin token → pedir el enlace por correo (respuesta genérica);
 * con `?token=` → botón que canjea el enlace con un POST (Server Action), nunca al abrir la página.
 */
export default async function AccountAccessPage({ params, searchParams }: PageProps<"/[locale]/cuenta/acceso">) {
  const locale = (await params).locale as Locale;
  setRequestLocale(locale);
  // Render dinámico: depende del token de la URL, de la cookie y de la CSP con nonce.
  await connection();
  const query = await searchParams;
  const raw = query.token;
  const token = typeof raw === "string" && raw.length >= 20 && raw.length <= 200 ? raw : null;
  const loggedOut = query.salida === "1";
  const [t, tc, session] = await Promise.all([getTranslations("account.access"), getTranslations("common"), readCustomerSession()]);

  return (
    <div className="pwt-container-narrow pt-8 pb-20">
      <Breadcrumbs
        items={[
          { name: tc("home"), path: localePath(locale, "/") },
          { name: t("title"), path: localePath(locale, "/cuenta/acceso") },
        ]}
      />
      <h1 className="mt-4 font-display text-h1 font-medium">{t("title")}</h1>
      {loggedOut ? (
        <p role="status" className="mt-6 rounded-md border border-success bg-success-soft p-4 text-sm text-success">
          {t("loggedOut")}
        </p>
      ) : null}
      {session && !token ? (
        <p className="mt-6 rounded-md border border-border bg-surface-muted p-4 text-sm">
          {t("alreadyIn")}{" "}
          <Link href="/mis-reservas" className="pwt-link">
            {t("goToBookings")}
          </Link>
        </p>
      ) : null}
      {token ? (
        <section aria-labelledby="cuenta-token" className="mt-8 rounded-lg border border-border bg-surface p-6">
          <h2 id="cuenta-token" className="text-h3 font-medium">
            {t("tokenTitle")}
          </h2>
          <p className="mt-2 mb-5 text-foreground-muted">{t("tokenText")}</p>
          <LoginExchangeForm token={token} />
        </section>
      ) : null}
      <section aria-labelledby="cuenta-pedir" className="mt-8">
        <h2 id="cuenta-pedir" className={token ? "text-h4 font-medium" : "sr-only"}>
          {t("submit")}
        </h2>
        <p className="mt-2 mb-6 text-foreground-muted">{t("intro")}</p>
        <LoginRequestForm />
        <p className="mt-6 text-sm text-foreground-muted">{t("privacy")}</p>
        <p className="mt-2 text-sm text-foreground-muted">
          {t("byCode")}{" "}
          <Link href="/reserva/acceso" className="pwt-link">
            {t("byCodeLink")}
          </Link>
        </p>
      </section>
    </div>
  );
}
