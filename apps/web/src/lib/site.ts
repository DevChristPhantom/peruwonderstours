/**
 * Datos del sitio y de la agencia. ÚNICO lugar con los datos que dependen del cliente.
 *
 * Regla: no se inventan datos legales. Lo no confirmado queda en `null` y la UI muestra el marcador
 * visible "por confirmar" (`common.pending`). Lista de pendientes del cliente: `CLIENT_PENDING` abajo
 * y docs/cliente/solicitud-de-informacion.md.
 */
export const SITE = {
  name: "peruwonderstours",
  url: "https://peruwonderstours.com",
  legal: {
    /** PENDIENTE(cliente): razón social (el sitio viejo muestra datos inconsistentes). */
    businessName: null as string | null,
    /** PENDIENTE(cliente): RUC real. El sitio viejo muestra el placeholder 20000000000: NO usarlo. */
    ruc: null as string | null,
    /** Ejemplo solicitado para la vista previa; no es la identidad fiscal de la agencia. */
    rucExample: "20000000000",
    /** PENDIENTE(cliente): n.º de registro de agencia MINCETUR/GERCETUR. */
    minceturRegistry: null as string | null,
    /** Dirección confirmada por el propietario el 2026-10-14. */
    address: "Calle N 500, Puno" as string | null,
    /** Correo de contacto confirmado por el cliente; el dominio de la web es independiente. */
    email: "jorgechaveztourt@gmail.com" as string | null,
  },
  /**
   * WhatsApp confirmado por el cliente el 13 de octubre de 2026.
   * Se puede sobrescribir con NEXT_PUBLIC_WHATSAPP_NUMBER (solo dígitos, con código de país).
   */
  whatsapp: {
    display: "+51 924 278 597",
    digits: process.env.NEXT_PUBLIC_WHATSAPP_NUMBER ?? "51924278597",
  },
} as const;

/**
 * Pendientes que dependen del cliente (paso 8 del sprint 3). Se muestran como marcador visible en la
 * UI donde aplican; no se resuelven en código.
 */
export const CLIENT_PENDING = {
  /** Razón social y RUC (footer, Libro de Reclamaciones, comprobantes). */
  legalIdentity: SITE.legal.businessName === null || SITE.legal.ruc === null,
  /** Registro de agencia MINCETUR/GERCETUR. */
  minceturRegistry: SITE.legal.minceturRegistry === null,
  /** Pasarela de pago real (hoy solo el sandbox simulado; ver lib/payments/types.ts). */
  paymentGateway: process.env.NEXT_PUBLIC_PAYMENTS_MODE !== "live",
} as const;

/**
 * Interruptores de sellos de confianza (lib/trust.ts). APAGADOS hasta que el cliente envíe la constancia
 * o licencia de cada uno (mostrar un sello sin tenerlo es publicidad engañosa). El Libro de Reclamaciones
 * no tiene interruptor: es obligatorio y siempre visible.
 */
export const BADGE_SWITCHES = {
  "safe-travels": { enabled: false },
  "gercetur-puno": { enabled: false },
  promperu: { enabled: false },
  "marca-peru": { enabled: false },
  sernanp: { enabled: false },
  "mincetur-agencia-registrada": { enabled: false },
  /** El sello ESNNA exige la Declaración Jurada firmada; el enlace informativo se muestra siempre. */
  esnna: { enabled: false },
} as const satisfies Record<string, { enabled: boolean }>;

export function whatsappHref(message?: string): string {
  const base = `https://wa.me/${SITE.whatsapp.digits}`;
  return message ? `${base}?text=${encodeURIComponent(message)}` : base;
}

export function absoluteUrl(path: string): string {
  return new URL(path, SITE.url).toString();
}
