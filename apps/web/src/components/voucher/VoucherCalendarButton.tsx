"use client";

import { CalendarPlus } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";

import { bookingPath } from "@/i18n/paths";
import { absoluteUrl } from "@/lib/site";
import { buildIcs, downloadIcs } from "@/lib/trip/ics";
import { useUiStore } from "@/stores/ui-store";
import { buttonClass } from "@/components/ui/button-styles";

interface VoucherCalendarButtonProps {
  code: string;
  items: { id: string; title: string; date: string; pax: number }[];
}

/** .ics de la reserva (HU-B.A5/A2): código y tours, sin datos personales. */
export function VoucherCalendarButton({ code, items }: VoucherCalendarButtonProps) {
  const t = useTranslations("voucher");
  const locale = useLocale();
  const announce = useUiStore((s) => s.announce);
  return (
    <button
      type="button"
      className={buttonClass("outline", "md")}
      onClick={() => {
        const ics = buildIcs(
          items.map((item) => ({
            uid: `${code}-${item.id}@peruwonderstours.com`,
            title: t("ics.title", { title: item.title, code }),
            date: item.date,
            days: 1,
            description: [t("ics.description", { code, count: item.pax }), t("ics.pickup")].join("\n"),
            url: absoluteUrl(bookingPath(locale, code)),
          })),
          { name: t("ics.calendarName", { code }) },
        );
        downloadIcs(ics, t("ics.fileName", { code }));
        announce(t("ics.announce"));
      }}
    >
      <CalendarPlus aria-hidden size={18} strokeWidth={1.5} />
      {t("ics.button")}
    </button>
  );
}
