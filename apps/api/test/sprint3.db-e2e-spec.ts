import { randomUUID } from 'node:crypto';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { generate } from 'otplib';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import type { PrismaClient } from '../src/generated/prisma/client.js';
import type { OutboxRelay as OutboxRelayType } from '../src/modules/notifications/application/outbox-relay.js';
import type { MemoryMailTransport } from '../src/modules/notifications/infrastructure/mail-transports.js';
import { addDays, toLimaCalendarDate } from '../src/shared/domain/calendar-date.js';
import { testDatabaseUrl } from './support/test-database.js';

const url = testDatabaseUrl();
const describeDb = url ? describe : describe.skip;
const PASSWORD = 'Lago-Titicaca#Uros-77';
const PNG = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13]), Buffer.from('IHDR'), Buffer.from([0, 0, 0, 2, 0, 0, 0, 2]), Buffer.alloc(16)]);

/** Sprint 3 contra PostgreSQL real (`pwt_test`): backoffice de contenido, pagos manuales y acceso por enlace. */
describeDb('Sprint 3 contra PostgreSQL (db-e2e)', () => {
  let app: INestApplication<App>;
  let http: ReturnType<typeof request>;
  let prisma: PrismaClient;
  let relay: OutboxRelayType;
  let mail: MemoryMailTransport;
  const tokens: Record<'admin' | 'operator' | 'agent', string> = { admin: '', operator: '', agent: '' };
  const today = toLimaCalendarDate(new Date());
  const as = (role: keyof typeof tokens) => ({ Authorization: `Bearer ${tokens[role]}` });
  const state = { tourId: '', booking: { code: '', token: '', total: 0 }, paymentId: '' };

  beforeAll(async () => {
    Object.assign(process.env, {
      NODE_ENV: 'test',
      DATA_SOURCE: 'prisma',
      DATABASE_URL: url,
      SANDBOX_WEBHOOK_SECRET: 'db-e2e-only-webhook-secret-0123456789',
      THROTTLE_STRICT_LIMIT: '1000',
      THROTTLE_LIMIT: '10000',
      THROTTLE_LINK_LIMIT: '1000',
      JWT_ACCESS_SECRET: 'db-e2e-only-jwt-secret-0123456789-abcdefghijkl',
      OUTBOX_RELAY_ENABLED: 'false',
      MAIL_TRANSPORT: 'memory',
      MEDIA_LOCAL_DIR: mkdtempSync(join(tmpdir(), 'pwt-media-')),
      MEDIA_PUBLIC_BASE_URL: 'http://localhost:3001/media',
      PUBLIC_WEB_BASE_URL: 'https://web.pwt.test',
    });
    const { AppModule } = await import('../src/app.module.js');
    const { configureApp } = await import('../src/app.setup.js');
    const { StaffUsersUseCases } = await import('../src/modules/identity/application/staff-users.use-cases.js');
    const { OutboxRelay } = await import('../src/modules/notifications/application/outbox-relay.js');
    const { PERSISTENCE_BACKEND, MAIL_TRANSPORT } = await import('../src/shared/application/tokens.js');
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication({ rawBody: true });
    configureApp(app);
    await app.init();
    http = request(app.getHttpServer());
    prisma = app.get<{ prisma: PrismaClient }>(PERSISTENCE_BACKEND).prisma;
    relay = app.get(OutboxRelay);
    mail = app.get<MemoryMailTransport>(MAIL_TRANSPORT);
    const users = app.get(StaffUsersUseCases);
    const meta = { ip: '127.0.0.1', userAgent: 'db-e2e', requestId: null };
    for (const role of ['admin', 'operator', 'agent'] as const) {
      const email = `${role}.s3@pwt.test`;
      await users.create({ email, fullName: `S3 ${role}`, role, password: PASSWORD }, null, meta);
      const login = await http.post('/api/v1/auth/staff/login').send({ email, password: PASSWORD }).expect(200);
      const enrollmentToken = login.body.data.enrollmentToken as string;
      const start = await http.post('/api/v1/auth/staff/mfa/enrollment').send({ enrollmentToken }).expect(200);
      const code = await generate({ secret: start.body.data.secret as string, epoch: Math.floor(Date.now() / 1000) });
      tokens[role] = (await http.post('/api/v1/auth/staff/mfa/enrollment/confirm').send({ enrollmentToken, code }).expect(200)).body.data.accessToken as string;
    }
  });

  afterAll(async () => {
    // No dejar eventos pendientes en pwt_test para otros archivos que cuentan el outbox.
    for (let i = 0; i < 5 && relay; i += 1) if ((await relay.runOnce()).claimed === 0) break;
    await app?.close();
  });

  it('seed: carga data/seed/en (traducciones con estado) y testimonios heredados; idempotente', async () => {
    const { readSeedBundle } = await import('../src/modules/catalog/infrastructure/seed/seed-files.js');
    const { seedDatabase } = await import('../src/database/seed/seed-database.js');
    const bundle = await readSeedBundle('../../data/seed');
    const first = await seedDatabase(prisma, bundle, { publishTours: true, refreshContent: false, now: new Date() });
    expect(first.translationsEn.tours).toBe(bundle.en?.tours.length ?? 0);
    const again = await seedDatabase(prisma, bundle, { publishTours: true, refreshContent: false, now: new Date() });
    expect(again.testimonials.created).toBe(0);
    expect(again.blogPosts.created).toBe(0);
    const en = await http.get('/api/v1/tours?locale=en&pageSize=50').expect(200);
    expect(en.body.meta.total).toBeGreaterThan(0);
    if (bundle.en?.tours.length) {
      expect(en.body.data.some((t: { fallback: boolean }) => !t.fallback)).toBe(true);
      const status = await prisma.tourTranslation.findFirst({ where: { locale: 'en' }, select: { translationStatus: true } });
      expect(status?.translationStatus).toBe('machine_reviewed_pending_client');
      const detail = await http.get(`/api/v1/tours/${en.body.data[0].slug}?locale=en`).expect(200);
      expect(detail.body.data).not.toHaveProperty('translationStatus');
    }
    const legacy = await http.get('/api/v1/testimonials?allLocales=true').expect(200);
    expect(legacy.body.data.every((t: { source: string | null }) => t.source !== undefined)).toBe(true);
  });

  it('medios: subida multipart con magic bytes, deduplicada y servida en /media', async () => {
    await http.post('/api/v1/admin/media').set(as('agent')).attach('file', PNG, 'a.png').expect(403);
    const up = await http.post('/api/v1/admin/media?folder=tours').set(as('operator')).attach('file', PNG, { filename: 'foto.png', contentType: 'image/png' }).expect(201);
    expect(up.body.data).toMatchObject({ contentType: 'image/png', width: 2, height: 2, created: true });
    expect(up.body.data.storageKey).toMatch(/^tours\/[0-9a-f]{2}\/[0-9a-f]{24}\.png$/);
    const again = await http.post('/api/v1/admin/media?folder=tours').set(as('operator')).attach('file', PNG, 'otra.png').expect(201);
    expect(again.body.data.created).toBe(false);
    const fake = await http.post('/api/v1/admin/media').set(as('operator')).attach('file', Buffer.from('<svg/> no soy png'), { filename: 'x.png', contentType: 'image/png' }).expect(400);
    expect(fake.body.code).toBe('unsupported-media-type');
    const served = await http.get(`/media/${up.body.data.storageKey}`).expect(200);
    expect(served.headers['content-type']).toBe('image/png');
    expect(served.headers['cache-control']).toContain('immutable');
    await http.get('/media/../.env').expect(404);
  });

  it('blog: CRUD, traducción en, publicar/despublicar y 301 por slug de otro idioma', async () => {
    const created = await http
      .post('/api/v1/admin/blog-posts')
      .set(as('operator'))
      .send({ tags: ['Cusco'], translation: { slug: 'guia-cusco-s3', title: 'Guía de Cusco', body: 'x'.repeat(80) } })
      .expect(201);
    const id = created.body.data.id as string;
    await http.put(`/api/v1/admin/blog-posts/${id}/translations/en`).set(as('operator')).send({ version: 0, slug: 'cusco-guide-s3', title: 'Cusco guide', body: 'y'.repeat(80) }).expect(200);
    await http.put(`/api/v1/admin/blog-posts/${id}/translations/en`).set(as('operator')).send({ version: 0, slug: 'x', title: 'x', body: 'y' }).expect(409);
    await http.get('/api/v1/blog/guia-cusco-s3').expect(404);
    await http.post(`/api/v1/admin/blog-posts/${id}/publish`).set(as('agent')).send({ version: 1 }).expect(403);
    await http.post(`/api/v1/admin/blog-posts/${id}/publish`).set(as('operator')).send({ version: 1 }).expect(200);
    const en = await http.get('/api/v1/blog/cusco-guide-s3?locale=en').expect(200);
    expect(en.body.data).toMatchObject({ locale: 'en', fallback: false, tags: ['cusco'] });
    await http.get('/api/v1/blog/guia-cusco-s3?locale=en').expect(301);
    await http.post(`/api/v1/admin/blog-posts/${id}/unpublish`).set(as('operator')).send({ version: 2 }).expect(200);
    await http.get('/api/v1/blog/cusco-guide-s3?locale=en').expect(404);
    expect(await prisma.auditLog.count({ where: { entityId: id, action: { startsWith: 'BLOG_' } } })).toBeGreaterThanOrEqual(4);
  });

  it('destinos y categorías: CRUD con traducciones, portada, orden y slug por idioma', async () => {
    const d = await http
      .post('/api/v1/admin/destinations')
      .set(as('operator'))
      .send({ slug: 'lago-titicaca-s3', status: 'published', sortOrder: 99, coverStorageKey: 'tours/aa/x.png', translation: { name: 'Lago Titicaca' } })
      .expect(201);
    const id = d.body.data.id as string;
    await http.put(`/api/v1/admin/destinations/${id}/translations/en`).set(as('operator')).send({ version: 0, name: 'Lake Titicaca', slug: 'lake-titicaca-s3' }).expect(200);
    const pub = await http.get('/api/v1/destinations/lake-titicaca-s3?locale=en').expect(200);
    expect(pub.body.data).toMatchObject({ name: 'Lake Titicaca', canonicalSlug: 'lago-titicaca-s3', coverImage: { url: 'http://localhost:3001/media/tours/aa/x.png' } });
    await http.get('/api/v1/destinations/lago-titicaca-s3?locale=en').expect(301);
    await http.patch(`/api/v1/admin/destinations/${id}`).set(as('operator')).send({ version: 0, sortOrder: 1 }).expect(409);
    const cats = await http.get('/api/v1/admin/categories').set(as('agent')).expect(200);
    const reordered = await http.post('/api/v1/admin/categories/reorder').set(as('operator')).send({ items: [{ id: cats.body.data[0].id, sortOrder: 7 }] }).expect(200);
    expect(reordered.body.data.find((c: { id: string }) => c.id === cats.body.data[0].id).sortOrder).toBe(7);
    await http.delete(`/api/v1/admin/categories/${cats.body.data[0].id}`).set(as('operator')).send({ version: reordered.body.data[0].version }).expect(409);
    await http.delete(`/api/v1/admin/destinations/${id}`).set(as('operator')).send({ version: 1 }).expect(204);
  });

  it('testimonios y contacto: moderación, destacado y bandeja con estados', async () => {
    const sent = await http.post('/api/v1/testimonials').send({ authorName: 'Rosa M.', rating: 4, body: 'Excelente atención durante todo el viaje a Puno.', publishConsent: true, consentPrivacyNotice: true }).expect(202);
    const id = sent.body.data.id as string;
    await http.post(`/api/v1/admin/testimonials/${id}/feature`).set(as('operator')).send({ featured: true }).expect(422);
    await http.post(`/api/v1/admin/testimonials/${id}/approve`).set(as('operator')).send({}).expect(200);
    await http.patch(`/api/v1/admin/testimonials/${id}`).set(as('operator')).send({ body: 'Mira www.spam.com ahora mismo, gran oferta' }).expect(400);
    await http.post(`/api/v1/admin/testimonials/${id}/feature`).set(as('operator')).send({ featured: true }).expect(200);
    const pub = await http.get('/api/v1/testimonials?featured=true').expect(200);
    expect(pub.body.data.map((t: { id: string }) => t.id)).toContain(id);

    await http.post('/api/v1/contact').send({ name: 'Leo', email: 'leo@example.com', phone: '+51 987 654 321', subject: 'Cotización', message: 'Somos 4 personas para mayo.', consentPrivacyNotice: true }).expect(201);
    const inbox = await http.get('/api/v1/admin/contact-messages?status=new').set(as('agent')).expect(200);
    const msg = inbox.body.data[0];
    expect(inbox.body.meta.counts.new).toBeGreaterThan(0);
    const detail = await http.get(`/api/v1/admin/contact-messages/${msg.id}`).set(as('agent')).expect(200);
    expect(detail.body.data.phone).toBe('+51 987 654 321');
    const raw = await prisma.contactMessage.findUniqueOrThrow({ where: { id: msg.id } });
    expect(Buffer.from(raw.phoneEnc!).toString('utf8')).not.toContain('987');
    await http.post(`/api/v1/admin/contact-messages/${msg.id}/status`).set(as('agent')).send({ status: 'answered' }).expect(403);
    await http.post(`/api/v1/admin/contact-messages/${msg.id}/status`).set(as('operator')).send({ status: 'answered' }).expect(200);
    await http.post(`/api/v1/admin/contact-messages/${msg.id}/status`).set(as('operator')).send({ status: 'new' }).expect(409);
  });

  async function prepareTour(): Promise<void> {
    const t = await http.post('/api/v1/admin/tours').set(as('operator')).send({ code: 'S3-VOID-01', slug: 's3-void-tour', type: 'tour', durationHours: 4, minPax: 1 }).expect(201);
    state.tourId = t.body.data.id;
    await http.put(`/api/v1/admin/tours/${state.tourId}/translations/es`).set(as('operator')).send({ version: 0, slug: 's3-void-tour', title: 'Tour S3', summary: 'Resumen', itinerary: [{ day: 1, title: 'D1', description: 'x' }] }).expect(200);
    await http.post(`/api/v1/admin/tours/${state.tourId}/media`).set(as('operator')).send({ version: 1, storageKey: 'tours/aa/x.png', isCover: true }).expect(201);
    await http.post(`/api/v1/admin/tours/${state.tourId}/publish`).set(as('operator')).send({ version: 2 }).expect(200);
    await http.post(`/api/v1/admin/tours/${state.tourId}/rates`).set(as('operator')).send({ paxType: 'adult', residency: 'foreign', currency: 'USD', amount: 10_000, validFrom: today, validTo: addDays(today, 365) }).expect(201);
    await http.post(`/api/v1/admin/tours/${state.tourId}/departures/bulk`).set(as('operator')).send({ from: addDays(today, 20), to: addDays(today, 22), weekdays: [1, 2, 3, 4, 5, 6, 7], capacity: 10 }).expect(201);
    const cart = await http.post('/api/v1/carts').send({ currency: 'USD', locale: 'en' }).expect(201);
    await http.post(`/api/v1/carts/${cart.body.data.cart.id}/items`).set('X-Cart-Token', cart.body.data.token).send({ tourId: state.tourId, travelDate: addDays(today, 21), pax: [{ paxType: 'adult', residency: 'foreign', quantity: 2 }] }).expect(201);
    const b = await http
      .post('/api/v1/bookings')
      .set('X-Cart-Token', cart.body.data.token)
      .set('Idempotency-Key', randomUUID())
      .send({ cartId: cart.body.data.cart.id, paymentOption: 'deposit', customer: { email: 's3.void@example.com', firstName: 'Val', lastName: 'Void' }, acceptTerms: true, acceptPrivacyPolicy: true })
      .expect(201);
    state.booking = { code: b.body.data.code, token: b.body.data.accessToken, total: b.body.data.total.amount };
  }

  it('pagos manuales del día y anulación con contra-asiento (solo admin)', async () => {
    await prepareTour();
    const cal = await http.get(`/api/v1/tours/s3-void-tour/departures?currency=USD`).expect(200);
    expect(cal.body.data[0]).toMatchObject({ available: 10, isClosed: false, bookable: true, priceFrom: { amount: 10_000, currency: 'USD' } });
    const deposit = Math.ceil(state.booking.total / 2);
    const paid = await http.post(`/api/v1/admin/bookings/${state.booking.code}/payments`).set(as('agent')).set('Idempotency-Key', randomUUID()).send({ amount: deposit, method: 'cash', reference: 'REC-S3-1' }).expect(201);
    state.paymentId = paid.body.data.paymentId;
    const day = await http.get(`/api/v1/admin/manual-payments?date=${today}`).set(as('agent')).expect(200);
    expect(day.body.data.items.map((i: { id: string }) => i.id)).toContain(state.paymentId);
    expect(day.body.data.byUser.some((u: { user: { fullName: string } }) => u.user.fullName === 'S3 agent')).toBe(true);

    const path = `/api/v1/admin/bookings/${state.booking.code}/payments/${state.paymentId}/void`;
    await http.post(path).set(as('operator')).send({ reason: 'Registrado por error' }).expect(403);
    const voided = await http.post(path).set(as('admin')).send({ reason: 'Registrado por error' }).expect(200);
    expect(voided.body.data).toMatchObject({ bookingStatus: 'confirmed', paid: { amount: 0 } });
    await http.post(path).set(as('admin')).send({ reason: 'otra vez' }).expect(409).expect(({ body }) => expect(body.code).toBe('payment-already-voided'));
    const rows = await prisma.payment.findMany({ where: { booking: { code: state.booking.code } }, orderBy: { createdAt: 'asc' } });
    expect(rows).toHaveLength(2);
    expect(rows[1]).toMatchObject({ kind: 'refund', isReversal: true, parentPaymentId: state.paymentId });
    expect(await prisma.auditLog.count({ where: { action: 'PAYMENT_VOIDED_MANUAL', entityId: state.paymentId } })).toBe(1);
    // El correcto se puede registrar otra vez (el anulado ya no cuenta como "el" adelanto).
    await http.post(`/api/v1/admin/bookings/${state.booking.code}/payments`).set(as('agent')).set('Idempotency-Key', randomUUID()).send({ amount: deposit, method: 'cash', reference: 'REC-S3-2' }).expect(201);
  });

  it('F0 en PostgreSQL: enlace al correo en inglés, canje único (410) y voucher con enlace mágico', async () => {
    await http.post('/api/v1/bookings/access-link').send({ code: state.booking.code, email: 's3.void@example.com' }).expect(202);
    await relay.runOnce();
    const email = [...mail.sent].reverse().find((m) => m.template === 'booking-access-link')!;
    const token = /token=([A-Za-z0-9_-]{43})/.exec(email.text)![1]!;
    expect(email.text).toContain('https://web.pwt.test/en/reserva/acceso?token=');
    const ex = await http.post('/api/v1/bookings/access-link/exchange').send({ token }).expect(200);
    await http.get(`/api/v1/bookings/${state.booking.code}`).set('X-Booking-Token', ex.body.data.accessToken).expect(200);
    await http.post('/api/v1/bookings/access-link/exchange').send({ token }).expect(410);
    const stored = await prisma.accessToken.findMany({ where: { purpose: { in: ['booking_link', 'booking_session'] } } });
    expect(stored.every((r) => !r.tokenHash.includes(token))).toBe(true);
    // El pago manual generó la confirmación/voucher con enlace mágico (no /reserva/CODE).
    const received = mail.sent.find((m) => m.template === 'booking-confirmation' && m.text.includes(state.booking.code));
    expect(received?.text).toMatch(/\/en\/reserva\/acceso\?token=[A-Za-z0-9_-]{43}/);
    expect(received?.text).not.toContain(`/reserva/${state.booking.code}`);
  });
});
