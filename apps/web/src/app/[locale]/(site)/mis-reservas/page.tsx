import type { Metadata } from "next";
import { connection } from "next/server";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { PendingButton } from "@/components/account/AccountForms";
import { Breadcrumbs } from "@/components/layout/Breadcrumbs";
import { buttonClass } from "@/components/ui/button-styles";
import { Link } from "@/i18n/navigation";
import { localePath } from "@/i18n/paths";
import type { Locale } from "@/i18n/routing";
import { logoutAction, openMyBookingAction } from "@/lib/account/actions";
import { readCustomerSession } from "@/lib/account/session";
import { listMyBookings } from "@/lib/api/access";
import type { Booking } from "@/lib/api/bookings";
import { ApiError } from "@/lib/api/client";
import { formatFor } from "@/lib/format";
import { alternatesFor, pageMetadata } from "@/lib/seo/metadata";

export async function generateMetadata({ params }: PageProps<"/[locale]/mis-reservas">): Promise<Metadata> {
  const locale = (await params).locale as Locale;
  const t = await getTranslations({ locale, namespace: "account.bookings" });
  return pageMetadata({ locale, title: t("title"), description: t("description"), paths: alternatesFor("/mis-reservas"), index: false });
}

const STATUS_KEYS = ["pending", "held", "confirmed", "partially_paid", "paid", "completed", "cancelled", "refunded"] as const;
type StatusKey = (typeof STATUS_KEYS)[number];
const isStatus = (value: string): value is StatusKey => (STATUS_KEYS as readonly string[]).includes(value);

/**
 * "Mis reservas" (SSR por petición): la sesión del cliente sale de la cookie httpOnly y solo el
 * servidor la envía a la API (`X-Customer-Token`). "Abrir" pide el acceso a la reserva con un POST.
 */
export default async function MyBookingsPage({ params, searchParams }: PageProps<"/[locale]/mis-reservas">) {
  const locale = (await params).locale as Locale;
  setRequestLocale(locale);
  await connection();
  const [t, tv, tc] = await Promise.all([getTranslations("account.bookings"), getTranslations("voucher"), getTranslations("common")]);
  const fmt = formatFor(locale);
  const openError = (await searchParams).error === "open";
  const session = await readCustomerSession();

  let bookings: Booking[] | null = null;
  let problem: "signedOut" | "expired" | "unavailable" | null = session ? null : "signedOut";
  if (session) {
    try {
      bookings = await listMyBookings(session);
    } catch (error) {
      problem = error instanceof ApiError && error.status === 401 ? "expired" : "unavailable";
    }
  }

  return (
    <div className="pwt-container-narrow pt-8 pb-20">
      <Breadcrumbs
        items={[
          { name: tc("home"), path: localePath(locale, "/") },
          { name: t("title"), path: localePath(locale, "/mis-reservas") },
        ]}
      />
      <div className="mt-4 flex flex-wrap items-center justify-between gap-4">
        <h1 className="font-display text-h1 font-medium">{t("title")}</h1>
        {session ? (
          <form action={logoutAction}>
            <input type="hidden" name="locale" value={locale} />
            <PendingButton label={t("logout")} pendingLabel={t("loggingOut")} variant="ghost" />
          </form>
        ) : null}
      </div>

      {problem ? (
        <div role={problem === "unavailable" ? "alert" : "status"} className="mt-8 rounded-lg border border-border bg-surface p-6">
          <p>{t(`problems.${problem}`)}</p>
          {problem !== "unavailable" ? (
            <Link href="/cuenta/acceso" className={buttonClass("primary", "lg", "mt-4")}>
              {t("signIn")}
            </Link>
          ) : null}
        </div>
      ) : null}

      {openError ? (
        <p role="alert" className="mt-6 rounded-md border border-danger bg-danger-soft p-4 text-sm text-danger">
          {t("openError")}
        </p>
      ) : null}

      {bookings && bookings.length === 0 ? (
        <div className="mt-8 rounded-lg border border-border bg-surface p-6">
          <p>{t("empty")}</p>
          <Link href="/tours" className={buttonClass("secondary", "lg", "mt-4")}>
            {t("browseTours")}
          </Link>
        </div>
      ) : null}

      {bookings && bookings.length > 0 ? (
        <ul className="mt-8 space-y-4" aria-label={t("listLabel")}>
          {bookings.map((b) => {
            const firstDate = b.firstServiceDate ?? b.items.map((i) => i.travelDate).sort()[0] ?? null;
            return (
              <li key={b.code} className="rounded-lg border border-border bg-surface p-5">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="min-w-0">
                    <p className="font-mono text-h4 tracking-wide">{b.code}</p>
                    <p className="mt-1 text-sm text-foreground-muted">
                      {isStatus(b.status) ? tv(`status.${b.status}`) : b.status}
                      {firstDate ? ` · ${t("travelDate", { date: fmt.date(firstDate) })}` : ""}
                    </p>
                  </div>
                  <p className="tabular font-semibold">{fmt.money(b.total.amount, b.currency)}</p>
                </div>
                <ul className="mt-3 space-y-1 text-sm">
                  {b.items.map((i) => (
                    <li key={i.id}>
                      {i.tourTitle} · {fmt.date(i.travelDate)} · {tv("travelers", { count: i.paxCount })}
                    </li>
                  ))}
                </ul>
                <form action={openMyBookingAction} className="mt-4">
                  <input type="hidden" name="locale" value={locale} />
                  <input type="hidden" name="code" value={b.code} />
                  <PendingButton label={t("open")} pendingLabel={t("opening")} variant="outline" ariaLabel={t("openLabel", { code: b.code })} />
                </form>
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}
