import "server-only";

import { getLocale } from "next-intl/server";

import { isLocale, type Locale } from "@/i18n/routing";

/**
 * Idioma de la petición en curso (página o Server Action), resuelto por next-intl a partir de la URL.
 * Sirve para devolver errores y armar rutas en el idioma del visitante. Respaldo: español.
 */
export async function requestLocale(): Promise<Locale> {
  try {
    const locale = await getLocale();
    return isLocale(locale) ? locale : "es";
  } catch {
    return "es";
  }
}
