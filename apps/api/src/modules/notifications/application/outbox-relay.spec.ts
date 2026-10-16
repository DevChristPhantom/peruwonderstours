import { issueAccessToken } from '../../../shared/application/access-grants.js';
import { BOOKING_SETTINGS, IDS } from '../../../../test/support/fixtures.js';
import { BookingUseCases } from '../../booking/application/booking.use-cases.js';
import { createHarness } from '../../../../test/support/harness.js';
import { AesGcmPiiCipher, DEVELOPMENT_PII_KEY_BASE64 } from '../../../shared/infrastructure/aes-gcm-pii-cipher.js';
import { ComplaintUseCases } from '../../complaints/application/complaint.use-cases.js';
import type { ComplaintDraft } from '../../complaints/domain/complaint.js';
import { PrivacyUseCases } from '../../privacy/application/privacy.use-cases.js';
import { MAIL_EVENTS } from '../domain/mail-events.js';
import { MemoryMailTransport } from '../infrastructure/mail-transports.js';
import { MailComposer } from './mail-composer.js';
import { BalanceReminderJob, OutboxRelay, retryDelaySeconds } from './outbox-relay.js';

const DRAFT: ComplaintDraft = {
  consumer: { fullName: 'Ana Quispe', docType: 'dni', docNumber: '45678912', address: 'Jr. Lima 123, Puno', phone: '+51987654321', email: 'ana@example.com', isMinor: false },
  guardian: null,
  good: { type: 'service', description: 'Tour Uros y Taquile', claimedAmount: 45_000n, currency: 'PEN' },
  declaredType: 'reclamo',
  detail: 'El tour no incluyó el almuerzo <b>ofrecido</b>.',
  consumerRequest: 'Devolución parcial.',
  responseChannel: 'email',
  conformityAccepted: true,
};

function setup() {
  const h = createHarness();
  const cipher = AesGcmPiiCipher.fromBase64(DEVELOPMENT_PII_KEY_BASE64);
  const complaints = new ComplaintUseCases(h.uow, h.clock, h.ids, cipher, {
    provider: { legalName: 'peruwonderstours E.I.R.L.', ruc: '20000000001', establishmentAddress: 'Jr. Lima 123, Puno', establishmentCode: 'WEB' },
    conformityTextVersion: 'c1',
    privacyNoticeVersion: 'p1',
    idempotencyTtlMinutes: 60,
  });
  const privacy = new PrivacyUseCases(h.uow, h.clock, h.ids, cipher, {
    marketingLinkSecret: 'unit-marketing-secret-0123456789-abcdef',
    marketingConsentVersion: 'm1',
    privacyNoticeVersion: 'p1',
    termsVersion: 't1',
    cancellationPolicyVersion: 'cp1',
    publicWebBaseUrl: 'https://pwt.test',
  });
  const transport = new MemoryMailTransport();
  const composer = new MailComposer({
    brand: { providerLegalName: 'peruwonderstours E.I.R.L.', providerRuc: '20000000001', contactEmail: 'reservas@pwt.test', contactPhone: '+51 999', publicWebBaseUrl: 'https://pwt.test' },
    cipher,
    unsubscribeUrl: (repos, email, locale) => privacy.unsubscribeUrlIfGranted(repos, email, locale),
    marketingConfirmationUrl: (email, purposes, locale) => privacy.buildConfirmationUrl(email, purposes, locale),
    issueLink: async (repos, p) => (await issueAccessToken(repos, h.ids, { ...p, now: h.clock.now() })).token,
    links: { requestedTtlMinutes: 30, emailTtlHours: 72 },
    agencyInboxEmail: 'agencia@pwt.test',
  });
  const relay = new OutboxRelay(h.uow, h.clock, h.ids, composer, transport, cipher, {
    batchSize: 10,
    maxAttempts: 3,
    leaseSeconds: 120,
    from: 'peruwonderstours <no-reply@pwt.test>',
    messageIdDomain: 'pwt.test',
  });
  const reminders = new BalanceReminderJob(h.uow, h.clock, h.ids);
  // Checkout con registro de aceptaciones legales y consentimientos (Consents v2).
  const bookings = new BookingUseCases(h.uow, h.clock, h.ids, h.carts, BOOKING_SETTINGS, privacy);
  return { h, complaints, privacy, transport, relay, reminders, bookings };
}

async function paidDepositBooking(ctx: ReturnType<typeof setup>) {
  const { h } = ctx;
  const cart = await h.cartWith([{ tourId: IDS.valle, travelDate: '2026-11-10' }]);
  const { booking, accessToken } = await ctx.bookings.checkout(h.checkoutInput(cart, 'checkout-key-mail1', { marketingEmailOptIn: true }));
  const access = { code: booking.code, token: accessToken };
  const intent = await h.payments.createPayment({ booking: access, idempotencyKey: 'pay-key-mail1' });
  await h.payments.confirmPayment(access, intent.payment.id, {});
  return { booking, access };
}

describe('Relay del outbox -> correo', () => {
  it('envía la constancia del Libro de Reclamaciones con la hoja adjunta y registra la entrega', async () => {
    const ctx = setup();
    const { complaint } = await ctx.complaints.submit({ draft: DRAFT, idempotencyKey: 'complaint-mail-001', ip: null });
    const run = await ctx.relay.runOnce();
    expect(run).toMatchObject({ claimed: 1, sent: 1, failed: 0 });
    const mail = ctx.transport.sent[0]!;
    expect(mail.to).toEqual(['ana@example.com']);
    expect(mail.template).toBe('complaint-acknowledgment');
    expect(mail.subject).toContain('000000001-2026');
    expect(mail.text).toContain('LR-2026-000001');
    expect(mail.text).toMatch(/7 de octubre de 2026 a las 10:00 \(hora de Lima\)/);
    expect(mail.text).toContain('29 de octubre de 2026');
    expect(mail.text).toContain('15 días hábiles, plazo improrrogable');
    expect(mail.html).toContain('&lt;b&gt;ofrecido&lt;/b&gt;'); // escapado
    expect(mail.attachments?.[0]?.filename).toBe('hoja-de-reclamacion-LR-2026-000001.html');
    expect(mail.messageId).toMatch(/^<.+\.complaint-acknowledgment@pwt\.test>$/);
    const stored = ctx.h.store.state.complaints.get(complaint.id)!;
    expect(stored.acknowledgmentSentAt).toEqual(ctx.h.clock.now());
    expect(stored.acknowledgmentDeliveryRef).toBe(mail.messageId);
    const event = [...ctx.h.store.state.outbox.values()][0]!;
    expect(event.publishedAt).not.toBeNull();
    // Idempotente: otra pasada no reenvía.
    expect(await ctx.relay.runOnce()).toMatchObject({ claimed: 0 });
    expect(ctx.transport.sent).toHaveLength(1);
  });

  it('reintenta con backoff exponencial y deja el evento "muerto" tras el máximo de intentos', async () => {
    const ctx = setup();
    await ctx.complaints.submit({ draft: DRAFT, idempotencyKey: 'complaint-mail-002', ip: null });
    ctx.transport.failNext = 10;
    expect(await ctx.relay.runOnce()).toMatchObject({ failed: 1 });
    const event = () => [...ctx.h.store.state.outbox.values()][0]!;
    expect(event()).toMatchObject({ attempts: 1, publishedAt: null });
    expect(event().lastError).toContain('451');
    expect(event().availableAt.getTime() - ctx.h.clock.now().getTime()).toBe(30_000);
    expect(await ctx.relay.runOnce()).toMatchObject({ claimed: 0 }); // todavía en espera
    ctx.h.clock.advanceMinutes(1);
    expect(await ctx.relay.runOnce()).toMatchObject({ failed: 1 });
    expect(event().attempts).toBe(2);
    ctx.h.clock.advanceMinutes(2);
    await ctx.relay.runOnce();
    expect(event().attempts).toBe(3);
    ctx.h.clock.advanceMinutes(60);
    expect(await ctx.relay.runOnce()).toMatchObject({ claimed: 0 }); // muerto (maxAttempts = 3)
    expect(await ctx.h.uow.run((r) => r.outboxQueue.stats(ctx.h.clock.now(), 3))).toEqual({ pending: 0, retrying: 0, dead: 1 });
    expect(retryDelaySeconds(1)).toBe(30);
    expect(retryDelaySeconds(4)).toBe(240);
    expect(retryDelaySeconds(20)).toBe(3600);
  });

  it('se recupera tras un fallo transitorio sin duplicar el correo', async () => {
    const ctx = setup();
    await ctx.complaints.submit({ draft: DRAFT, idempotencyKey: 'complaint-mail-003', ip: null });
    ctx.transport.failNext = 1;
    await ctx.relay.runOnce();
    ctx.h.clock.advanceMinutes(1);
    expect(await ctx.relay.runOnce()).toMatchObject({ sent: 1 });
    expect(ctx.transport.sent).toHaveLength(1);
  });

  it('no reenvía si la entrega ya quedó registrada (caída entre envío y publicación)', async () => {
    const ctx = setup();
    await ctx.complaints.submit({ draft: DRAFT, idempotencyKey: 'complaint-mail-004', ip: null });
    const event = [...ctx.h.store.state.outbox.values()][0]!;
    ctx.h.store.state.emailDeliveries.set(`${event.id}:complaint-acknowledgment`, {
      id: 'x', outboxEventId: event.id, template: 'complaint-acknowledgment', status: 'sent', messageId: '<previo@pwt.test>',
      recipientHash: new Uint8Array(32), transportRef: 'memory:0', sentAt: ctx.h.clock.now(),
    });
    expect(await ctx.relay.runOnce()).toMatchObject({ sent: 1 });
    expect(ctx.transport.sent).toHaveLength(0);
    expect(ctx.h.store.state.complaints.get(event.aggregateId)?.acknowledgmentDeliveryRef).toBe('<previo@pwt.test>');
  });

  it('confirmación + voucher al pagar el adelanto; el marketing queda pendiente del doble opt-in (H-05)', async () => {
    const ctx = setup();
    const { booking } = await paidDepositBooking(ctx);
    const events = [...ctx.h.store.state.outbox.values()];
    expect(events.map((e) => e.eventType)).toEqual([MAIL_EVENTS.privacyMarketingConfirmation, MAIL_EVENTS.bookingConfirmed]);
    await ctx.relay.runOnce();
    const optIn = ctx.transport.sent.find((m) => m.template === 'marketing-confirmation')!;
    expect(optIn.to).toEqual(['ana.quispe@example.com']);
    expect(optIn.text).toContain('https://pwt.test/es/privacidad/confirmar?token=');
    const mail = ctx.transport.sent.find((m) => m.template === 'booking-confirmation')!;
    expect(mail.to).toEqual(['ana.quispe@example.com']);
    expect(mail.text).toContain(booking.code);
    expect(mail.text).toContain('US$ 60.00'); // pagado (adelanto 50 % de 120.00)
    expect(mail.text).toContain('Saldo pendiente: US$ 60.00');
    // Sin confirmar, no hay consentimiento vigente: ningún enlace de baja (no hay nada de qué darse de baja).
    expect(mail.text).not.toContain('/es/privacidad/baja');
    expect(ctx.h.store.state.legalAcceptances.map((a) => a.document).sort()).toEqual(['cancellation_policy', 'privacy_policy_ack', 'terms_and_conditions']);
    expect(ctx.h.store.state.consents.map((c) => [c.purpose, c.granted, c.source])).toEqual([
      ['marketing_email', false, 'checkout_pending'],
      ['marketing_whatsapp', false, 'checkout'],
    ]);
  });

  it('doble opt-in: el enlace del correo activa el marketing; enlaces alterados, vencidos o de baja no sirven', async () => {
    const ctx = setup();
    await paidDepositBooking(ctx);
    await ctx.relay.runOnce();
    const link = ctx.transport.sent.find((m) => m.template === 'marketing-confirmation')!.text.match(/confirmar\?token=([^\s]+)/)![1]!;
    const token = decodeURIComponent(link);
    expect(await ctx.privacy.previewConfirmation(token)).toEqual({ purposes: [{ purpose: 'marketing_email', granted: false, pending: true }] });
    // Un enlace de baja no confirma (firmas con propósito distinto).
    await expect(ctx.privacy.confirmMarketing(ctx.privacy.buildUnsubscribeToken('ana.quispe@example.com'), { ip: null, userAgent: null })).rejects.toMatchObject({ code: 'invalid-confirmation-link' });
    expect(await ctx.privacy.confirmMarketing(token, { ip: '203.0.113.5', userAgent: 'x' })).toEqual({ confirmed: ['marketing_email'], alreadyConfirmed: [], notPending: [] });
    expect(await ctx.privacy.confirmMarketing(token, { ip: null, userAgent: null })).toEqual({ confirmed: [], alreadyConfirmed: ['marketing_email'], notPending: [] });
    expect(ctx.h.store.state.consents.at(-1)).toMatchObject({ purpose: 'marketing_email', granted: true, method: 'email_link', source: 'double_opt_in' });
    expect(await ctx.h.uow.run((r) => ctx.privacy.unsubscribeUrlIfGranted(r, 'ana.quispe@example.com'))).toContain('/es/privacidad/baja?token=');
    // Vencido a los 7 días.
    ctx.h.clock.advanceMinutes(8 * 24 * 60);
    await expect(ctx.privacy.previewConfirmation(token)).rejects.toMatchObject({ code: 'invalid-confirmation-link' });
  });

  it('recordatorios de saldo 7 y 2 días antes: una sola vez cada uno y nada si ya pagó', async () => {
    const ctx = setup();
    const { booking } = await paidDepositBooking(ctx);
    await ctx.relay.runOnce();
    const dueAt = booking.toSnapshot().balanceDueAt!;
    // 10 días antes: nada.
    ctx.h.clock.set(new Date(dueAt.getTime() - 10 * 86_400_000));
    expect(await ctx.reminders.runOnce()).toEqual({ enqueued: 0 });
    // 6 días antes: recordatorio de 7 días; repetir el job no duplica.
    ctx.h.clock.set(new Date(dueAt.getTime() - 6 * 86_400_000));
    expect(await ctx.reminders.runOnce()).toEqual({ enqueued: 1 });
    expect(await ctx.reminders.runOnce()).toEqual({ enqueued: 0 });
    await ctx.relay.runOnce();
    expect(ctx.transport.sent.at(-1)?.template).toBe('balance-reminder-7d');
    // 1 día antes: recordatorio de 2 días.
    ctx.h.clock.set(new Date(dueAt.getTime() - 86_400_000));
    expect(await ctx.reminders.runOnce()).toEqual({ enqueued: 1 });
    expect(await ctx.reminders.runOnce()).toEqual({ enqueued: 0 });
    await ctx.relay.runOnce();
    expect(ctx.transport.sent.at(-1)?.template).toBe('balance-reminder-2d');
    expect(ctx.transport.sent.at(-1)?.text).toContain('menos de 2 días');
  });

  it('un recordatorio encolado no se envía si el saldo ya se pagó', async () => {
    const ctx = setup();
    const { booking, access } = await paidDepositBooking(ctx);
    await ctx.relay.runOnce();
    const dueAt = booking.toSnapshot().balanceDueAt!;
    ctx.h.clock.set(new Date(dueAt.getTime() - 3 * 86_400_000));
    await ctx.reminders.runOnce();
    const balance = await ctx.h.payments.createPayment({ booking: access, idempotencyKey: 'pay-key-mail2' });
    await ctx.h.payments.confirmPayment(access, balance.payment.id, {});
    const before = ctx.transport.sent.length;
    const run = await ctx.relay.runOnce();
    expect(run.skipped).toBe(1); // recordatorio omitido
    expect(ctx.transport.sent.slice(before).map((m) => m.template)).toEqual(['payment-received']);
  });

  it('baja de marketing por enlace firmado: revoca, es idempotente y rechaza enlaces alterados', async () => {
    const ctx = setup();
    await paidDepositBooking(ctx);
    // Primero el titular confirma el doble opt-in.
    await ctx.privacy.confirmMarketing(ctx.privacy.buildConfirmationUrl('ana.quispe@example.com', ['marketing_email']).split('token=')[1]!.replace(/%2E/g, '.'), { ip: null, userAgent: null });
    const token = ctx.privacy.buildUnsubscribeToken('ANA.QUISPE@example.com');
    expect(await ctx.privacy.previewUnsubscribe(token)).toEqual({
      purposes: [
        { purpose: 'marketing_email', granted: true },
        { purpose: 'marketing_whatsapp', granted: false },
      ],
    });
    expect(await ctx.privacy.unsubscribe(token, undefined, { ip: '203.0.113.9', userAgent: 'x' })).toEqual({ revoked: ['marketing_email'], alreadyRevoked: ['marketing_whatsapp'] });
    expect(await ctx.privacy.unsubscribe(token, ['marketing_email'], { ip: null, userAgent: null })).toEqual({ revoked: [], alreadyRevoked: ['marketing_email'] });
    const revocation = ctx.h.store.state.consents.at(-1)!;
    expect(revocation).toMatchObject({ purpose: 'marketing_email', granted: false, method: 'email_link', source: 'unsubscribe_link' });
    await expect(ctx.privacy.unsubscribe(`${token.slice(0, -3)}abc`, undefined, { ip: null, userAgent: null })).rejects.toMatchObject({ code: 'invalid-unsubscribe-link' });
    // Sin consentimiento vigente, los correos ya no llevan enlace de baja.
    expect(await ctx.h.uow.run((r) => ctx.privacy.unsubscribeUrlIfGranted(r, 'ana.quispe@example.com'))).toBeNull();
  });

  it('H-17: una hoja se vincula a la reserva solo con su token o el mismo correo; si no, queda como código declarado', async () => {
    const ctx = setup();
    const { booking, access } = await paidDepositBooking(ctx);
    const submit = (key: string, extra: Record<string, unknown>, email = 'ana@example.com') =>
      ctx.complaints.submit({ draft: { ...DRAFT, consumer: { ...DRAFT.consumer, email } }, idempotencyKey: key, ip: null, bookingCode: booking.code, ...extra });
    const stranger = await submit('complaint-h17-001', {});
    expect(stranger.complaint).toMatchObject({ bookingId: null, declaredBookingCode: booking.code });
    const wrongToken = await submit('complaint-h17-002', { bookingToken: 'A'.repeat(43) });
    expect(wrongToken.complaint.bookingId).toBeNull();
    const withToken = await submit('complaint-h17-003', { bookingToken: access.token });
    expect(withToken.complaint).toMatchObject({ bookingId: booking.id, declaredBookingCode: null });
    const sameEmail = await submit('complaint-h17-004', {}, 'Ana.Quispe@Example.com');
    expect(sameEmail.complaint).toMatchObject({ bookingId: booking.id, declaredBookingCode: null });
    const unknown = await ctx.complaints.submit({ draft: DRAFT, idempotencyKey: 'complaint-h17-005', ip: null, bookingCode: 'PWT-2099-999999' });
    expect(unknown.complaint).toMatchObject({ bookingId: null, declaredBookingCode: 'PWT-2099-999999' });
    // H-19: PII de la hoja cifrada con AAD (v2) y legible por su titular.
    expect(stranger.complaint.consumer.docEnc[0]).toBe(0x02);
    const view = await ctx.complaints.getByCode({ code: stranger.complaint.code, token: stranger.accessToken });
    expect(view.consumerDocNumber).toBe('45678912');
  });
});

describe('Portuguese notification routing integration (memory only)', () => {
  it('uses Portuguese consent request language for an existing Spanish customer without overwriting their preference', async () => {
    const ctx = setup();
    const priorCart = await ctx.h.cartWith([{ tourId: IDS.valle, travelDate: '2026-11-10' }]);
    const prior = await ctx.bookings.checkout(ctx.h.checkoutInput(priorCart, 'existing-es-customer', { locale: 'es', marketingEmailOptIn: false }));
    const currentCart = await ctx.h.cartWith([{ tourId: IDS.valle, travelDate: '2026-11-10' }]);
    const current = await ctx.bookings.checkout(ctx.h.checkoutInput(currentCart, 'existing-es-customer-pt-optin', { locale: 'pt', marketingEmailOptIn: true }));
    expect(current.booking.toSnapshot().customerId).toBe(prior.booking.toSnapshot().customerId);
    const customer = await ctx.h.uow.run((repos) => repos.customers.findById(current.booking.toSnapshot().customerId));
    expect(customer?.preferredLocale).toBe('es');
    const request = [...ctx.h.store.state.outbox.values()].find((event) => event.eventType === MAIL_EVENTS.privacyMarketingConfirmation);
    expect(request?.payload).toMatchObject({ locale: 'pt', purposes: ['marketing_email'] });
    await ctx.relay.runOnce();
    const mail = ctx.transport.sent.find((message) => message.subject.includes('Confirme sua inscrição'));
    expect(mail).toBeDefined();
    expect(mail?.html).toContain('<html lang="pt-BR">');
    expect(mail?.text).toContain('/pt/privacidade/confirmar?token=');
    expect(mail?.text).not.toContain('/es/privacidad/confirmar');
    expect((await ctx.h.uow.run((repos) => repos.customers.findById(current.booking.toSnapshot().customerId)))?.preferredLocale).toBe('es');
  });
  it('persists booking locale pt and sends exact Portuguese access/voucher and consent links', async () => {
    const ctx = setup();
    const cart = await ctx.h.cartWith([{ tourId: IDS.valle, travelDate: '2026-11-10' }]);
    const { booking, accessToken } = await ctx.bookings.checkout(ctx.h.checkoutInput(cart, 'checkout-pt-notifications', { locale: 'pt', marketingEmailOptIn: true }));
    expect(booking.toSnapshot().locale).toBe('pt');
    const access = { code: booking.code, token: accessToken };
    const intent = await ctx.h.payments.createPayment({ booking: access, idempotencyKey: 'payment-pt-notifications' });
    await ctx.h.payments.confirmPayment(access, intent.payment.id, {});
    await ctx.relay.runOnce();
    const emails = ctx.transport.sent.map((mail) => mail.text).join('\n');
    expect(emails).toContain('/pt/reserva/acesso?token=');
    expect(emails).toContain('/pt/privacidade/confirmar?token=');
    expect(emails).toContain('Confirme sua inscrição');
    expect(emails).not.toContain('/pt/reserva/acceso');
    expect(ctx.privacy.buildUnsubscribeUrl('ana@example.com', 'pt')).toContain('/pt/privacidade/cancelar-inscricao?token=');
  });
});
