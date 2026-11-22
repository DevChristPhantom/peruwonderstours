import type { Metadata } from "next";
import { connection } from "next/server";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { LoginExchangeForm, LoginRequestForm } from "@/components/account/AccountForms";
import { Breadcrumbs } from "@/components/layout/Breadcrumbs";
import { Link } from "@/i18n/navigation";
import { localePath } from "@/i18n/paths";
import type { Locale } from "@/i18n/routing";
import { googleSignInEnabled } from "@/lib/account/google";
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
  const googleNotice = { "sin-reservas": "googleNoBookings", error: "googleFailed", cancelado: "googleCancelled" } as const;
  const googleKey = typeof query.google === "string" && query.google in googleNotice ? googleNotice[query.google as keyof typeof googleNotice] : null;
  const google = googleSignInEnabled();
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
      {googleKey ? (
        <p role="alert" className="mt-6 rounded-md border border-border bg-surface-muted p-4 text-sm">
          {t(googleKey)}
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
        {google && !token ? (
          <div className="mt-6">
            {/* Enlace normal (no Link): navegación completa a Google, sin prefetch. */}
            <a
              href={`/api/auth/google/start?locale=${locale}`}
              rel="nofollow"
              className="inline-flex min-h-12 w-full items-center justify-center gap-3 rounded-md border border-border bg-white px-5 text-base font-medium text-[#1f1f1f] shadow-sm transition-colors hover:bg-[#f7f8f8] focus-visible:outline-2 focus-visible:outline-offset-2 sm:w-auto"
            >
              <svg aria-hidden="true" viewBox="0 0 48 48" className="size-5">
                <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
                <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
                <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
                <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
              </svg>
              {t("googleButton")}
            </a>
            <p className="mt-4 text-sm text-foreground-muted">{t("googleOr")}</p>
          </div>
        ) : null}
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
