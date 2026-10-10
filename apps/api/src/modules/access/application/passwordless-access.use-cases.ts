import {
  DAY_MS,
  HOUR_MS,
  issueAccessToken,
  redeemAccessLink,
  resolveSession,
  type AccessSettings,
} from '../../../shared/application/access-grants.js';
import { hashAccessToken, isWellFormedAccessToken } from '../../../shared/application/access-token.js';
import type { TransactionalRepositories, UnitOfWork } from '../../../shared/application/unit-of-work.js';
import { AccessLinkNotFoundError } from '../../../shared/domain/access-grant.js';
import { UnauthorizedError } from '../../../shared/domain/domain-error.js';
import type { ContentLocale } from '../../../shared/domain/i18n.js';
import type { Clock, IdGenerator } from '../../../shared/domain/ports.js';
import { BOOKING_CODE_PATTERN, BookingAccessNotFoundError } from '../../booking/application/booking-access.js';
import type { Booking } from '../../booking/domain/booking.js';
import { COMPLAINT_CODE_PATTERN } from '../../complaints/domain/complaint.js';
import type { Customer } from '../../customers/domain/customer.js';
import { MAIL_EVENTS, outboxMessage, type MailEventType } from '../../notifications/domain/mail-events.js';

export class CustomerSessionRequiredError extends UnauthorizedError {
  constructor() {
    super('customer-session-required', 'Inicia sesión con el enlace que te enviamos por correo.');
  }
}

function sameEmail(a: string, b: string): boolean {
  return a.trim().toLowerCase() === b.trim().toLowerCase();
}

export interface CustomerSession {
  customer: Customer;
  sessionId: string;
  expiresAt: Date;
}

/**
 * Acceso sin contraseña (Sprint 3):
 *  - F0/F0b: "recuperar mi reserva" (código + correo -> enlace de un solo uso -> sesión de reserva).
 *  - F7: consulta de la hoja de reclamación con el mismo esquema.
 *  - F6: "Mis reservas" (correo -> enlace -> sesión de cliente revocable).
 * Las solicitudes de enlace SIEMPRE terminan igual (202 genérico): no revelan si el código o el
 * correo existen. El token se genera al enviar el correo (outbox), nunca viaja en el payload.
 */
export class PasswordlessAccessUseCases {
  constructor(
    private readonly uow: UnitOfWork,
    private readonly clock: Clock,
    private readonly ids: IdGenerator,
    private readonly settings: AccessSettings,
  ) {}

  /** Encola el correo salvo que el sujeto ya superó el tope por hora (o pidió otro hace < 1 min). */
  private async enqueue(
    repos: TransactionalRepositories,
    params: { aggregateType: string; subjectId: string; eventType: MailEventType; linkPurpose: 'booking_link' | 'complaint_link' | 'customer_login_link'; payload: Record<string, unknown>; now: Date },
  ): Promise<void> {
    const recent = await repos.accessTokens.countCreatedSince(params.subjectId, params.linkPurpose, new Date(params.now.getTime() - HOUR_MS));
    if (recent >= this.settings.maxLinksPerHour) return;
    await repos.outbox.addIfAbsent({
      ...outboxMessage(this.ids, { aggregateType: params.aggregateType, aggregateId: params.subjectId, eventType: params.eventType, payload: params.payload, now: params.now }),
      dedupeKey: `${params.linkPurpose}:${params.subjectId}:${Math.floor(params.now.getTime() / 60_000)}`,
    });
  }

  // ---------------------------------------------------------------------------
  // Reservas (F0 / F0b)
  // ---------------------------------------------------------------------------
  async requestBookingLink(input: { code: string; email: string; locale?: ContentLocale }): Promise<void> {
    const code = input.code.trim().toUpperCase();
    await this.uow.run(async (repos) => {
      const now = this.clock.now();
      const booking = BOOKING_CODE_PATTERN.test(code) ? await repos.bookings.findByCode(code) : null;
      const customer = booking ? await repos.customers.findById(booking.toSnapshot().customerId) : null;
      if (!booking || !customer || !sameEmail(customer.email, input.email)) return;
      await this.enqueue(repos, {
        aggregateType: 'booking',
        subjectId: booking.id,
        eventType: MAIL_EVENTS.bookingAccessLinkRequested,
        linkPurpose: 'booking_link',
        payload: { bookingId: booking.id, locale: input.locale ?? booking.toSnapshot().locale },
        now,
      });
    });
  }

  /** Canjea el enlace: emite un accessToken NUEVO de la reserva (X-Booking-Token). Reuso: 410. */
  exchangeBookingLink(token: string): Promise<{ code: string; accessToken: string; expiresAt: Date; locale: ContentLocale }> {
    return this.uow.run(async (repos) => {
      const now = this.clock.now();
      const { link, session } = await redeemAccessLink(repos, this.ids, { token, purpose: 'booking_link', sessionTtlMs: this.settings.resourceSessionTtlDays * DAY_MS, now });
      const booking = await repos.bookings.findById(link.subjectId);
      if (!booking) throw new BookingAccessNotFoundError();
      return { code: booking.code, accessToken: session.token, expiresAt: session.record.expiresAt, locale: link.locale };
    });
  }

  // ---------------------------------------------------------------------------
  // Libro de Reclamaciones (F7)
  // ---------------------------------------------------------------------------
  async requestComplaintLink(input: { code: string; email: string; locale?: ContentLocale }): Promise<void> {
    const code = input.code.trim().toUpperCase();
    await this.uow.run(async (repos) => {
      const now = this.clock.now();
      const complaint = COMPLAINT_CODE_PATTERN.test(code) ? await repos.complaints.findByCode(code) : null;
      if (!complaint) return;
      const owner = sameEmail(complaint.consumer.email, input.email) || (complaint.guardian !== null && sameEmail(complaint.guardian.email, input.email));
      if (!owner) return;
      await this.enqueue(repos, {
        aggregateType: 'complaint',
        subjectId: complaint.id,
        eventType: MAIL_EVENTS.complaintAccessLinkRequested,
        linkPurpose: 'complaint_link',
        payload: { complaintId: complaint.id, locale: input.locale ?? 'es' },
        now,
      });
    });
  }

  exchangeComplaintLink(token: string): Promise<{ code: string; accessToken: string; expiresAt: Date; locale: ContentLocale }> {
    return this.uow.run(async (repos) => {
      const now = this.clock.now();
      const { link, session } = await redeemAccessLink(repos, this.ids, { token, purpose: 'complaint_link', sessionTtlMs: this.settings.resourceSessionTtlDays * DAY_MS, now });
      const complaint = await repos.complaints.findById(link.subjectId);
      if (!complaint) throw new AccessLinkNotFoundError();
      return { code: complaint.code, accessToken: session.token, expiresAt: session.record.expiresAt, locale: link.locale };
    });
  }

  // ---------------------------------------------------------------------------
  // Cuenta de cliente "Mis reservas" (F6)
  // ---------------------------------------------------------------------------
  async requestCustomerLink(input: { email: string; locale?: ContentLocale }): Promise<void> {
    await this.uow.run(async (repos) => {
      const now = this.clock.now();
      const customer = await repos.customers.findByEmail(input.email.trim().toLowerCase());
      if (!customer) return;
      await this.enqueue(repos, {
        aggregateType: 'customer',
        subjectId: customer.id,
        eventType: MAIL_EVENTS.customerLoginLinkRequested,
        linkPurpose: 'customer_login_link',
        payload: { customerId: customer.id, locale: input.locale ?? customer.preferredLocale },
        now,
      });
    });
  }

  exchangeCustomerLink(token: string): Promise<{ sessionToken: string; expiresAt: Date; customer: Customer }> {
    return this.uow.run(async (repos) => {
      const now = this.clock.now();
      const { link, session } = await redeemAccessLink(repos, this.ids, { token, purpose: 'customer_login_link', sessionTtlMs: this.settings.customerSessionTtlDays * DAY_MS, now });
      const customer = await repos.customers.findById(link.subjectId);
      if (!customer) throw new CustomerSessionRequiredError();
      return { sessionToken: session.token, expiresAt: session.record.expiresAt, customer };
    });
  }

  /** Sesión de cliente válida (o 401 `customer-session-required`). */
  authenticate(token: string | undefined): Promise<CustomerSession> {
    return this.uow.run(async (repos) => {
      const now = this.clock.now();
      const record = await resolveSession(repos, { token, purpose: 'customer_session', now });
      const customer = record ? await repos.customers.findById(record.subjectId) : null;
      if (!record || !customer) throw new CustomerSessionRequiredError();
      await repos.accessTokens.touch(record.id, now);
      return { customer, sessionId: record.id, expiresAt: record.expiresAt };
    });
  }

  myBookings(session: CustomerSession, limit = 50): Promise<Booking[]> {
    return this.uow.run((repos) => repos.bookings.findByCustomer(session.customer.id, limit));
  }

  /** Desde "Mis reservas": token de acceso a una reserva propia para reutilizar la página de reserva. */
  grantBookingAccess(session: CustomerSession, code: string): Promise<{ code: string; accessToken: string; expiresAt: Date }> {
    return this.uow.run(async (repos) => {
      const now = this.clock.now();
      const normalized = code.trim().toUpperCase();
      const booking = BOOKING_CODE_PATTERN.test(normalized) ? await repos.bookings.findByCode(normalized) : null;
      if (!booking || booking.toSnapshot().customerId !== session.customer.id) throw new BookingAccessNotFoundError();
      const issued = await issueAccessToken(repos, this.ids, {
        purpose: 'booking_session',
        subjectId: booking.id,
        locale: booking.toSnapshot().locale,
        ttlMs: this.settings.resourceSessionTtlDays * DAY_MS,
        now,
      });
      return { code: booking.code, accessToken: issued.token, expiresAt: issued.record.expiresAt };
    });
  }

  /** Cierra la sesión actual (o todas las del cliente). */
  logout(token: string | undefined, all = false): Promise<void> {
    return this.uow.run(async (repos) => {
      const now = this.clock.now();
      if (!isWellFormedAccessToken(token)) return;
      const record = await repos.accessTokens.findByHash(hashAccessToken(token));
      if (!record || record.purpose !== 'customer_session') return;
      if (all) await repos.accessTokens.revokeAllForSubject(record.subjectId, 'customer_session', now);
      else await repos.accessTokens.revoke(record.id, now);
    });
  }
}
