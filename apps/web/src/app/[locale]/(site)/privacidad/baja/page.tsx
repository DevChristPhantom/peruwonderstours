import type { Metadata } from "next";
import { connection } from "next/server";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { ApiError, apiJson } from "@/lib/api/client";

import { UnsubscribeForm } from "./UnsubscribeForm";

export async function generateMetadata({ params }: PageProps<"/[locale]/privacidad/baja">): Promise<Metadata> {
  const locale = (await params).locale as Locale;
  const t = await getTranslations({ locale, namespace: "privacy.unsubscribe" });
  return {
    title: t("metaTitle"),
    robots: { index: false, follow: false },
    // El token del enlace no debe filtrarse a terceros vía Referer.
    referrer: "no-referrer",
  };
}

type Preview = { purposes: { purpose: string; granted: boolean }[] };

/**
 * Baja de marketing con el enlace firmado de los correos (`/{idioma}/privacidad/baja?token=`, en inglés
 * `/en/privacy/unsubscribe`). La consulta y la baja pasan por el servidor de Next (el navegador nunca
 * llama a la API).
 */
export default async function UnsubscribePage({ params, searchParams }: PageProps<"/[locale]/privacidad/baja">) {
  const locale = (await params).locale as Locale;
  setRequestLocale(locale);
  await connection();
  const t = await getTranslations("privacy.unsubscribe");
  const tp = await getTranslations("privacy");
  const raw = (await searchParams).token;
  const token = typeof raw === "string" && raw.length >= 20 && raw.length <= 1024 ? raw : null;

  let preview: Preview | null = null;
  let problem: string | null = token ? null : t("errors.incomplete");
  if (token) {
    try {
      preview = (await apiJson<{ data: Preview }>(`/privacy/unsubscribe?token=${encodeURIComponent(token)}`)).data;
    } catch (error) {
      problem = error instanceof ApiError && error.status === 401 ? t("errors.tampered") : t("errors.loadFailed");
    }
  }

  return (
    <div className="mx-auto w-full max-w-xl px-4 py-12">
      <h1 className="font-display text-h2">{t("title")}</h1>
      <p className="mt-2 text-foreground-muted">{t("intro")}</p>
      <div className="mt-6">
        {problem ? (
          <p role="alert" className="rounded-md border border-danger bg-danger-soft p-4 text-sm text-danger">
            {problem}
          </p>
        ) : preview && token ? (
          <UnsubscribeForm token={token} purposes={preview.purposes} />
        ) : null}
      </div>
      <p className="mt-8 text-sm text-foreground-muted">
        {tp.rich("moreInfo", { link: (chunks) => <Link href="/politicas/proteccion-de-datos-personales">{chunks}</Link> })}
      </p>
    </div>
  );
}
