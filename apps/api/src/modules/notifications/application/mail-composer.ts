import type { PiiCipher } from '../../../shared/application/pii-cipher.js';
import type { TransactionalRepositories } from '../../../shared/application/unit-of-work.js';
import type { ClaimedOutboxEvent } from '../../../shared/domain/outbox.js';
import { complaintAad, COMPLAINT_LEGAL_NOTICES, formatSheetNumber, type ComplaintSnapshot } from '../../complaints/domain/complaint.js';
import { MAIL_EVENTS } from '../domain/mail-events.js';
import { MARKETING_PURPOSES, type MarketingPurpose } from '../../privacy/domain/consent.js';
import {
  balanceReminderEmail,
  bookingCancelledEmail,
  bookingVoucherEmail,
  complaintAcknowledgmentEmail,
  complaintResponseEmail,
  complaintSettlementOfferEmail,
  complaintSheetDocument,
  marketingConfirmationEmail,
  paymentReceivedEmail,
  type BookingMailData,
  type BrandInfo,
  type ComplaintMailData,
  type RenderedEmail,
} from '../domain/templates.js';

/** Valor de payload como texto (string o número); si no, el valor por defecto. */
function str(value: unknown, fallback: string): string {
  return typeof value === 'string' ? value : typeof value === 'number' || typeof value === 'bigint' ? value.toString() : fallback;
}

export interface MailDraft extends RenderedEmail {
  template: string;
  to: string[];
  attachments?: Array<{ filename: string; content: string; contentType: string }>;
}

export interface MailPlan {
  emails: MailDraft[];
  /** Efectos al entregar (misma transacción que marca el evento como publicado). */
  after?: (repos: TransactionalRepositories, sentAt: Date, messageIds: Record<string, string>) => Promise<void>;
}

export type ComposeResult = { kind: 'send'; plan: MailPlan } | { kind: 'skip'; reason: string };

export interface ComposerContext {
  brand: BrandInfo;
  cipher: PiiCipher;
  /** URL de baja de marketing si el titular tiene `marketing_email` otorgado; null si no. */
  unsubscribeUrl(repos: TransactionalRepositories, email: string): Promise<string | null>;
  /** Enlace firmado del doble opt-in (H-05). */
  marketingConfirmationUrl(email: string, purposes: MarketingPurpose[]): string;
}

/**
 * Arma los correos de cada evento del outbox cargando los datos de la base (el payload solo
 * trae identificadores). Funciones de lectura: no modifican nada.
 */
export class MailComposer {
  constructor(private readonly ctx: ComposerContext) {}

  async compose(event: ClaimedOutboxEvent, repos: TransactionalRepositories): Promise<ComposeResult> {
    const p = event.payload;
    switch (event.eventType) {
      case MAIL_EVENTS.complaintSubmitted:
        return this.complaint(repos, str(p['complaintId'], event.aggregateId), 'ack');
      case MAIL_EVENTS.complaintAnswered:
        return this.complaint(repos, str(p['complaintId'], event.aggregateId), 'response');
      case MAIL_EVENTS.complaintSettlementOffered:
        return this.complaint(repos, str(p['complaintId'], event.aggregateId), 'settlement');
      case MAIL_EVENTS.bookingConfirmed:
      case MAIL_EVENTS.bookingVoucherRequested:
      case MAIL_EVENTS.bookingPaymentReceived:
      case MAIL_EVENTS.bookingBalanceReminder:
      case MAIL_EVENTS.bookingCancelled:
        return this.booking(repos, event);
      case MAIL_EVENTS.privacyMarketingConfirmation:
        return this.marketingConfirmation(repos, event);
      default:
        return { kind: 'skip', reason: `sin plantilla para ${event.eventType}` };
    }
  }

  private async marketingConfirmation(repos: TransactionalRepositories, event: ClaimedOutboxEvent): Promise<ComposeResult> {
    const customer = await repos.customers.findById(str(event.payload['customerId'], event.aggregateId));
    if (!customer) return { kind: 'skip', reason: 'cliente inexistente' };
    const raw = Array.isArray(event.payload['purposes']) ? (event.payload['purposes'] as unknown[]) : [];
    const purposes = raw.filter((p): p is MarketingPurpose => (MARKETING_PURPOSES as readonly unknown[]).includes(p));
    if (purposes.length === 0) return { kind: 'skip', reason: 'sin finalidades' };
    return {
      kind: 'send',
      plan: {
        emails: [
          {
            template: 'marketing-confirmation',
            to: [customer.email],
            ...marketingConfirmationEmail({ firstName: customer.firstName, purposes, confirmUrl: this.ctx.marketingConfirmationUrl(customer.email, purposes) }, this.ctx.brand),
          },
        ],
      },
    };
  }

  // ---------------------------------------------------------------------------
  private async booking(repos: TransactionalRepositories, event: ClaimedOutboxEvent): Promise<ComposeResult> {
    const bookingId = str(event.payload['bookingId'], event.aggregateId);
    const booking = await repos.bookings.findById(bookingId);
    if (!booking) return { kind: 'skip', reason: 'reserva inexistente' };
    const s = booking.toSnapshot();
    const customer = await repos.customers.findById(s.customerId);
    if (!customer) return { kind: 'skip', reason: 'cliente inexistente' };
    const base = this.ctx.brand.publicWebBaseUrl;
    const data: BookingMailData = {
      code: s.code,
      customerName: customer.firstName,
      status: s.status,
      paymentOption: s.paymentOption,
      items: s.items.map((i) => ({ title: i.tourTitle, travelDate: i.travelDate, paxCount: i.paxCount, subtotal: { amount: i.subtotalAmount, currency: i.currency } })),
      total: { amount: s.totalAmount, currency: s.currency },
      paid: { amount: s.paidAmount, currency: s.currency },
      balance: { amount: s.totalAmount - s.paidAmount, currency: s.currency },
      balanceDueAt: s.balanceDueAt,
      manageUrl: `${base}/es/reserva/${encodeURIComponent(s.code)}`,
      unsubscribeUrl: await this.ctx.unsubscribeUrl(repos, customer.email),
    };
    const to = [customer.email];
    switch (event.eventType) {
      case MAIL_EVENTS.bookingConfirmed:
        return { kind: 'send', plan: { emails: [{ template: 'booking-confirmation', to, ...bookingVoucherEmail(data, this.ctx.brand, 'confirmation') }] } };
      case MAIL_EVENTS.bookingVoucherRequested:
        if (!['confirmed', 'partially_paid', 'paid', 'completed'].includes(s.status)) return { kind: 'skip', reason: `voucher no disponible en estado ${s.status}` };
        return { kind: 'send', plan: { emails: [{ template: 'booking-voucher', to, ...bookingVoucherEmail(data, this.ctx.brand, 'voucher') }] } };
      case MAIL_EVENTS.bookingPaymentReceived: {
        const amount = BigInt(str(event.payload['amount'], '0'));
        return { kind: 'send', plan: { emails: [{ template: 'payment-received', to, ...paymentReceivedEmail({ ...data, payment: { amount, currency: s.currency } }, this.ctx.brand) }] } };
      }
      case MAIL_EVENTS.bookingBalanceReminder: {
        // Idempotente también al enviar: si ya pagó o canceló, no se recuerda nada.
        if (s.status !== 'partially_paid' || data.balance.amount <= 0n) return { kind: 'skip', reason: 'saldo ya pagado o reserva no vigente' };
        const days = Number(event.payload['daysBefore'] ?? 7);
        return { kind: 'send', plan: { emails: [{ template: `balance-reminder-${days}d`, to, ...balanceReminderEmail(data, this.ctx.brand, days) }] } };
      }
      case MAIL_EVENTS.bookingCancelled: {
        const refundDue = BigInt(str(event.payload['refundDueAmount'], String(s.refundDueAmount ?? 0n)));
        return {
          kind: 'send',
          plan: { emails: [{ template: 'booking-cancelled', to, ...bookingCancelledEmail({ ...data, unsubscribeUrl: null, refundDue: { amount: refundDue, currency: s.currency }, reason: s.cancellationReason }, this.ctx.brand) }] },
        };
      }
      default:
        return { kind: 'skip', reason: 'evento de reserva desconocido' };
    }
  }

  private async complaint(repos: TransactionalRepositories, complaintId: string, kind: 'ack' | 'response' | 'settlement'): Promise<ComposeResult> {
    const c = await repos.complaints.findById(complaintId);
    if (!c) return { kind: 'skip', reason: 'hoja inexistente' };
    const data = this.complaintData(c);
    const to = [...new Set([c.consumer.email, ...(c.guardian ? [c.guardian.email] : [])])];
    if (kind === 'ack') {
      const sheet = complaintSheetDocument(data, this.ctx.brand);
      return {
        kind: 'send',
        plan: {
          emails: [
            {
              template: 'complaint-acknowledgment',
              to,
              ...complaintAcknowledgmentEmail(data, this.ctx.brand),
              // PDF pendiente (sin librería de PDF): se adjunta la hoja imprimible en HTML.
              attachments: [{ filename: `hoja-de-reclamacion-${c.code}.html`, content: sheet, contentType: 'text/html; charset=utf-8' }],
            },
          ],
          after: (r, sentAt, ids) => r.complaints.markAcknowledgmentSent(c.id, sentAt, ids['complaint-acknowledgment'] ?? ''),
        },
      };
    }
    if (kind === 'response') {
      if (!c.responseText) return { kind: 'skip', reason: 'hoja sin respuesta' };
      return {
        kind: 'send',
        plan: {
          emails: [{ template: 'complaint-response', to, ...complaintResponseEmail({ ...data, responseText: c.responseText, respondedAt: c.respondedAt ?? new Date() }, this.ctx.brand) }],
          // Canal correo: la entrega es la comunicación formal (fecha del Anexo I). Canal carta: ya la registró el staff.
          after: c.responseChannel === 'email' ? (r, sentAt, ids) => r.complaints.markResponseSent(c.id, sentAt, ids['complaint-response'] ?? '') : undefined,
        },
      };
    }
    if (!c.settlementOfferText || !c.settlementExpiresAt) return { kind: 'skip', reason: 'hoja sin oferta de solución' };
    return {
      kind: 'send',
      plan: {
        emails: [
          { template: 'complaint-settlement-offer', to, ...complaintSettlementOfferEmail({ ...data, offerText: c.settlementOfferText, expiresAt: c.settlementExpiresAt }, this.ctx.brand) },
        ],
      },
    };
  }

  private complaintData(c: ComplaintSnapshot): ComplaintMailData {
    const cipher = this.ctx.cipher;
    return {
      code: c.code,
      sheetNumber: formatSheetNumber(c.year, c.sequence),
      submittedAt: c.submittedAt,
      responseDueAt: c.responseDueAt,
      channel: c.channel,
      backupSheetNumber: c.backupSheetNumber ?? null,
      provider: { ...c.provider },
      consumer: {
        fullName: c.consumer.fullName,
        docType: c.consumer.docType,
        docNumber: cipher.decrypt(c.consumer.docEnc, complaintAad(c.id, 'consumer_doc_enc')),
        address: c.consumer.address,
        phone: c.consumer.phoneEnc ? cipher.decrypt(c.consumer.phoneEnc, complaintAad(c.id, 'consumer_phone_enc')) : null,
        email: c.consumer.email,
        isMinor: c.consumer.isMinor,
      },
      guardian: c.guardian ? { fullName: c.guardian.fullName, address: c.guardian.address, phone: cipher.decrypt(c.guardian.phoneEnc, complaintAad(c.id, 'guardian_phone_enc')), email: c.guardian.email } : null,
      good: { type: c.good.type, description: c.good.description, claimedAmount: c.good.claimedAmount !== null && c.good.currency ? { amount: c.good.claimedAmount, currency: c.good.currency } : null },
      declaredType: c.declaredType,
      type: c.type,
      detail: c.detail,
      consumerRequest: c.consumerRequest,
      responseChannel: c.responseChannel,
      legalNotices: COMPLAINT_LEGAL_NOTICES,
      consultUrl: `${this.ctx.brand.publicWebBaseUrl}/es/libro-de-reclamaciones`,
    };
  }
}
