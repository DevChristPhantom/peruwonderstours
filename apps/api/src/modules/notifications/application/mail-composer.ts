import type { PiiCipher } from '../../../shared/application/pii-cipher.js';
import type { TransactionalRepositories } from '../../../shared/application/unit-of-work.js';
import type { ClaimedOutboxEvent } from '../../../shared/domain/outbox.js';
import { complaintAad, COMPLAINT_LEGAL_NOTICES, formatSheetNumber, type ComplaintSnapshot } from '../../complaints/domain/complaint.js';
import { MAIL_EVENTS } from '../domain/mail-events.js';
import { MARKETING_PURPOSES, type MarketingPurpose } from '../../privacy/domain/consent.js';
import type { LinkPurpose } from '../../../shared/domain/access-grant.js';
import { contactAad } from '../../content/domain/content.js';
import {
  balanceReminderEmail,
  bookingAccessLinkEmail,
  complaintAccessLinkEmail,
  contactAcknowledgmentEmail,
  contactAgencyEmail,
  customerLoginLinkEmail,
  type MailLocale,
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
  /** Reply-To propio del correo (p. ej. aviso de contacto -> correo del cliente). */
  replyTo?: string;
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
  /**
   * Emite un enlace mágico de un solo uso AL ENVIAR (F0/F6/F7): guarda solo el hash en
   * `access_tokens` dentro de la transacción del armado y devuelve el token en claro.
   */
  issueLink(repos: TransactionalRepositories, params: { purpose: LinkPurpose; subjectId: string; locale: MailLocale; ttlMs: number }): Promise<string>;
  links: { requestedTtlMinutes: number; emailTtlHours: number };
  /** Bandeja de la agencia (formulario de contacto). */
  agencyInboxEmail: string;
}

function asLocale(value: unknown, fallback: MailLocale = 'es'): MailLocale {
  return value === 'en' || value === 'es' ? value : fallback;
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
      case MAIL_EVENTS.bookingAccessLinkRequested:
        return this.bookingAccessLink(repos, event);
      case MAIL_EVENTS.complaintAccessLinkRequested:
        return this.complaintAccessLink(repos, event);
      case MAIL_EVENTS.customerLoginLinkRequested:
        return this.customerLoginLink(repos, event);
      case MAIL_EVENTS.contactMessageReceived:
        return this.contactMessage(repos, event);
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

  /** URL de la web con el token del enlace en la query (nunca el accessToken de una sesión). */
  private linkUrl(locale: MailLocale, path: string, token: string): string {
    return `${this.ctx.brand.publicWebBaseUrl}/${locale}/${path}?token=${encodeURIComponent(token)}`;
  }

  private async bookingAccessLink(repos: TransactionalRepositories, event: ClaimedOutboxEvent): Promise<ComposeResult> {
    const booking = await repos.bookings.findById(str(event.payload['bookingId'], event.aggregateId));
    if (!booking) return { kind: 'skip', reason: 'reserva inexistente' };
    const s = booking.toSnapshot();
    const customer = await repos.customers.findById(s.customerId);
    if (!customer) return { kind: 'skip', reason: 'cliente inexistente' };
    const locale = asLocale(event.payload['locale'], s.locale);
    const ttlMinutes = this.ctx.links.requestedTtlMinutes;
    const token = await this.ctx.issueLink(repos, { purpose: 'booking_link', subjectId: booking.id, locale, ttlMs: ttlMinutes * 60_000 });
    const email = bookingAccessLinkEmail({ code: s.code, customerName: customer.firstName, linkUrl: this.linkUrl(locale, 'reserva/acceso', token), ttlMinutes, locale }, this.ctx.brand);
    return { kind: 'send', plan: { emails: [{ template: 'booking-access-link', to: [customer.email], ...email }] } };
  }

  private async complaintAccessLink(repos: TransactionalRepositories, event: ClaimedOutboxEvent): Promise<ComposeResult> {
    const c = await repos.complaints.findById(str(event.payload['complaintId'], event.aggregateId));
    if (!c) return { kind: 'skip', reason: 'hoja inexistente' };
    const locale = asLocale(event.payload['locale']);
    const ttlMinutes = this.ctx.links.requestedTtlMinutes;
    const token = await this.ctx.issueLink(repos, { purpose: 'complaint_link', subjectId: c.id, locale, ttlMs: ttlMinutes * 60_000 });
    const to = [...new Set([c.consumer.email, ...(c.guardian ? [c.guardian.email] : [])])];
    const email = complaintAccessLinkEmail(
      { code: c.code, consumerName: c.consumer.fullName, linkUrl: this.linkUrl(locale, 'libro-de-reclamaciones/consulta', token), ttlMinutes, locale },
      this.ctx.brand,
    );
    return { kind: 'send', plan: { emails: [{ template: 'complaint-access-link', to, ...email }] } };
  }

  private async customerLoginLink(repos: TransactionalRepositories, event: ClaimedOutboxEvent): Promise<ComposeResult> {
    const customer = await repos.customers.findById(str(event.payload['customerId'], event.aggregateId));
    if (!customer) return { kind: 'skip', reason: 'cliente inexistente' };
    const locale = asLocale(event.payload['locale'], customer.preferredLocale);
    const ttlMinutes = this.ctx.links.requestedTtlMinutes;
    const token = await this.ctx.issueLink(repos, { purpose: 'customer_login_link', subjectId: customer.id, locale, ttlMs: ttlMinutes * 60_000 });
    const email = customerLoginLinkEmail({ firstName: customer.firstName, linkUrl: this.linkUrl(locale, 'cuenta/acceso', token), ttlMinutes, locale }, this.ctx.brand);
    return { kind: 'send', plan: { emails: [{ template: 'customer-login-link', to: [customer.email], ...email }] } };
  }

  private async contactMessage(repos: TransactionalRepositories, event: ClaimedOutboxEvent): Promise<ComposeResult> {
    const m = await repos.contactMessages.findById(str(event.payload['contactMessageId'], event.aggregateId));
    if (!m) return { kind: 'skip', reason: 'mensaje inexistente' };
    const phone = m.phoneEnc ? this.ctx.cipher.decrypt(m.phoneEnc, contactAad(m.id)) : null;
    const agency = contactAgencyEmail(
      { id: m.id, name: m.name, email: m.email, phone, subject: m.subject, message: m.message, tourSlug: m.tourSlug, locale: m.locale, receivedAt: m.createdAt },
      this.ctx.brand,
    );
    return {
      kind: 'send',
      plan: {
        emails: [
          { template: 'contact-agency', to: [this.ctx.agencyInboxEmail], replyTo: m.email, ...agency },
          { template: 'contact-acknowledgment', to: [m.email], ...contactAcknowledgmentEmail({ name: m.name, subject: m.subject, locale: m.locale }, this.ctx.brand) },
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
      manageUrl: `${base}/${s.locale}/reserva`,
      linkTtlHours: this.ctx.links.emailTtlHours,
      unsubscribeUrl: await this.ctx.unsubscribeUrl(repos, customer.email),
      locale: s.locale,
    };
    // F0: los botones "Ver mi reserva"/"Pagar el saldo" llevan un enlace mágico de un solo uso generado
    // al enviar (nunca el accessToken de la sesión ni /reserva/CODE a secas).
    const withLink = async (): Promise<BookingMailData> => {
      const token = await this.ctx.issueLink(repos, { purpose: 'booking_link', subjectId: booking.id, locale: s.locale, ttlMs: this.ctx.links.emailTtlHours * 3_600_000 });
      return { ...data, manageUrl: this.linkUrl(s.locale, 'reserva/acceso', token) };
    };
    const to = [customer.email];
    switch (event.eventType) {
      case MAIL_EVENTS.bookingConfirmed:
        return { kind: 'send', plan: { emails: [{ template: 'booking-confirmation', to, ...bookingVoucherEmail(await withLink(), this.ctx.brand, 'confirmation') }] } };
      case MAIL_EVENTS.bookingVoucherRequested:
        if (!['confirmed', 'partially_paid', 'paid', 'completed'].includes(s.status)) return { kind: 'skip', reason: `voucher no disponible en estado ${s.status}` };
        return { kind: 'send', plan: { emails: [{ template: 'booking-voucher', to, ...bookingVoucherEmail(await withLink(), this.ctx.brand, 'voucher') }] } };
      case MAIL_EVENTS.bookingPaymentReceived: {
        const amount = BigInt(str(event.payload['amount'], '0'));
        return { kind: 'send', plan: { emails: [{ template: 'payment-received', to, ...paymentReceivedEmail({ ...(await withLink()), payment: { amount, currency: s.currency } }, this.ctx.brand) }] } };
      }
      case MAIL_EVENTS.bookingBalanceReminder: {
        // Idempotente también al enviar: si ya pagó o canceló, no se recuerda nada.
        if (s.status !== 'partially_paid' || data.balance.amount <= 0n) return { kind: 'skip', reason: 'saldo ya pagado o reserva no vigente' };
        const days = Number(event.payload['daysBefore'] ?? 7);
        return { kind: 'send', plan: { emails: [{ template: `balance-reminder-${days}d`, to, ...balanceReminderEmail(await withLink(), this.ctx.brand, days) }] } };
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
      // F7: la constancia enlaza a la página de consulta con un enlace mágico de un solo uso.
      const sheet = complaintSheetDocument(data, this.ctx.brand);
      const token = await this.ctx.issueLink(repos, { purpose: 'complaint_link', subjectId: c.id, locale: 'es', ttlMs: this.ctx.links.emailTtlHours * 3_600_000 });
      data.consultUrl = this.linkUrl('es', 'libro-de-reclamaciones/consulta', token);
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
      consultUrl: `${this.ctx.brand.publicWebBaseUrl}/es/libro-de-reclamaciones/consulta`,
    };
  }
}
