import { hasLocale } from "next-intl";
import { getRequestConfig } from "next-intl/server";

import { routing, TIME_ZONE } from "./routing";

/**
 * Configuración por petición de next-intl: diccionario del idioma, zona horaria de Lima y formatos.
 * Las páginas llaman a `setRequestLocale(locale)` para permitir el render estático (SSG/ISR).
 */
export default getRequestConfig(async ({ requestLocale }) => {
  const requested = await requestLocale;
  const locale = hasLocale(routing.locales, requested) ? requested : routing.defaultLocale;
  return {
    locale,
    timeZone: TIME_ZONE,
    messages: (await import(`../../messages/${locale}.json`)).default,
  };
});
