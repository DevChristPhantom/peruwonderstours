import type { Metadata } from "next";
import { connection } from "next/server";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { ApiError, apiJson } from "@/lib/api/client";

import { ConfirmForm } from "./ConfirmForm";

export async function generateMetadata({ params }: PageProps<"/[locale]/privacidad/confirmar">): Promise<Metadata> {
  const locale = (await params).locale as Locale;
  const t = await getTranslations({ locale, namespace: "privacy.confirm" });
  return {
    title: t("metaTitle"),
    robots: { index: false, follow: false },
    // El token del enlace no debe filtrarse a terceros vía Referer.
    referrer: "no-referrer",
  };
}

type Preview = { purposes: { purpose: string; granted: boolean; pending: boolean }[] };

/** Doble opt-in de marketing (H-05): `/{idioma}/privacidad/confirmar?token=` (en `/en/privacy/confirm`; enlace firmado, 7 días). */
export default async function ConfirmMarketingPage({ params, searchParams }: PageProps<"/[locale]/privacidad/confirmar">) {
  const locale = (await params).locale as Locale;
  setRequestLocale(locale);
  await connection();
  const t = await getTranslations("privacy.confirm");
  const tp = await getTranslations("privacy");
  const raw = (await searchParams).token;
  const token = typeof raw === "string" && raw.length >= 20 && raw.length <= 1024 ? raw : null;

  let preview: Preview | null = null;
  let problem: string | null = token ? null : t("errors.incomplete");
  if (token) {
    try {
      preview = (await apiJson<{ data: Preview }>(`/privacy/marketing-confirmation?token=${encodeURIComponent(token)}`)).data;
    } catch (error) {
      problem = error instanceof ApiError && error.status === 401 ? t("errors.expired") : t("errors.loadFailed");
    }
  }
  const pending = preview?.purposes.filter((p) => p.pending && !p.granted).map((p) => p.purpose) ?? [];
  const granted = preview?.purposes.filter((p) => p.granted).length ?? 0;

  return (
    <div className="mx-auto w-full max-w-xl px-4 py-12">
      <h1 className="font-display text-h2">{t("title")}</h1>
      <div className="mt-6">
        {problem ? (
          <p role="alert" className="rounded-md border border-danger bg-danger-soft p-4 text-sm text-danger">
            {problem}
          </p>
        ) : token && pending.length > 0 ? (
          <ConfirmForm token={token} pending={pending} />
        ) : (
          <p role="status" className="rounded-md border border-border bg-surface-muted p-4 text-sm">
            {granted > 0 ? t("alreadyConfirmed") : t("nothingToConfirm")}
          </p>
        )}
      </div>
      <p className="mt-8 text-sm text-foreground-muted">
        {tp.rich("moreInfo", { link: (chunks) => <Link href="/politicas/proteccion-de-datos-personales">{chunks}</Link> })}
      </p>
    </div>
  );
}
