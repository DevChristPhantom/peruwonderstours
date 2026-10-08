import { randomUUID } from 'node:crypto';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { generate } from 'otplib';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import type { PrismaClient } from '../src/generated/prisma/client.js';
import type { OutboxRelay as OutboxRelayType, BalanceReminderJob as BalanceReminderJobType } from '../src/modules/notifications/application/outbox-relay.js';
import type { MemoryMailTransport } from '../src/modules/notifications/infrastructure/mail-transports.js';
import type { PrivacyUseCases as PrivacyUseCasesType } from '../src/modules/privacy/application/privacy.use-cases.js';
import { addDays, toLimaCalendarDate } from '../src/shared/domain/calendar-date.js';
import { testDatabaseUrl } from './support/test-database.js';

const url = testDatabaseUrl();
const describeDb = url ? describe : describe.skip;
const PASSWORD = 'Lago-Titicaca#Uros-77';

/**
 * Backoffice + auth contra PostgreSQL real (`pwt_test`, recreada por globalSetup): HTTP completo
 * en modo prisma. Flujo encadenado (los casos comparten estado y van en orden).
 */
describeDb('Backoffice /admin y /auth contra PostgreSQL (db-e2e)', () => {
  let app: INestApplication<App>;
  let http: ReturnType<typeof request>;
  let prisma: PrismaClient;
  let relay: OutboxRelayType;
  let reminders: BalanceReminderJobType;
  let mail: MemoryMailTransport;
  let privacy: PrivacyUseCasesType;
  const tokens: Record<'admin' | 'operator' | 'agent', string> = { admin: '', operator: '', agent: '' };
  const userIds: Record<string, string> = {};
  const today = toLimaCalendarDate(new Date());

  beforeAll(async () => {
    Object.assign(process.env, {
      NODE_ENV: 'test',
      DATA_SOURCE: 'prisma',
      DATABASE_URL: url,
      SANDBOX_WEBHOOK_SECRET: 'db-e2e-only-webhook-secret-0123456789',
      THROTTLE_STRICT_LIMIT: '1000',
      THROTTLE_LIMIT: '10000',
      JWT_ACCESS_SECRET: 'db-e2e-only-jwt-secret-0123456789-abcdefghijkl',
      OUTBOX_RELAY_ENABLED: 'false',
      MAIL_TRANSPORT: 'memory',
      PROVIDER_LEGAL_NAME: 'Peru Wonders Tours E.I.R.L.',
      PROVIDER_RUC: '20000000001',
      ESTABLISHMENT_ADDRESS: 'Jr. Lima 123, Puno',
    });
    const { AppModule } = await import('../src/app.module.js');
    const { configureApp } = await import('../src/app.setup.js');
    const { StaffUsersUseCases } = await import('../src/modules/identity/application/staff-users.use-cases.js');
    const { OutboxRelay, BalanceReminderJob } = await import('../src/modules/notifications/application/outbox-relay.js');
    const { PrivacyUseCases } = await import('../src/modules/privacy/application/privacy.use-cases.js');
    const { PERSISTENCE_BACKEND, MAIL_TRANSPORT } = await import('../src/shared/application/tokens.js');
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication({ rawBody: true });
    configureApp(app);
    await app.init();
    http = request(app.getHttpServer());
    prisma = app.get<{ prisma: PrismaClient }>(PERSISTENCE_BACKEND).prisma;
    relay = app.get(OutboxRelay);
    reminders = app.get(BalanceReminderJob);
    mail = app.get<MemoryMailTransport>(MAIL_TRANSPORT);
    privacy = app.get(PrivacyUseCases);

    const users = app.get(StaffUsersUseCases);
    const meta = { ip: '127.0.0.1', userAgent: 'db-e2e', requestId: null };
    for (const [role, name] of [['admin', 'Admin Principal'], ['operator', 'Olga Operaciones'], ['agent', 'Ángel Asesor']] as const) {
      const { user } = await users.create({ email: `${role}@pwt.test`, fullName: name, role, password: PASSWORD }, null, meta);
      userIds[role] = user.id;
      const login = await http.post('/api/v1/auth/staff/login').send({ email: `${role}@pwt.test`, password: PASSWORD }).expect(200);
      const enrollmentToken = login.body.data.enrollmentToken as string;
      const start = await http.post('/api/v1/auth/staff/mfa/enrollment').send({ enrollmentToken }).expect(200);
      const code = await generate({ secret: start.body.data.secret as string, epoch: Math.floor(Date.now() / 1000) });
      const session = await http.post('/api/v1/auth/staff/mfa/enrollment/confirm').send({ enrollmentToken, code }).expect(200);
      tokens[role] = session.body.data.accessToken as string;
    }
  });

  afterAll(async () => {
    await app?.close();
  });

  const as = (role: keyof typeof tokens) => ({ Authorization: `Bearer ${tokens[role]}` });

  // ---------------------------------------------------------------------------
  const state = {
    tourId: '',
    tourVersion: 0,
    departureId: '',
    bookingCode: '',
    bookingTotal: 0,
    cancelCode: '',
    reminderCode: '',
    complaintId: '',
    letterComplaintId: '',
  };

  it('auth en PostgreSQL: refresh rotativo con FOR UPDATE y detección de reutilización', async () => {
    const login = await http.post('/api/v1/auth/staff/login').send({ email: 'agent@pwt.test', password: PASSWORD }).expect(200);
    expect(login.body.data.status).toBe('mfa_required');
    const row = await prisma.user.findUniqueOrThrow({ where: { email: 'agent@pwt.test' } });
    expect(row.passwordHash).toMatch(/^\$argon2id\$/);
    expect(row.mfaEnabledAt).not.toBeNull();
    expect(await prisma.userRecoveryCode.count({ where: { userId: row.id, usedAt: null } })).toBe(10);
    // Sesión nueva con código de recuperación (determinista).
    const recovery = await prisma.userRecoveryCode.findFirstOrThrow({ where: { userId: row.id } });
    expect(recovery.codeHash).toMatch(/^[0-9a-f]{64}$/);
    // Refresh: rotación y reutilización.
    const admin = await http.post('/api/v1/auth/staff/login').send({ email: 'admin@pwt.test', password: PASSWORD }).expect(200);
    expect(admin.body.data.status).toBe('mfa_required');
    const sessions = await http.get('/api/v1/auth/staff/sessions').set(as('admin')).expect(200);
    expect(sessions.body.data).toHaveLength(1);
  });

  it('RBAC por permisos + IDOR: el asesor no crea tours, no gestiona usuarios; el operador tampoco gestiona usuarios', async () => {
    const denied = await http.post('/api/v1/admin/tours').set(as('agent')).send({ code: 'NO-1', slug: 'no-1', type: 'tour', durationHours: 4 }).expect(403);
    expect(denied.body.code).toBe('insufficient-permissions');
    await http.get('/api/v1/admin/users').set(as('operator')).expect(403);
    await http.patch(`/api/v1/admin/users/${userIds['agent']}`).set(as('operator')).send({ version: 0, role: 'admin' }).expect(403);
    await http.get('/api/v1/admin/audit').set(as('operator')).expect(403);
    const audit = await prisma.auditLog.findFirst({ where: { action: 'ACCESS_DENIED', actorId: userIds['agent'] } });
    expect(audit?.after).toMatchObject({ required: ['tours:write'] });
  });

  it('tours: crear, publicar exige datos mínimos, traducción, portada, conflicto de versión y 301 al cambiar slug', async () => {
    const created = await http
      .post('/api/v1/admin/tours')
      .set(as('operator'))
      .send({ code: 'PUN-UROS-01', slug: 'uros-taquile-full-day', type: 'tour', durationHours: 9, minPax: 1, languages: ['es', 'en'], bookingCutoffHours: 24 })
      .expect(201);
    state.tourId = created.body.data.id;
    expect(created.body.data).toMatchObject({ status: 'draft', version: 0, publication: { publishable: false } });

    const notPublishable = await http.post(`/api/v1/admin/tours/${state.tourId}/publish`).set(as('operator')).send({ version: 0 }).expect(422);
    expect(notPublishable.body.code).toBe('tour-not-publishable');
    expect(notPublishable.body.errors.map((e: { field: string }) => e.field)).toEqual(['translations.es', 'media']);

    const translated = await http
      .put(`/api/v1/admin/tours/${state.tourId}/translations/es`)
      .set(as('operator'))
      .send({ version: 0, slug: 'uros-taquile-full-day', title: 'Uros y Taquile Full Day', summary: 'Islas del Titicaca', itinerary: [{ day: 1, title: 'Día 1', description: 'Uros y Taquile' }], includes: ['Lancha'] })
      .expect(200);
    expect(translated.body.data.version).toBe(1);
    const withMedia = await http
      .post(`/api/v1/admin/tours/${state.tourId}/media`)
      .set(as('operator'))
      .send({ version: 1, storageKey: 'https://cdn.example.test/uros.jpg', isCover: true, altEs: 'Islas de los Uros' })
      .expect(201);
    expect(withMedia.body.data.publication.publishable).toBe(true);
    const published = await http.post(`/api/v1/admin/tours/${state.tourId}/publish`).set(as('operator')).send({ version: 2 }).expect(200);
    expect(published.body.data).toMatchObject({ status: 'published', version: 3 });
    expect(published.body.data.publishedAt).toBeTruthy();

    const conflict = await http.patch(`/api/v1/admin/tours/${state.tourId}`).set(as('admin')).send({ version: 1, isFeatured: true }).expect(409);
    expect(conflict.body.code).toBe('tour-version-conflict');
    expect(conflict.body.detail).toContain('Olga Operaciones');

    const renamed = await http
      .put(`/api/v1/admin/tours/${state.tourId}/translations/es`)
      .set(as('admin'))
      .send({ version: 3, slug: 'uros-y-taquile', title: 'Uros y Taquile Full Day', summary: 'Islas del Titicaca', itinerary: [{ day: 1, title: 'Día 1', description: 'Uros y Taquile' }] })
      .expect(200);
    expect(renamed.body.data.slug).toBe('uros-y-taquile');
    state.tourVersion = renamed.body.data.version;
    const redirect = await prisma.legacyRedirect.findUnique({ where: { fromPath: '/es/tours/uros-taquile-full-day' } });
    expect(redirect).toMatchObject({ toPath: '/es/tours/uros-y-taquile', statusCode: 301 });

    // El trigger de auditoría de fila registra al usuario del staff (app.actor_id).
    const rowAudit = await prisma.auditLog.findFirst({ where: { entityType: 'tours', entityId: state.tourId, action: 'UPDATE', actorId: userIds['operator'] } });
    expect(rowAudit?.actorType).toBe('user');
    const appAudit = await prisma.auditLog.findFirst({ where: { action: 'TOUR_PUBLISHED', entityId: state.tourId } });
    expect(appAudit?.actorId).toBe(userIds['operator']);
  });

  it('temporadas y tarifas: solape rechazado con mensaje claro', async () => {
    const season = await http
      .post('/api/v1/admin/seasons')
      .set(as('operator'))
      .send({ code: 'ALTA-2027', name: 'Temporada alta 2027', startDate: '2027-05-01', endDate: '2027-09-30', priority: 10 })
      .expect(201);
    expect(season.body.data.version).toBe(0);
    const rate = { paxType: 'adult', residency: 'foreign', currency: 'USD', amount: 10_000, validFrom: '2026-01-01', validTo: '2027-12-31' };
    await http.post(`/api/v1/admin/tours/${state.tourId}/rates`).set(as('agent')).send(rate).expect(403);
    const created = await http.post(`/api/v1/admin/tours/${state.tourId}/rates`).set(as('operator')).send(rate).expect(201);
    expect(created.body.data.price).toEqual({ amount: 10_000, currency: 'USD' });
    const overlap = await http.post(`/api/v1/admin/tours/${state.tourId}/rates`).set(as('operator')).send({ ...rate, amount: 9_000, validFrom: '2027-06-01' }).expect(409);
    expect(overlap.body.code).toBe('rate-overlap');
    expect(overlap.body.detail).toContain('adulto / extranjero / USD, 2026-01-01 a 2027-12-31');
    expect(overlap.body.details.conflictingRateId).toBe(created.body.data.id);
    // Otra combinación (grupo 5+, temporada) no se solapa.
    await http.post(`/api/v1/admin/tours/${state.tourId}/rates`).set(as('operator')).send({ ...rate, residency: 'national', currency: 'PEN', amount: 30_000 }).expect(201);
    await http.post(`/api/v1/admin/tours/${state.tourId}/rates`).set(as('operator')).send({ ...rate, seasonId: season.body.data.id, amount: 12_000 }).expect(201);
    const inUse = await http.delete(`/api/v1/admin/seasons/${season.body.data.id}`).set(as('operator')).expect(409);
    expect(inUse.body.code).toBe('season-in-use');
    const stale = await http.patch(`/api/v1/admin/rates/${created.body.data.id}`).set(as('operator')).send({ version: 7, amount: 11_000 }).expect(409);
    expect(stale.body.code).toBe('concurrency-conflict');
    const list = await http.get(`/api/v1/admin/tours/${state.tourId}/rates`).set(as('agent')).expect(200);
    expect(list.body.data).toHaveLength(3);
  });

  it('salidas: generación en lote idempotente, capacidad y cierre de ventas', async () => {
    const from = addDays(today, 5);
    const to = addDays(today, 70);
    const bulk = await http.post(`/api/v1/admin/tours/${state.tourId}/departures/bulk`).set(as('operator')).send({ from, to, weekdays: [1, 2, 3, 4, 5, 6, 7], capacity: 10 }).expect(201);
    expect(bulk.body.data.created).toBe(66);
    const again = await http.post(`/api/v1/admin/tours/${state.tourId}/departures/bulk`).set(as('operator')).send({ from, to, weekdays: [1, 2, 3, 4, 5, 6, 7], capacity: 10 }).expect(201);
    expect(again.body.data).toMatchObject({ created: 0 });
    expect(again.body.data.skipped).toHaveLength(66);
    await http.post(`/api/v1/admin/tours/${state.tourId}/departures/bulk`).set(as('operator')).send({ from: addDays(today, -3), to, weekdays: [1], capacity: 10 }).expect(400);
    const list = await http.get(`/api/v1/admin/tours/${state.tourId}/departures`).set(as('agent')).query({ from, to: addDays(today, 6) }).expect(200);
    expect(list.body.data).toHaveLength(2);
    const dep = list.body.data[0];
    const closed = await http.post(`/api/v1/admin/departures/${dep.id}/close-sales`).set(as('operator')).send({ version: dep.version }).expect(200);
    expect(closed.body.data.isClosed).toBe(true);
    await http.post(`/api/v1/admin/departures/${dep.id}/reopen-sales`).set(as('operator')).send({ version: dep.version }).expect(409);
    await http.post(`/api/v1/admin/departures/${dep.id}/reopen-sales`).set(as('operator')).send({ version: closed.body.data.version }).expect(200);
  });

  async function publicBooking(travelDate: string, email: string, quantity = 2): Promise<{ code: string; total: number; token: string }> {
    const cartRes = await http.post('/api/v1/carts').send({ currency: 'USD', locale: 'es' }).expect(201);
    const { token, cart } = cartRes.body.data;
    await http
      .post(`/api/v1/carts/${cart.id}/items`)
      .set('X-Cart-Token', token)
      .send({ tourId: state.tourId, travelDate, pax: [{ paxType: 'adult', residency: 'foreign', quantity }] })
      .expect(201);
    const created = await http
      .post('/api/v1/bookings')
      .set('X-Cart-Token', token)
      .set('Idempotency-Key', randomUUID())
      .send({
        cartId: cart.id,
        paymentOption: 'deposit',
        customer: { email, firstName: 'Cliente', lastName: 'Prueba', country: 'PE' },
        acceptTerms: true,
        acceptPrivacyPolicy: true,
        marketingEmailOptIn: true,
      })
      .expect(201);
    return { code: created.body.data.code, total: created.body.data.total.amount, token: created.body.data.accessToken };
  }

  it('reservas: pago manual del adelanto y del saldo (idempotente, referencia única, sin sobrepago) y voucher', async () => {
    const travelDate = addDays(today, 60);
    const booking = await publicBooking(travelDate, 'cliente.db@example.com');
    state.bookingCode = booking.code;
    state.bookingTotal = booking.total;
    const deposit = booking.total / 2;
    const key = randomUUID();
    await http.post(`/api/v1/admin/bookings/${booking.code}/payments`).set(as('agent')).send({ amount: deposit, method: 'bank_transfer', reference: 'OP-1001' }).expect(400); // sin Idempotency-Key
    const paid = await http
      .post(`/api/v1/admin/bookings/${booking.code}/payments`)
      .set(as('agent'))
      .set('Idempotency-Key', key)
      .send({ amount: deposit, method: 'bank_transfer', reference: 'OP-1001', note: 'Depósito BCP' })
      .expect(201);
    expect(paid.body.data).toMatchObject({ replayed: false, kind: 'deposit', bookingStatus: 'partially_paid' });
    const replay = await http.post(`/api/v1/admin/bookings/${booking.code}/payments`).set(as('agent')).set('Idempotency-Key', key).send({ amount: deposit, method: 'bank_transfer', reference: 'OP-1001' }).expect(201);
    expect(replay.body.data.replayed).toBe(true);
    const dupRef = await http.post(`/api/v1/admin/bookings/${booking.code}/payments`).set(as('agent')).set('Idempotency-Key', randomUUID()).send({ amount: 100, method: 'bank_transfer', reference: 'OP-1001' }).expect(409);
    expect(dupRef.body.code).toBe('payment-reference-taken');
    const over = await http.post(`/api/v1/admin/bookings/${booking.code}/payments`).set(as('agent')).set('Idempotency-Key', randomUUID()).send({ amount: booking.total, method: 'cash', reference: 'REC-9' }).expect(422);
    expect(over.body.code).toBe('overpayment');
    const balance = await http
      .post(`/api/v1/admin/bookings/${booking.code}/payments`)
      .set(as('operator'))
      .set('Idempotency-Key', randomUUID())
      .send({ amount: booking.total - deposit, method: 'cash', reference: 'REC-0001' })
      .expect(201);
    expect(balance.body.data).toMatchObject({ kind: 'balance', bookingStatus: 'paid', balance: { amount: 0, currency: 'USD' } });
    const payments = await prisma.payment.findMany({ where: { booking: { code: booking.code } } });
    expect(payments.every((p) => p.provider === 'manual' && p.recordedByUserId !== null)).toBe(true);

    const detail = await http.get(`/api/v1/admin/bookings/${booking.code}`).set(as('agent')).expect(200);
    expect(detail.body.data).toMatchObject({ status: 'paid', customer: { email: 'cliente.db@example.com' } });
    expect(detail.body.data.payments).toHaveLength(2);
    expect(detail.body.data.payments[0].recordedBy.fullName).toBe('Ángel Asesor');
    expect(detail.body.data.legalAcceptances).toHaveLength(3);
    expect(detail.body.data.statusHistory.map((h: { to: string }) => h.to)).toEqual(['pending', 'held', 'partially_paid', 'paid']);
    expect(detail.body.data.emails.map((e: { eventType: string }) => e.eventType)).toEqual(['booking.confirmed', 'booking.payment_received']);

    const voucher = await http.post(`/api/v1/admin/bookings/${booking.code}/resend-voucher`).set(as('agent')).expect(202);
    expect(voucher.body.data.queued).toBe(true);

    const filtered = await http.get('/api/v1/admin/bookings').set(as('agent')).query({ status: 'paid', email: 'CLIENTE.DB@example.com', travelDateFrom: travelDate, travelDateTo: travelDate }).expect(200);
    expect(filtered.body.meta.total).toBe(1);
    expect(filtered.body.data[0].code).toBe(booking.code);
    const byCode = await http.get('/api/v1/admin/bookings').set(as('agent')).query({ code: booking.code.slice(0, 9) }).expect(200);
    expect(byCode.body.meta.total).toBeGreaterThanOrEqual(1);
    await http.get('/api/v1/admin/bookings/PWT-2099-999999').set(as('agent')).expect(404);
  });

  it('cancelación con política de reembolso, liberación de cupo y reembolso manual', async () => {
    const travelDate = addDays(today, 62);
    const booking = await publicBooking(travelDate, 'cancela.db@example.com', 3);
    state.cancelCode = booking.code;
    await http
      .post(`/api/v1/admin/bookings/${booking.code}/payments`)
      .set(as('agent'))
      .set('Idempotency-Key', randomUUID())
      .send({ amount: booking.total / 2, method: 'bank_transfer', reference: 'OP-2001' })
      .expect(201);
    const depBefore = await prisma.departure.findFirstOrThrow({ where: { tourId: state.tourId, departureDate: new Date(`${travelDate}T00:00:00Z`) } });
    expect(depBefore.booked).toBe(3);
    const quote = await http.get(`/api/v1/admin/bookings/${booking.code}/cancellation-quote`).set(as('agent')).expect(200);
    expect(quote.body.data.tier.refundPercent).toBe(100);
    expect(quote.body.data.refundAmount.amount).toBe(booking.total / 2);
    await http.post(`/api/v1/admin/bookings/${booking.code}/cancel`).set(as('agent')).send({ reason: 'Pedido del cliente' }).expect(403);
    await http.post(`/api/v1/admin/bookings/${booking.code}/cancel`).set(as('operator')).send({ reason: 'Pedido del cliente', refundAmountOverride: 1 }).expect(400);
    const cancelled = await http.post(`/api/v1/admin/bookings/${booking.code}/cancel`).set(as('operator')).send({ reason: 'Pedido del cliente por correo' }).expect(200);
    expect(cancelled.body.data).toMatchObject({ status: 'cancelled', releasedSeats: 3, refundDue: { amount: booking.total / 2, currency: 'USD' } });
    const depAfter = await prisma.departure.findUniqueOrThrow({ where: { id: depBefore.id } });
    expect(depAfter.booked).toBe(0);
    await http.post(`/api/v1/admin/bookings/${booking.code}/cancel`).set(as('operator')).send({ reason: 'Otra vez' }).expect(409);

    await http.post(`/api/v1/admin/bookings/${booking.code}/refunds`).set(as('agent')).set('Idempotency-Key', randomUUID()).send({ amount: 100, method: 'bank_transfer', reference: 'DEV-1' }).expect(403);
    const tooMuch = await http.post(`/api/v1/admin/bookings/${booking.code}/refunds`).set(as('operator')).set('Idempotency-Key', randomUUID()).send({ amount: booking.total, method: 'bank_transfer', reference: 'DEV-X' }).expect(422);
    expect(tooMuch.body.code).toMatch(/refund-exceeds/);
    const refund = await http
      .post(`/api/v1/admin/bookings/${booking.code}/refunds`)
      .set(as('operator'))
      .set('Idempotency-Key', randomUUID())
      .send({ amount: booking.total / 2, method: 'bank_transfer', reference: 'DEV-2001' })
      .expect(201);
    expect(refund.body.data).toMatchObject({ bookingStatus: 'refunded', refunded: { amount: booking.total / 2 } });
    const audit = await http.get('/api/v1/admin/audit').set(as('admin')).query({ action: 'BOOKING_CANCELLED' }).expect(200);
    expect(audit.body.data[0]).toMatchObject({ actorType: 'user', actorId: userIds['operator'], entityType: 'bookings' });
    // Capacidad: no se puede bajar por debajo de lo vendido de la primera reserva.
    const sold = await prisma.departure.findFirstOrThrow({ where: { tourId: state.tourId, booked: { gt: 0 } } });
    const below = await http.patch(`/api/v1/admin/departures/${sold.id}`).set(as('operator')).send({ version: sold.version, capacity: 1 }).expect(422);
    expect(below.body.code).toBe('capacity-below-sold');
    expect(below.body.detail).toContain('Hay 2 cupos vendidos');
  });

  it('recordatorios de saldo idempotentes con ON CONFLICT (dedupe_key)', async () => {
    const booking = await publicBooking(addDays(today, 10), 'recordatorio.db@example.com', 1);
    state.reminderCode = booking.code;
    await http
      .post(`/api/v1/admin/bookings/${booking.code}/payments`)
      .set(as('agent'))
      .set('Idempotency-Key', randomUUID())
      .send({ amount: booking.total / 2, method: 'cash', reference: 'REC-3001' })
      .expect(201);
    const first = await reminders.runOnce();
    expect(first.enqueued).toBeGreaterThanOrEqual(1);
    expect((await reminders.runOnce()).enqueued).toBe(0);
    const keys = await prisma.outboxEvent.findMany({ where: { eventType: 'booking.balance_reminder' }, select: { dedupeKey: true } });
    expect(keys.map((k) => k.dedupeKey)).toEqual(expect.arrayContaining([expect.stringMatching(/^balance-reminder:.+:7d$/)]));
  });

  const complaintBody = (extra: Record<string, unknown> = {}) => ({
    consumer: { fullName: 'Rosa Mamani', docType: 'dni', docNumber: '45678912', address: 'Jr. Lima 123, Puno', phone: '+51987654321', email: 'rosa@example.com', isMinor: false },
    good: { type: 'service', description: 'Tour Uros y Taquile', claimedAmount: 45000, currency: 'PEN' },
    declaredType: 'queja',
    detail: 'El tour no incluyó el almuerzo ofrecido en la ficha.',
    consumerRequest: 'Devolución parcial del precio.',
    responseChannel: 'email',
    conformityAccepted: true,
    ...extra,
  });

  it('Libro de Reclamaciones: bandeja con semáforo, detalle auditado, reclasificación, solución directa y respuesta por correo', async () => {
    const submitted = await http.post('/api/v1/complaints').set('Idempotency-Key', randomUUID()).send(complaintBody()).expect(201);
    const list = await http.get('/api/v1/admin/complaints').set(as('agent')).expect(200);
    const item = list.body.data.find((c: { code: string }) => c.code === submitted.body.data.code);
    expect(item).toMatchObject({ trafficLight: 'green', status: 'received', type: 'queja', businessDaysRemaining: 15 });
    state.complaintId = item.id;

    const detail = await http.get(`/api/v1/admin/complaints/${state.complaintId}`).set(as('agent')).expect(200);
    expect(detail.body.data.consumer).toMatchObject({ docNumber: '45678912', phone: '+51987654321' });
    expect(await prisma.auditLog.count({ where: { action: 'COMPLAINT_PII_VIEWED', entityId: state.complaintId, actorId: userIds['agent'] } })).toBe(1);
    await http.get(`/api/v1/admin/complaints/${randomUUID()}`).set(as('agent')).expect(404);

    await http.post(`/api/v1/admin/complaints/${state.complaintId}/reclassify`).set(as('agent')).send({ type: 'reclamo', reason: 'Trata del servicio contratado' }).expect(403);
    const reclassified = await http.post(`/api/v1/admin/complaints/${state.complaintId}/reclassify`).set(as('operator')).send({ type: 'reclamo', reason: 'Trata del servicio contratado (art. 6)' }).expect(200);
    expect(reclassified.body.data).toMatchObject({ type: 'reclamo', declaredType: 'queja' });
    expect(reclassified.body.data.responseDueAt).toBe(item.responseDueAt);

    const offer = await http.post(`/api/v1/admin/complaints/${state.complaintId}/settlement-offer`).set(as('operator')).send({ offerText: 'Te ofrecemos un cupón de S/ 100 para otro tour.' }).expect(200);
    expect(new Date(offer.body.data.responseDueAt).getTime()).toBeGreaterThan(new Date(item.responseDueAt).getTime());
    const suspended = await http.get('/api/v1/admin/complaints').set(as('agent')).query({ trafficLight: 'suspended' }).expect(200);
    expect(suspended.body.data.map((c: { id: string }) => c.id)).toContain(state.complaintId);
    await http.post(`/api/v1/admin/complaints/${state.complaintId}/settlement-offer`).set(as('operator')).send({ offerText: 'Otra oferta distinta' }).expect(409);
    const rejected = await http.post(`/api/v1/admin/complaints/${state.complaintId}/settlement-rejection`).set(as('operator')).send({ note: 'No aceptó' }).expect(200);
    expect(new Date(rejected.body.data.responseDueAt).getTime()).toBeGreaterThanOrEqual(new Date(item.responseDueAt).getTime());

    const answered = await http
      .post(`/api/v1/admin/complaints/${state.complaintId}/respond`)
      .set(as('operator'))
      .send({ responseText: 'Lamentamos lo ocurrido. Te devolveremos S/ 45.00 por el almuerzo no servido.' })
      .expect(200);
    expect(answered.body.data).toMatchObject({ status: 'answered', responseSentAt: null });
    await http.post(`/api/v1/admin/complaints/${state.complaintId}/respond`).set(as('operator')).send({ responseText: 'Segunda respuesta no permitida.' }).expect(409);
  });

  it('respuesta por carta exige cargo; transcripción del libro de respaldo con alerta de 1 día', async () => {
    const letter = await http.post('/api/v1/complaints').set('Idempotency-Key', randomUUID()).send(complaintBody({ responseChannel: 'letter', declaredType: 'reclamo' })).expect(201);
    const found = await prisma.complaint.findUniqueOrThrow({ where: { code: letter.body.data.code } });
    state.letterComplaintId = found.id;
    await http.post(`/api/v1/admin/complaints/${found.id}/respond`).set(as('operator')).send({ responseText: 'Respuesta formal por carta notarial.' }).expect(400);
    const sentAt = new Date().toISOString();
    const ok = await http
      .post(`/api/v1/admin/complaints/${found.id}/respond`)
      .set(as('operator'))
      .send({ responseText: 'Respuesta formal por carta notarial.', letterSentAt: sentAt, letterDeliveryRef: 'CARGO-0001' })
      .expect(200);
    expect(ok.body.data.responseSentAt).toBe(sentAt);

    const physical = new Date(Date.now() - 2 * 86_400_000).toISOString();
    const body = { ...complaintBody(), backupSheetNumber: 'F-000123', submittedAt: physical };
    delete (body as Record<string, unknown>)['conformityAccepted'];
    await http.post('/api/v1/admin/complaints/transcriptions').set(as('agent')).send(body).expect(403);
    const transcribed = await http.post('/api/v1/admin/complaints/transcriptions').set(as('operator')).send(body).expect(201);
    expect(transcribed.body.data).toMatchObject({ backupSheetNumber: 'F-000123', lateTranscription: true });
    expect(transcribed.body.data.warning).toContain('art. 4-A');
    const dup = await http.post('/api/v1/admin/complaints/transcriptions').set(as('operator')).send(body).expect(409);
    expect(dup.body.code).toBe('backup-sheet-already-transcribed');
    const row = await prisma.complaint.findUniqueOrThrow({ where: { code: transcribed.body.data.code } });
    expect(row).toMatchObject({ channel: 'backup_book', conformityAcceptedAt: null });
    expect(row.submittedAt.toISOString()).toBe(physical);
  });

  it('relay del outbox con PostgreSQL: envía todos los correos una sola vez y fija responseSentAt', async () => {
    const pending = await prisma.outboxEvent.count({ where: { publishedAt: null } });
    expect(pending).toBeGreaterThan(5);
    let sent = 0;
    for (let i = 0; i < 5; i += 1) sent += (await relay.runOnce()).sent;
    expect(sent).toBe(pending);
    expect(await prisma.outboxEvent.count({ where: { publishedAt: null } })).toBe(0);
    expect((await relay.runOnce()).claimed).toBe(0);
    const templates = mail.sent.map((m) => m.template);
    expect(templates).toEqual(
      expect.arrayContaining([
        'booking-confirmation', 'payment-received', 'booking-voucher', 'booking-cancelled', 'balance-reminder-7d',
        'complaint-acknowledgment', 'complaint-settlement-offer', 'complaint-response',
      ]),
    );
    expect(await prisma.emailDelivery.count()).toBe(mail.sent.length);
    const complaint = await prisma.complaint.findUniqueOrThrow({ where: { id: state.complaintId } });
    expect(complaint.responseSentAt).not.toBeNull();
    expect(complaint.responseDeliveryRef).toMatch(/^<.+\.complaint-response@peruwonderstours.com>$/);
    expect(complaint.acknowledgmentSentAt).not.toBeNull();
    // Canal carta: la fecha registrada por el staff no la cambia el correo de cortesía.
    const letter = await prisma.complaint.findUniqueOrThrow({ where: { id: state.letterComplaintId } });
    expect(letter.responseDeliveryRef).toBe('carta:CARGO-0001');
    // Ningún correo de marketing para quien no lo aceptó; la confirmación incluye enlace de baja (aceptó).
    const confirmation = mail.sent.find((m) => m.template === 'booking-confirmation' && m.to[0] === 'cliente.db@example.com');
    expect(confirmation?.text).toContain('/es/privacidad/baja?token=');
  });

  it('protección de datos: ARCO con plazos, ampliación única, historial de consentimientos y baja por enlace', async () => {
    await http.post('/api/v1/admin/privacy/requests').set(as('operator')).send({ type: 'access', subjectName: 'Cliente Prueba', subjectEmail: 'cliente.db@example.com', channel: 'email', detail: 'Solicito acceso a mis datos.' }).expect(403);
    const created = await http
      .post('/api/v1/admin/privacy/requests')
      .set(as('admin'))
      .send({ type: 'access', subjectName: 'Cliente Prueba', subjectEmail: 'Cliente.DB@example.com', channel: 'email', detail: 'Solicito acceso a mis datos.' })
      .expect(201);
    expect(created.body.data).toMatchObject({ status: 'received', subjectEmail: 'cliente.db@example.com', overdue: false });
    expect(created.body.data.code).toMatch(/^ARCO-\d{4}-000001$/);
    expect(created.body.data.customerId).toBeTruthy();
    const id = created.body.data.id as string;
    const extended = await http.post(`/api/v1/admin/privacy/requests/${id}/extend`).set(as('admin')).send({ version: 0, reason: 'Volumen de información a recopilar.' }).expect(200);
    expect(new Date(extended.body.data.dueAt).getTime()).toBeGreaterThan(new Date(created.body.data.dueAt).getTime());
    const again = await http.post(`/api/v1/admin/privacy/requests/${id}/extend`).set(as('admin')).send({ version: 1, reason: 'Segunda ampliación no permitida.' }).expect(409);
    expect(again.body.code).toBe('privacy-request-already-extended');
    const answered = await http.post(`/api/v1/admin/privacy/requests/${id}/respond`).set(as('admin')).send({ version: 1, status: 'answered', responseText: 'Adjuntamos la información solicitada.' }).expect(200);
    expect(answered.body.data.status).toBe('answered');
    const list = await http.get('/api/v1/admin/privacy/requests').set(as('operator')).expect(200);
    expect(list.body.meta.total).toBe(1);

    const history = await http.get('/api/v1/admin/privacy/consents').set(as('operator')).query({ email: 'cliente.db@example.com' }).expect(200);
    expect(history.body.data.current).toMatchObject({ marketing_email: true, marketing_whatsapp: false });
    expect(history.body.data.legalAcceptances.length).toBe(3);

    const token = privacy.buildUnsubscribeToken('cliente.db@example.com');
    const preview = await http.get('/api/v1/privacy/unsubscribe').query({ token }).expect(200);
    expect(preview.body.data.purposes).toEqual([{ purpose: 'marketing_email', granted: true }, { purpose: 'marketing_whatsapp', granted: false }]);
    const revoked = await http.post('/api/v1/privacy/unsubscribe').send({ token }).expect(200);
    expect(revoked.body.data).toEqual({ revoked: ['marketing_email'], alreadyRevoked: ['marketing_whatsapp'] });
    const after = await http.get('/api/v1/admin/privacy/consents').set(as('operator')).query({ email: 'cliente.db@example.com' }).expect(200);
    expect(after.body.data.current.marketing_email).toBe(false);
    const revocation = await prisma.consent.findFirstOrThrow({ where: { purpose: 'marketing_email', granted: false } });
    expect(revocation).toMatchObject({ method: 'email_link', source: 'unsubscribe_link' });
    // consents es append-only (trigger).
    await expect(prisma.consent.delete({ where: { id: revocation.id } })).rejects.toThrow();
  });

  it('tablero: ventas, reservas por estado, saldos por vencer, reclamos y ocupación', async () => {
    await http.get('/api/v1/admin/dashboard').expect(401);
    const res = await http.get('/api/v1/admin/dashboard').set(as('agent')).expect(200);
    const d = res.body.data;
    const usdMonth = d.sales.month.find((s: { currency: string }) => s.currency === 'USD');
    expect(usdMonth.amount).toBeGreaterThan(0);
    expect(d.sales.refundsMonth.find((s: { currency: string }) => s.currency === 'USD').count).toBe(1);
    expect(d.bookingsByStatus).toMatchObject({ paid: 1, refunded: 1, partially_paid: 1 });
    expect(d.balances.dueNext7Days.bookings.map((b: { code: string }) => b.code)).toContain(state.reminderCode);
    expect(d.complaints.open).toBe(1); // la transcrita
    expect(d.upcomingDepartures.length).toBeGreaterThan(0);
    expect(d.upcomingDepartures[0]).toHaveProperty('occupancyPercent');
    expect(d.emailOutbox).toEqual({ pending: 0, retrying: 0, failed: 0 });
    expect(d.privacyRequests).toEqual({ open: 0, overdue: 0 });
  });

  it('gestión de usuarios (solo admin): alta con contraseña temporal única, cambio de rol y desactivación', async () => {
    const created = await http.post('/api/v1/admin/users').set(as('admin')).send({ email: 'nuevo@pwt.test', fullName: 'Nuevo Usuario', role: 'agent' }).expect(201);
    expect(created.body.data.temporaryPassword).toHaveLength(20);
    expect(created.headers['cache-control']).toBe('no-store');
    const id = created.body.data.user.id as string;
    const self = await http.patch(`/api/v1/admin/users/${userIds['admin']}`).set(as('admin')).send({ version: 1, role: 'agent' }).expect(403);
    expect(self.body.code).toBe('cannot-modify-own-access');
    const updated = await http.patch(`/api/v1/admin/users/${id}`).set(as('admin')).send({ version: 0, role: 'operator' }).expect(200);
    expect(updated.body.data).toMatchObject({ role: 'operator', version: 1 });
    await http.patch(`/api/v1/admin/users/${id}`).set(as('admin')).send({ version: 0, status: 'disabled' }).expect(409);
    await http.patch(`/api/v1/admin/users/${id}`).set(as('admin')).send({ version: 1, status: 'disabled' }).expect(200);
    const login = await http.post('/api/v1/auth/staff/login').send({ email: 'nuevo@pwt.test', password: created.body.data.temporaryPassword }).expect(403);
    expect(login.body.code).toBe('account-disabled');
  });
});
