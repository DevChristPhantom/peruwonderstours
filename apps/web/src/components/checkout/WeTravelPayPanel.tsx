"use client";

import { ExternalLink, Loader2 } from "lucide-react";
import { useTranslations } from "next-intl";

import { buttonClass } from "@/components/ui/button-styles";

/**
 * Paso de WeTravel: el enlace de pago se abre en una pestaña nueva (con un clic del viajero, para que el
 * navegador no lo bloquee) y «Ya pagué» consulta el estado a la API, que se lo pregunta a WeTravel.
 * Si el viajero cierra todo, la conciliación periódica de la API igual registra el pago.
 */
export function WeTravelPayPanel({ url, checking, onPaid }: { url: string; checking: boolean; onPaid: () => void }) {
  const t = useTranslations("checkout.wetravel");
  return (
    <div className="mt-4 space-y-3 rounded-lg border border-border p-4" role="region" aria-live="polite" aria-label={t("open")}>
      <p className="text-sm">{t("intro")}</p>
      <a href={url} target="_blank" rel="noopener noreferrer" className={buttonClass("primary", "lg", "w-full")}>
        <ExternalLink aria-hidden size={18} strokeWidth={1.5} />
        {t("open")}
        <span className="sr-only"> {t("newTab")}</span>
      </a>
      <button type="button" className={buttonClass("outline", "lg", "w-full")} onClick={onPaid} disabled={checking} aria-busy={checking}>
        {checking ? (
          <>
            <Loader2 aria-hidden size={18} strokeWidth={1.5} className="animate-spin motion-reduce:animate-none" />
            {t("checking")}
          </>
        ) : (
          t("paid")
        )}
      </button>
    </div>
  );
}
