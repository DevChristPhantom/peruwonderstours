"use client";

import { Check } from "lucide-react";
import { useParams } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, type MouseEvent } from "react";

import { getPathname, usePathname } from "@/i18n/navigation";
import { INTL_LOCALE, routing, type Locale } from "@/i18n/routing";
import { useUiStore } from "@/stores/ui-store";

/**
 * Ruta equivalente de la página actual en otro idioma (W1). Las páginas con slugs traducidos fijan las
 * rutas exactas con `<LocaleAlternates>`; en el resto se traduce la ruta interna con sus parámetros.
 * La búsqueda (`?destino=…`) se conserva al hacer clic.
 */
export function useLocaleHref(): (target: Locale) => string {
  const pathname = usePathname();
  const params = useParams();
  const alternates = useUiStore((s) => s.localeAlternates);
  return (target) => {
    if (alternates) return alternates[target];
    const routeParams = Object.fromEntries(
      Object.entries(params).filter(([key, value]) => key !== "locale" && typeof value === "string"),
    ) as Record<string, string>;
    try {
      // `pathname` es la ruta interna (`/destinos/[slug]`); los parámetros vienen de la URL actual.
      return getPathname({ locale: target, href: { pathname, params: routeParams } as Parameters<typeof getPathname>[0]["href"] });
    } catch {
      return getPathname({ locale: target, href: "/" });
    }
  };
}

function keepSearch(e: MouseEvent<HTMLAnchorElement>) {
  const search = window.location.search;
  if (!search || e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
  e.preventDefault();
  window.location.assign(`${e.currentTarget.getAttribute("href")}${search}`);
}

/** Lista de idiomas como enlaces (`hreflang`, `lang`, `aria-current`). */
export function LanguageLinks({ className, itemClassName, onNavigate }: { className?: string; itemClassName?: string; onNavigate?: () => void }) {
  const locale = useLocale();
  const t = useTranslations("language");
  const hrefFor = useLocaleHref();
  return (
    <ul className={className}>
      {routing.locales.map((l) => (
        <li key={l}>
          <a
            href={hrefFor(l)}
            hrefLang={INTL_LOCALE[l]}
            lang={INTL_LOCALE[l]}
            aria-current={l === locale ? "true" : undefined}
            className={itemClassName}
            onClick={(e) => {
              onNavigate?.();
              if (l !== locale) keepSearch(e);
            }}
          >
            {t(`name.${l}`)}
            {l === locale ? <Check aria-hidden size={16} strokeWidth={1.5} /> : null}
          </a>
        </li>
      ))}
    </ul>
  );
}

/** Fija las rutas equivalentes de esta página en cada idioma (tour, destino, categoría, post). */
export function LocaleAlternates({ value }: { value: { es: string; en: string } }) {
  const set = useUiStore((s) => s.setLocaleAlternates);
  const { es, en } = value;
  useEffect(() => {
    set({ es, en });
    return () => set(null);
  }, [es, en, set]);
  return null;
}
