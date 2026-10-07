/**
 * Datos del sitio y de la agencia.
 * Regla: no se inventan datos legales. Lo no confirmado por el cliente queda en `null`
 * y la UI muestra "por confirmar".
 */
export const SITE = {
  name: "Peru Wonders Tours",
  url: "https://peruwonderstours.com",
  locale: "es-PE",
  ogLocale: "es_PE",
  defaultDescription:
    "Tours y paquetes por el sur del Perú con guías locales desde Puno: lago Titicaca, Machu Picchu, Colca y más. Reserva con el 50 %.",
  legal: {
    // TODO(cliente): razón social de Peru Wonders Tours (el sitio viejo muestra datos inconsistentes).
    businessName: null as string | null,
    // TODO(cliente): RUC real. El sitio viejo muestra el placeholder 20000000000: NO usarlo.
    ruc: null as string | null,
    // TODO(cliente): n.º de registro de agencia MINCETUR/GERCETUR.
    minceturRegistry: null as string | null,
    // Dato público del sitio actual (brain/wiki/sources/sitio-actual-andeanperutours.md). A validar.
    address: "Calle N 500, Puno" as string | null,
    // TODO(cliente): correo del dominio nuevo (@peruwonderstours.com).
    email: null as string | null,
  },
  /**
   * WhatsApp publicado en el sitio actual (a validar con el cliente).
   * Se puede sobrescribir con NEXT_PUBLIC_WHATSAPP_NUMBER (solo dígitos, con código de país).
   */
  whatsapp: {
    display: "+51 989 028 802",
    digits: process.env.NEXT_PUBLIC_WHATSAPP_NUMBER ?? "51989028802",
  },
} as const;

export function whatsappHref(message?: string): string {
  const base = `https://wa.me/${SITE.whatsapp.digits}`;
  return message ? `${base}?text=${encodeURIComponent(message)}` : base;
}

export function absoluteUrl(path: string): string {
  return new URL(path, SITE.url).toString();
}
