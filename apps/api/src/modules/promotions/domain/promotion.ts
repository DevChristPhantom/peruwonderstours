import { ValidationError } from '../../../shared/domain/domain-error.js';

/** Destino del botón del evento: un paquete del catálogo, una página del sitio o WhatsApp. */
export const PROMOTION_CTA_KINDS = ['tour', 'page', 'whatsapp'] as const;
export type PromotionCtaKind = (typeof PROMOTION_CTA_KINDS)[number];

/** Ruta interna del sitio, sin idioma (el sitio antepone /es, /en o /pt). Igual que el CHECK de la migración. */
export const PROMOTION_PATH = /^\/[a-z0-9/_-]*$/;

export interface PromotionWindow {
  status: 'draft' | 'published' | 'archived';
  startsAt: Date | null;
  endsAt: Date | null;
  deletedAt: Date | null;
}

/** Visible en el sitio: publicada, no borrada y dentro de su ventana de difusión. */
export function isPromotionLive(p: PromotionWindow, now: Date): boolean {
  if (p.status !== 'published' || p.deletedAt) return false;
  if (p.startsAt && now < p.startsAt) return false;
  if (p.endsAt && now >= p.endsAt) return false;
  return true;
}

type FieldErrors = Array<{ field: string; messages: string[] }>;

export interface PromotionRulesInput {
  ctaKind: PromotionCtaKind;
  tourId: string | null;
  ctaPath: string | null;
  startsAt: Date | null;
  endsAt: Date | null;
  eventStartsOn: string | null;
  eventEndsOn: string | null;
}

/** Reglas de consistencia (también las garantiza la base); errores por campo para el panel. */
export function assertPromotionRules(p: PromotionRulesInput): void {
  const errors: FieldErrors = [];
  if (p.ctaKind === 'tour' && !p.tourId) errors.push({ field: 'tourId', messages: ['Elige el paquete o tour al que lleva el botón.'] });
  if (p.ctaKind === 'page') {
    if (!p.ctaPath) errors.push({ field: 'ctaPath', messages: ['Indica la página del sitio (p. ej. /destinos/tours-en-puno).'] });
    else if (!PROMOTION_PATH.test(p.ctaPath) || p.ctaPath.startsWith('//')) {
      errors.push({ field: 'ctaPath', messages: ['Solo rutas internas en minúsculas que empiecen con «/» (sin http ni dominio).'] });
    }
  }
  if (p.startsAt && p.endsAt && p.endsAt <= p.startsAt) errors.push({ field: 'endsAt', messages: ['El fin de la difusión debe ser posterior al inicio.'] });
  if (p.eventStartsOn && p.eventEndsOn && p.eventEndsOn < p.eventStartsOn) {
    errors.push({ field: 'eventEndsOn', messages: ['El último día del evento no puede ser anterior al primero.'] });
  }
  if (errors.length) throw new ValidationError('validation-failed', 'Revisa los datos del evento.', { errors });
}
