import { Clock, MapPin, MessageCircle, Users } from "lucide-react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { PayBookingForm } from "@/components/checkout/PayBookingForm";
import { buttonClass } from "@/components/ui/button-styles";
import { QrCode } from "@/components/voucher/QrCode";
import { VoucherCalendarButton } from "@/components/voucher/VoucherCalendarButton";
import { VoucherOffline, type VoucherSnapshot } from "@/components/voucher/VoucherOffline";
import { Link } from "@/i18n/navigation";
import { bookingPath } from "@/i18n/paths";
import type { Locale } from "@/i18n/routing";
import { getBookingByCode, type Booking, type BookingStatus } from "@/lib/api/bookings";
import { BOOKING_CODE_RE, readBookingToken } from "@/lib/checkout/session";
import { formatFor } from "@/lib/format";
import { PAYMENTS_MODE } from "@/lib/payments/types";
import { SITE } from "@/lib/site";
import { bookingHelpMessage, whatsappHref } from "@/lib/whatsapp/messages";

export async function generateMetadata({ params }: PageProps<"/[locale]/reserva/[codigo]">): Promise<Metadata> {
  const { codigo, locale: rawLocale } = await params;
  const locale = rawLocale as Locale;
  const code = decodeURIComponent(codigo).toUpperCase();
  const t = await getTranslations({ locale, namespace: "voucher" });
  return {
    title: t("metaTitle"),
    robots: { index: false, follow: false },
    // HU-B.A2: voucher instalable; el manifest solo contiene el código (sin datos personales).
    ...(BOOKING_CODE_RE.test(code) ? { manifest: `${bookingPath(locale, code)}/manifest.webmanifest` } : {}),
  };
}

/** Estados con voucher utilizable (reserva confirmada). */
const VOUCHER_STATUSES: BookingStatus[] = ["confirmed", "partially_paid", "paid", "completed"];

/** SSR en cada visita: estado y montos cambian con cada pago. */
export const dynamic = "force-dynamic";

const STATUS_TONE: Record<BookingStatus, "ok" | "warn" | "neutral"> = {
  pending: "warn",
  held: "warn",
  confirmed: "warn",
  partially_paid: "warn",
  paid: "ok",
  completed: "ok",
  cancelled: "neutral",
  refunded: "neutral",
};

function headlineKey(b: Booking): "paid" | "confirmed" | "pending" | "other" {
  if (b.status === "paid" || b.status === "completed") return "paid";
  if (b.status === "confirmed" || b.status === "partially_paid") return "confirmed";
  if (b.status === "held" || b.status === "pending") return "pending";
  return "other";
}

export default async function BookingPage({ params }: PageProps<"/[locale]/reserva/[codigo]">) {
  const { codigo, locale: rawLocale } = await params;
  const locale = rawLocale as Locale;
  setRequestLocale(locale);
  const code = decodeURIComponent(codigo).toUpperCase();
  const token = await readBookingToken(code);
  // Sin token o token que no coincide → 404 genérico (no revela si el código existe).
  if (!token) notFound();
  const booking = await getBookingByCode(code, token);
  if (!booking) notFound();

  const fmt = formatFor(locale);
  const t = await getTranslations("voucher");
  const money = (cents: number) => fmt.money(cents, booking.currency);
  const known = booking.status in STATUS_TONE;
  const status = {
    label: known ? t(`status.${booking.status}`) : booking.status,
    tone: known ? STATUS_TONE[booking.status] : ("neutral" as const),
  };
  const pax = (count: number) => t("travelers", { count });
  const unpaidHold = (booking.status === "held" || booking.status === "pending") && booking.paid.amount === 0;
  const canPay = booking.nextPayment !== null && !["cancelled", "refunded", "completed", "paid"].includes(booking.status);
  const hasVoucher = VOUCHER_STATUSES.includes(booking.status);
  // Momento de esta respuesta: queda impreso en la copia sin conexión ("Actualizado el …").
  const renderedAt = new Date().toISOString();
  const snapshot: VoucherSnapshot = {
    status: booking.status,
    items: booking.items.map((i) => ({ id: i.id, title: i.tourTitle, date: i.travelDate, pax: i.paxCount })),
  };
  const [waT, waUnits] = await Promise.all([getTranslations("whatsapp"), getTranslations("units")]);
  const helpMessage = bookingHelpMessage(
    { t: waT, units: waUnits, format: formatFor(locale) },
    booking.code,
    booking.items.map((i) => ({ title: i.tourTitle, date: i.travelDate })),
  );
  const toneClass =
    status.tone === "ok" ? "bg-success-soft text-success" : status.tone === "warn" ? "bg-warning-soft text-warning" : "bg-surface-muted text-foreground-muted";

  return (
    // data-pwt-voucher: marcador que el service worker exige para guardar la página de ESTE código.
    // data-pwt-voucher-last-day: último día de servicio; la copia offline caduca 7 días después (H-18).
    <div
      className="pwt-container py-12"
      data-pwt-voucher={booking.code}
      data-pwt-voucher-last-day={booking.lastServiceDate ?? booking.items.map((i) => i.travelDate).sort().at(-1) ?? undefined}
    >
      {PAYMENTS_MODE === "sandbox" ? (
        <p className="mx-auto mb-8 max-w-[720px] rounded-md border border-dashed border-warning bg-warning-soft px-4 py-2 text-center text-sm text-warning">
          {t("sandbox")}
        </p>
      ) : null}

      <section className="mx-auto max-w-[720px] text-center" aria-labelledby="booking-title">
        {booking.paid.amount > 0 ? (
          <svg viewBox="0 0 52 52" className="mx-auto size-12 text-success" aria-hidden="true">
            <circle cx="26" cy="26" r="24" fill="none" stroke="currentColor" strokeWidth="2" />
            <path className="pwt-check-draw" d="M15 27 l7 7 l15 -16" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        ) : (
          <Clock aria-hidden size={48} strokeWidth={1.5} className="mx-auto text-warning" />
        )}
        <h1 id="booking-title" className="mt-4 font-display text-h1 font-medium">
          {t(`headline.${headlineKey(booking)}`)}
        </h1>
        <p className="mt-3 text-foreground-muted">{t("keepCode")}</p>
        <p className="mt-4 font-mono text-[28px] tracking-wide">{booking.code}</p>
      </section>

      <div className="mx-auto mt-12 grid max-w-[1120px] gap-8 lg:grid-cols-[1fr_360px]">
        <div className="space-y-8">
          {hasVoucher ? (
            <section aria-labelledby="voucher-title" className="rounded-lg border-2 border-primary bg-surface p-6">
              <div className="flex flex-col gap-6 sm:flex-row sm:items-start">
                <div className="mx-auto shrink-0 sm:mx-0">
                  <QrCode value={booking.code} label={t("qrLabel", { code: booking.code })} size={176} />
                </div>
                <div className="min-w-0 flex-1">
                  <h2 id="voucher-title" className="text-h4 font-medium">
                    {t("voucherTitle")}
                  </h2>
                  <p className="mt-1 font-mono text-h3 tracking-wide">{booking.code}</p>
                  <p className="mt-1 text-sm text-foreground-muted">
                    {t("voucherHint")}
                  </p>
                  <ul className="mt-4 space-y-3">
                    {booking.items.map((item) => (
                      <li key={item.id} className="border-l-2 border-primary pl-3">
                        <p className="font-medium">{item.tourTitle}</p>
                        <p className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-foreground-muted">
                          <span>{fmt.date(item.travelDate)}</span>
                          <span className="inline-flex items-center gap-1">
                            <Users aria-hidden size={14} strokeWidth={1.5} />
                            {pax(item.paxCount)}
                          </span>
                        </p>
                        {/* TODO(API): hora y punto de recojo por ítem cuando operaciones los cargue. */}
                        <p className="mt-1 inline-flex items-center gap-1 text-sm text-foreground-muted">
                          <MapPin aria-hidden size={14} strokeWidth={1.5} />
                          {t("pickup")}
                        </p>
                      </li>
                    ))}
                  </ul>
                  <p className="mt-4 text-sm text-foreground-muted">
                    {t("updatedAt", { date: fmt.dateTime(renderedAt) })}
                  </p>
                </div>
              </div>
              <div className="mt-6 space-y-4 border-t border-border pt-4">
                <VoucherOffline code={booking.code} renderedAt={renderedAt} snapshot={snapshot} autoSave />
                <VoucherCalendarButton code={booking.code} items={snapshot.items} />
              </div>
            </section>
          ) : (
            <VoucherOffline code={booking.code} renderedAt={renderedAt} snapshot={snapshot} autoSave={false} />
          )}

          <section aria-labelledby="pay-status" className="rounded-lg border border-border bg-surface p-6">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <h2 id="pay-status" className="text-h4 font-medium">
                {t("payStatus")}
              </h2>
              <span className={`rounded-pill px-3 py-1 text-sm ${toneClass}`}>{status.label}</span>
            </div>
            <dl className="mt-4 space-y-2">
              <div className="flex justify-between gap-4">
                <dt className="text-foreground-muted">{t("paid")}</dt>
                <dd className="tabular">{money(booking.paid.amount)}</dd>
              </div>
              {booking.outstanding.amount > 0 ? (
                <div className="flex justify-between gap-4">
                  <dt className="text-foreground-muted">{t("balance")}</dt>
                  <dd className="tabular text-right">
                    {money(booking.outstanding.amount)}
                    {booking.balanceDueAt && !unpaidHold ? (
                      <span className="block text-sm text-foreground-muted">{t("dueOn", { date: fmt.instant(booking.balanceDueAt) })}</span>
                    ) : null}
                  </dd>
                </div>
              ) : null}
              {booking.refunded.amount > 0 ? (
                <div className="flex justify-between gap-4">
                  <dt className="text-foreground-muted">{t("refunded")}</dt>
                  <dd className="tabular">{money(booking.refunded.amount)}</dd>
                </div>
              ) : null}
              <div className="flex justify-between gap-4 border-t border-border pt-2">
                <dt className="font-medium">{t("total")}</dt>
                <dd className="tabular font-semibold">{money(booking.total.amount)}</dd>
              </div>
            </dl>
            {unpaidHold && booking.holdExpiresAt ? (
              <p className="mt-4 rounded-md bg-warning-soft p-3 text-sm text-warning">
                {t("holdUntil", { date: fmt.dateTime(booking.holdExpiresAt) })}
              </p>
            ) : null}
            {canPay && booking.nextPayment ? (
              <div className="mt-6 border-t border-border pt-6">
                <PayBookingForm
                  code={booking.code}
                  amountCents={booking.nextPayment.amount.amount}
                  currency={booking.currency}
                  kind={booking.nextPayment.kind}
                  holdExpiresAt={unpaidHold ? booking.holdExpiresAt : null}
                />
              </div>
            ) : null}
          </section>

          <section aria-labelledby="your-tours">
            <h2 id="your-tours" className="text-h4 font-medium">
              {t("yourTours")}
            </h2>
            <ul className="mt-4 divide-y divide-border border-y border-border">
              {booking.items.map((item) => (
                <li key={item.id} className="flex justify-between gap-4 py-4">
                  <div className="min-w-0">
                    <p className="font-medium">{item.tourTitle}</p>
                    <p className="text-sm text-foreground-muted">
                      {fmt.date(item.travelDate)} · {pax(item.paxCount)}
                    </p>
                  </div>
                  <p className="tabular text-sm">{money(item.subtotal.amount)}</p>
                </li>
              ))}
            </ul>
          </section>
        </div>

        <aside className="space-y-6">
          <section aria-labelledby="next-steps" className="rounded-lg bg-surface-muted p-6">
            <h2 id="next-steps" className="text-h4 font-medium">
              {t("nextSteps")}
            </h2>
            <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm">
              <li>{t("step1")}</li>
              <li>{t("step2")}</li>
              <li>{t("step3")}</li>
              <li>{t("step4")}</li>
            </ol>
          </section>
          <section aria-labelledby="help" className="text-sm">
            <h2 id="help" className="font-medium">
              {t("needChange")}
            </h2>
            <a
              href={whatsappHref(helpMessage)}
              target="_blank"
              rel="noopener noreferrer"
              className="pwt-link mt-1 inline-flex min-h-11 items-center gap-2"
            >
              <MessageCircle aria-hidden size={18} strokeWidth={1.5} />
              {t("whatsapp", { number: SITE.whatsapp.display })}
            </a>
            <p>
              <Link href="/libro-de-reclamaciones" className="pwt-link inline-flex min-h-11 items-center">
                {t("complaintsBook")}
              </Link>
            </p>
          </section>
          <Link href="/tours" className={buttonClass("secondary", "lg", "w-full")}>
            {t("keepExploring")}
          </Link>
        </aside>
      </div>
    </div>
  );
}
