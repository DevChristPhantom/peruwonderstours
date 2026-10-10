import type { OutboxMessage } from '../../../shared/domain/outbox.js';
import type { IdGenerator } from '../../../shared/domain/ports.js';

/**
 * Eventos del outbox que generan correo transaccional. El payload NUNCA lleva datos
 * personales: solo identificadores; el relay carga y descifra al enviar.
 */
export const MAIL_EVENTS = {
  complaintSubmitted: 'complaint.submitted',
  complaintAnswered: 'complaint.answered',
  complaintSettlementOffered: 'complaint.settlement_offered',
  bookingConfirmed: 'booking.confirmed',
  bookingPaymentReceived: 'booking.payment_received',
  bookingVoucherRequested: 'booking.voucher_requested',
  bookingBalanceReminder: 'booking.balance_reminder',
  bookingCancelled: 'booking.cancelled',
  /** H-05: enlace del doble opt-in de marketing al correo del titular. */
  privacyMarketingConfirmation: 'privacy.marketing_confirmation',
  /** Sprint 3: enlaces mágicos (el token se genera al enviar; el payload nunca lleva secretos). */
  bookingAccessLinkRequested: 'booking.access_link_requested',
  complaintAccessLinkRequested: 'complaint.access_link_requested',
  customerLoginLinkRequested: 'customer.login_link_requested',
  /** F3: aviso a la agencia + acuse al remitente. */
  contactMessageReceived: 'contact.message_received',
} as const;

export type MailEventType = (typeof MAIL_EVENTS)[keyof typeof MAIL_EVENTS];

export function outboxMessage(
  ids: IdGenerator,
  params: { aggregateType: string; aggregateId: string; eventType: MailEventType; payload: Record<string, unknown>; now: Date; dedupeKey?: string },
): OutboxMessage {
  return {
    id: ids.next(),
    aggregateType: params.aggregateType,
    aggregateId: params.aggregateId,
    eventType: params.eventType,
    payload: params.payload,
    availableAt: params.now,
    createdAt: params.now,
    ...(params.dedupeKey ? { dedupeKey: params.dedupeKey } : {}),
  };
}
