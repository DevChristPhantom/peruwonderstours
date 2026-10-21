import type { Metadata } from "next";
import { connection } from "next/server";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { ArrowLeft, BookOpenCheck } from "lucide-react";
import Link from "@/components/ui/IntentLink";

import { AccessExchangeForm, AccessRequestForm } from "@/components/access/AccessForms";
import { ComplaintStatusCard } from "@/components/complaints/ComplaintStatusCard";
import { Breadcrumbs } from "@/components/layout/Breadcrumbs";
import { localePath } from "@/i18n/paths";
import type { Locale } from "@/i18n/routing";
import { exchangeAccessLinkAction, requestAccessLinkAction } from "@/lib/access/actions";
import { getComplaintStatus, type ComplaintStatusView } from "@/lib/api/complaints";
import { COMPLAINT_CODE_RE, readComplaintToken } from "@/lib/checkout/session";
import { alternatesFor, pageMetadata } from "@/lib/seo/metadata";
import { buttonClass } from "@/components/ui/button-styles";

export async function generateMetadata({ params }: PageProps<"/[locale]/libro-de-reclamaciones/consulta">): Promise<Metadata> {
  const locale = (await params).locale as Locale;
  const t = await getTranslations({ locale, namespace: "access.complaint" });
  return {
    ...pageMetadata({
      locale,
      title: t("title"),
      description: t("description"),
      paths: alternatesFor("/libro-de-reclamaciones/consulta"),
      index: false,
    }),
    referrer: "no-referrer",
  };
}

/** Lee la hoja con el token guardado en cookie httpOnly; `null` si no hay acceso o la API no responde. */
async function loadSheet(code: string | null): Promise<ComplaintStatusView | null> {
  if (!code) return null;
  const token = await readComplaintToken(code);
  if (!token) return null;
  try {
    return await getComplaintStatus(code, token);
  } catch {
    return null;
  }
}

/**
 * Consulta de una Hoja de Reclamación (F7): `?token=` del correo → botón que canjea el enlace; tras el
 * canje, `?codigo=` muestra el estado y la respuesta; sin acceso → formulario para pedir un enlace.
 */
export default async function ComplaintStatusPage({ params, searchParams }: PageProps<"/[locale]/libro-de-reclamaciones/consulta">) {
  const locale = (await params).locale as Locale;
  setRequestLocale(locale);
  await connection();
  const query = await searchParams;
  const rawToken = query.token;
  const token = typeof rawToken === "string" && rawToken.length >= 20 && rawToken.length <= 200 ? rawToken : null;
  const rawCode = typeof query.codigo === "string" ? query.codigo.toUpperCase() : null;
  const code = rawCode && COMPLAINT_CODE_RE.test(rawCode) ? rawCode : null;
  const [sheet, t, ta, tc, tl] = await Promise.all([
    loadSheet(code),
    getTranslations("access.complaint"),
    getTranslations("access"),
    getTranslations("common"),
    getTranslations("complaints.page"),
  ]);

  return (
    <div className="pwt-container-narrow pt-8 pb-20 sm:pt-10">
      <Breadcrumbs
        items={[
          { name: tc("home"), path: localePath(locale, "/") },
          { name: tl("title"), path: localePath(locale, "/libro-de-reclamaciones") },
          { name: t("title"), path: localePath(locale, "/libro-de-reclamaciones/consulta") },
        ]}
      />
      <header className="mt-6 rounded-xl border border-border bg-surface p-5 sm:p-8">
        <div className="flex items-start gap-4">
          <span className="flex size-12 shrink-0 items-center justify-center rounded-md bg-primary text-on-primary sm:size-14"><BookOpenCheck aria-hidden size={26} strokeWidth={1.5} /></span>
          <div className="min-w-0">
            <p className="text-xs font-semibold tracking-[0.08em] text-primary uppercase">{tl("title")}</p>
            <h1 className="mt-2 font-display text-h2 font-medium leading-tight sm:text-h1">{t("title")}</h1>
          </div>
        </div>
        <Link href={localePath(locale, "/libro-de-reclamaciones")} className={buttonClass("outline", "md", "mt-5 max-w-full whitespace-normal text-left")}>
          <ArrowLeft aria-hidden size={17} className="shrink-0" /> {tl("title")}
        </Link>
      </header>

      {sheet ? <ComplaintStatusCard sheet={sheet} locale={locale} /> : null}
      {code && !sheet ? (
        <p role="alert" className="mt-6 rounded-md border border-danger bg-danger-soft p-4 text-sm text-danger">
          {t("notFound")}
        </p>
      ) : null}

      {token && !sheet ? (
        <section aria-labelledby="consulta-token" className="mt-8 rounded-xl border border-border border-t-primary bg-surface p-5 shadow-sm sm:p-8">
          <h2 id="consulta-token" className="text-h3 font-medium">
            {t("tokenTitle")}
          </h2>
          <p className="mt-2 mb-5 text-foreground-muted">{t("tokenText")}</p>
          <AccessExchangeForm kind="complaint" token={token} action={exchangeAccessLinkAction.bind(null, "complaint")} />
        </section>
      ) : null}

      <section aria-labelledby="consulta-pedir" className="mt-8 rounded-xl border border-border bg-surface p-5 shadow-sm sm:p-8">
        <h2 id="consulta-pedir" className={sheet || token ? "text-h4 font-medium" : "sr-only"}>
          {sheet ? t("newRequest") : ta("submit")}
        </h2>
        <p className="mt-2 mb-6 text-foreground-muted">{t("intro")}</p>
        <AccessRequestForm kind="complaint" action={requestAccessLinkAction.bind(null, "complaint")} />
        <p className="mt-6 text-sm text-foreground-muted">{ta("privacy")}</p>
      </section>
    </div>
  );
}
