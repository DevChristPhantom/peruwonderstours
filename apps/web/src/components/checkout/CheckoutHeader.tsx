"use client";

import { Lock } from "lucide-react";
import { useTranslations } from "next-intl";

import { Link } from "@/i18n/navigation";
import { BrandLogo } from "@/components/layout/BrandLogo";

export function CheckoutHeader() {
  const t = useTranslations("checkout.header");
  return (
    <header className="sticky top-0 z-20 border-b border-border bg-surface">
      <div className="pwt-container flex h-16 items-center justify-between">
        <Link
          href="/"
          aria-label={t("home")}
          className="inline-flex min-h-11 items-center gap-2.5 text-foreground"
          onClick={(e) => {
            if (!window.confirm(t("leaveConfirm"))) e.preventDefault();
          }}
        >
          <BrandLogo />
        </Link>
        <p className="inline-flex items-center gap-2 text-sm text-success">
          <Lock aria-hidden size={16} strokeWidth={1.5} />
          {t("secure")}
        </p>
      </div>
    </header>
  );
}
