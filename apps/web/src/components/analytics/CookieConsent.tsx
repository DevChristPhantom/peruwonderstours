"use client";

import { useTranslations } from "next-intl";
import { useEffect, useId, useSyncExternalStore } from "react";

import { buttonClass } from "@/components/ui/button-styles";
import { Link } from "@/i18n/navigation";
import {
  clearAnalyticsCookies,
  consentSnapshot,
  GA_ID,
  loadAnalytics,
  OPEN_SETTINGS_EVENT,
  readConsent,
  saveConsent,
  subscribeConsent,
  type Consent,
} from "@/lib/analytics/consent";

/**
 * Aviso de cookies analíticas. "Aceptar" y "Rechazar" con el mismo peso visual (sin empujar a aceptar).
 * No bloquea la página: es una franja inferior, no un modal. Sin GA_ID no se renderiza.
 * En el servidor la instantánea es "server": el aviso aparece recién al hidratar (sin desalinear el HTML).
 */
export function CookieConsent() {
  const t = useTranslations("cookieConsent");
  const id = useId();
  const snapshot = useSyncExternalStore(subscribeConsent, consentSnapshot, () => "server");
  const [consent, state] = snapshot.split("|");

  useEffect(() => {
    if (GA_ID && consent === "granted") loadAnalytics(GA_ID);
  }, [consent]);

  if (!GA_ID || state !== "open") return null;

  const choose = (value: Consent) => {
    const previous = readConsent();
    saveConsent(value);
    if (value === "denied" && previous === "granted") {
      // gtag.js ya está cargado en esta página: se borra su rastro y se recarga sin él.
      clearAnalyticsCookies();
      location.reload();
    }
  };

  return (
    <section
      role="region"
      aria-labelledby={`${id}-title`}
      className="fixed inset-x-0 bottom-0 z-50 border-t border-border bg-surface shadow-lg"
    >
      <div className="pwt-container flex flex-col gap-4 py-4 md:flex-row md:items-center md:justify-between md:gap-8">
        <div className="max-w-3xl text-sm">
          <h2 id={`${id}-title`} className="font-medium text-foreground">
            {t("title")}
          </h2>
          <p className="mt-1 text-foreground-muted">
            {t("body")}{" "}
            <Link href="/politicas/cookies" className="pwt-link">
              {t("policy")}
            </Link>
          </p>
        </div>
        <div className="flex shrink-0 gap-3">
          <button type="button" onClick={() => choose("denied")} className={buttonClass("outline", "md", "flex-1 md:flex-none")}>
            {t("reject")}
          </button>
          <button type="button" onClick={() => choose("granted")} className={buttonClass("outline", "md", "flex-1 md:flex-none")}>
            {t("accept")}
          </button>
        </div>
      </div>
    </section>
  );
}

/** Ítem de lista del pie para cambiar la decisión. Sin GA_ID no hay nada que configurar (ni `<li>` vacío). */
export function CookieSettingsButton({ className }: { className?: string }) {
  const t = useTranslations("cookieConsent");
  if (!GA_ID) return null;
  return (
    <li>
      <button type="button" className={className} onClick={() => window.dispatchEvent(new Event(OPEN_SETTINGS_EVENT))}>
        {t("settings")}
      </button>
    </li>
  );
}
