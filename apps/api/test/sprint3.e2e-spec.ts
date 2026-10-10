import { randomUUID } from 'node:crypto';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import type { OutboxRelay as OutboxRelayType } from '../src/modules/notifications/application/outbox-relay.js';
import type { MemoryMailTransport } from '../src/modules/notifications/infrastructure/mail-transports.js';
import { addDays, toLimaCalendarDate } from '../src/shared/domain/calendar-date.js';

/** Token del último correo enviado con la plantilla indicada (`?token=` del enlace). */
function tokenFrom(mail: MemoryMailTransport, template: string): string {
  const email = [...mail.sent].reverse().find((m) => m.template === template);
  const match = email ? /[?&]token=([A-Za-z0-9_-]{43})/.exec(email.text) : null;
  if (!match) throw new Error(`sin enlace en ${template}`);
  return match[1]!;
}

describe('Sprint 3 en modo seed (e2e): enlaces mágicos, i18n, contenido', () => {
  let app: INestApplication<App>;
  let http: ReturnType<typeof request>;
  let relay: OutboxRelayType;
  let mail: MemoryMailTransport;
  const booking = { code: '', token: '', email: 'sprint3@example.com' };

  beforeAll(async () => {
    Object.assign(process.env, {
      NODE_ENV: 'test',
      DATA_SOURCE: 'seed',
      DEMO_PRICING: 'true',
      SEED_DATA_DIR: '../../data/seed',
      SANDBOX_WEBHOOK_SECRET: 'e2e-only-webhook-secret-0123456789',
      THROTTLE_STRICT_LIMIT: '200',
      THROTTLE_LINK_LIMIT: '50',
      OUTBOX_RELAY_ENABLED: 'false',
      MAIL_TRANSPORT: 'memory',
      PUBLIC_WEB_BASE_URL: 'https://web.pwt.test',
      AGENCY_INBOX_EMAIL: 'agencia@pwt.test',
    });
    const { AppModule } = await import('../src/app.module.js');
    const { configureApp } = await import('../src/app.setup.js');
    const { OutboxRelay } = await import('../src/modules/notifications/application/outbox-relay.js');
    const { MAIL_TRANSPORT } = await import('../src/shared/application/tokens.js');
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication({ rawBody: true });
    configureApp(app);
    await app.init();
    http = request(app.getHttpServer());
    relay = app.get(OutboxRelay);
    mail = app.get<MemoryMailTransport>(MAIL_TRANSPORT);

    // Reserva de apoyo (checkout completo en memoria).
    const list = await http.get('/api/v1/tours?pageSize=50&currency=USD').expect(200);
    const tour = list.body.data.find((t: { bookable: boolean }) => t.bookable);
    const cart = await http.post('/api/v1/carts').send({ currency: 'USD', locale: 'en' }).expect(201);
    const { token, cart: c } = cart.body.data;
    const travelDate = addDays(toLimaCalendarDate(new Date()), 40);
    const added = await http
      .post(`/api/v1/carts/${c.id}/items`)
      .set('X-Cart-Token', token)
      .send({ tourId: tour.id, travelDate, pax: [{ paxType: 'adult', residency: 'foreign', quantity: tour.minPax }] })
      .expect(201);
    const created = await http
      .post('/api/v1/bookings')
      .set('X-Cart-Token', token)
      .set('Idempotency-Key', randomUUID())
      .send({ cartId: c.id, paymentOption: 'full', customer: { email: booking.email, firstName: 'Sam', lastName: 'Lee' }, acceptTerms: true, acceptPrivacyPolicy: true, expectedTotalAmount: added.body.data.cart.total.amount })
      .expect(201);
    Object.assign(booking, { code: created.body.data.code, token: created.body.data.accessToken });
    expect(created.body.data.locale).toBe('en');
  });

  afterAll(async () => {
    await app?.close();
  });

  it('I6: GET /tours?locale=en nunca da 0 y marca locale/fallback; 301 por slug de otro idioma', async () => {
    const en = await http.get('/api/v1/tours?locale=en&pageSize=50').expect(200);
    expect(en.body.meta.total).toBeGreaterThan(0);
    expect(en.body.meta.locale).toBe('en');
    for (const t of en.body.data) expect(['en', 'es']).toContain(t.locale);
    const translated = en.body.data.find((t: { fallback: boolean }) => !t.fallback);
    if (translated) {
      const detail = await http.get(`/api/v1/tours/${translated.slug}?locale=en`).expect(200);
      const es = detail.body.data.alternateLocales.find((a: { locale: string }) => a.locale === 'es');
      const redirect = await http.get(`/api/v1/tours/${es.slug}?locale=en`).expect(301);
      expect(redirect.body.data.redirect).toEqual({ slug: translated.slug, locale: 'en' });
      // Y al revés: slug en con locale=es -> 301 al slug es.
      await http.get(`/api/v1/tours/${translated.slug}?locale=es`).expect(301);
    }
  });

  it('destinos/categorías por slug, blog y testimonios públicos con la misma regla de idioma', async () => {
    const dest = await http.get('/api/v1/destinations?locale=en').expect(200);
    const d = dest.body.data[0];
    expect(d).toMatchObject({ locale: expect.any(String), fallback: expect.any(Boolean) });
    await http.get(`/api/v1/destinations/${d.slug}?locale=en`).expect(200);
    if (d.slug !== d.canonicalSlug) await http.get(`/api/v1/destinations/${d.canonicalSlug}?locale=en`).expect(301);
    await http.get('/api/v1/destinations/no-existe').expect(404).expect(({ body }) => expect(body.code).toBe('destination-not-found'));
    const cats = await http.get('/api/v1/categories?locale=en').expect(200);
    await http.get(`/api/v1/categories/${cats.body.data[0].slug}?locale=en`).expect(200);

    const blog = await http.get('/api/v1/blog?locale=en&pageSize=2').expect(200);
    expect(blog.body.meta.total).toBeGreaterThan(0);
    const post = await http.get(`/api/v1/blog/${blog.body.data[0].slug}?locale=en`).expect(200);
    expect(typeof post.body.data.body).toBe('string');
    await http.get('/api/v1/blog/no-existe').expect(404);

    const testimonials = await http.get('/api/v1/testimonials?allLocales=true').expect(200);
    for (const t of testimonials.body.data) expect(t).not.toHaveProperty('email');
  });

  it('F2: testimonio queda pendiente; rechaza URLs/HTML y exige consentimiento', async () => {
    const ok = { authorName: 'Ana Q.', rating: 5, body: 'Un viaje inolvidable al lago Titicaca, muy bien organizado.', publishConsent: true, consentPrivacyNotice: true };
    await http.post('/api/v1/testimonials').send(ok).expect(202).expect(({ body }) => expect(body.data.status).toBe('pending'));
    await http.post('/api/v1/testimonials').send({ ...ok, body: 'Visiten https://spam.example.com para ofertas increíbles' }).expect(400);
    await http.post('/api/v1/testimonials').send({ ...ok, body: 'Muy bueno <script>alert(1)</script> de verdad, gracias' }).expect(400);
    await http.post('/api/v1/testimonials').send({ ...ok, publishConsent: false }).expect(400);
  });

  it('F3: contacto guarda, avisa a la agencia y envía acuse al cliente', async () => {
    await http.post('/api/v1/contact').send({ name: 'Leo', email: 'leo@example.com', subject: 'Consulta', message: 'Hola', consentPrivacyNotice: true }).expect(400);
    await http
      .post('/api/v1/contact')
      .send({ name: 'Leo', email: 'Leo@Example.com', phone: '+51987654321', subject: 'Viaje en familia', message: 'Quisiera cotizar un tour para 4 personas en mayo.', consentPrivacyNotice: true })
      .expect(201);
    await relay.runOnce();
    const agency = mail.sent.find((m) => m.template === 'contact-agency');
    expect(agency?.to).toEqual(['agencia@pwt.test']);
    expect(agency?.replyTo).toBe('leo@example.com');
    expect(agency?.text).toContain('+51987654321');
    const ack = mail.sent.find((m) => m.template === 'contact-acknowledgment');
    expect(ack?.to).toEqual(['leo@example.com']);
    expect(ack?.text).not.toContain('4 personas');
  });

  it('F0/F0b: 202 genérico, enlace de un solo uso, nuevo accessToken y 410 al reusar', async () => {
    const generic = { data: { status: 'accepted' } };
    await http.post('/api/v1/bookings/access-link').send({ code: 'PWT-2026-999999', email: booking.email }).expect(202).expect(({ body }) => expect(body).toMatchObject(generic));
    await http.post('/api/v1/bookings/access-link').send({ code: booking.code, email: 'otro@example.com' }).expect(202).expect(({ body }) => expect(body).toMatchObject(generic));
    const before = mail.sent.length;
    await relay.runOnce();
    expect(mail.sent.length).toBe(before); // nada que enviar

    await http.post('/api/v1/bookings/access-link').send({ code: booking.code.toLowerCase(), email: booking.email.toUpperCase() }).expect(202);
    await relay.runOnce();
    const email = [...mail.sent].reverse().find((m) => m.template === 'booking-access-link')!;
    expect(email.text).toContain('https://web.pwt.test/en/reserva/acceso?token=');
    expect(email.subject).toContain('access link');
    expect(email.text).not.toContain(booking.token);
    const linkToken = tokenFrom(mail, 'booking-access-link');

    const exchanged = await http.post('/api/v1/bookings/access-link/exchange').send({ token: linkToken }).expect(200);
    expect(exchanged.body.data).toMatchObject({ code: booking.code, locale: 'en' });
    const accessToken = exchanged.body.data.accessToken as string;
    expect(accessToken).not.toBe(booking.token);
    await http.get(`/api/v1/bookings/${booking.code}`).set('X-Booking-Token', accessToken).expect(200);
    await http.get(`/api/v1/bookings/${booking.code}`).set('X-Booking-Token', booking.token).expect(200); // el original sigue
    await http.post('/api/v1/bookings/access-link/exchange').send({ token: linkToken }).expect(410).expect(({ body }) => expect(body.code).toBe('access-link-expired'));
    await http.post('/api/v1/bookings/access-link/exchange').send({ token: 'x'.repeat(43) }).expect(404);
  });

  it('F6: login sin contraseña, /me, /me/bookings, acceso a la reserva y logout revocable', async () => {
    await http.post('/api/v1/customers/login-link').send({ email: 'nadie@example.com' }).expect(202);
    await http.post('/api/v1/customers/login-link').send({ email: booking.email }).expect(202);
    await relay.runOnce();
    const linkToken = tokenFrom(mail, 'customer-login-link');
    const session = await http.post('/api/v1/customers/login-link/exchange').send({ token: linkToken }).expect(200);
    const token = session.body.data.sessionToken as string;
    await http.get('/api/v1/me').expect(401).expect(({ body }) => expect(body.code).toBe('customer-session-required'));
    const me = await http.get('/api/v1/me').set('X-Customer-Token', token).expect(200);
    expect(me.body.data.email).toBe(booking.email);
    const mine = await http.get('/api/v1/me/bookings').set('X-Customer-Token', token).expect(200);
    expect(mine.body.data.map((b: { code: string }) => b.code)).toContain(booking.code);
    const grant = await http.post(`/api/v1/me/bookings/${booking.code}/access`).set('X-Customer-Token', token).expect(200);
    await http.get(`/api/v1/bookings/${booking.code}`).set('X-Booking-Token', grant.body.data.accessToken).expect(200);
    await http.post('/api/v1/me/bookings/PWT-2026-999999/access').set('X-Customer-Token', token).expect(404);
    await http.post('/api/v1/me/logout').set('X-Customer-Token', token).send({}).expect(204);
    await http.get('/api/v1/me').set('X-Customer-Token', token).expect(401);
  });

  it('W6/F9: calendario con available, isClosed, bookable y priceFrom por fecha (máx. 180 días)', async () => {
    const list = await http.get('/api/v1/tours?pageSize=50').expect(200);
    const tour = list.body.data.find((t: { bookable: boolean }) => t.bookable);
    const today = toLimaCalendarDate(new Date());
    const res = await http.get(`/api/v1/tours/${tour.slug}/departures?currency=PEN`).expect(200);
    expect(res.body.data.length).toBeGreaterThan(0);
    expect(res.body.data[0]).toMatchObject({ available: expect.any(Number), isClosed: expect.any(Boolean), bookable: expect.any(Boolean) });
    expect(res.body.data.some((d: { priceFrom: unknown }) => d.priceFrom !== null)).toBe(true);
    await http.get(`/api/v1/tours/${tour.slug}/departures?from=${today}&to=${addDays(today, 181)}`).expect(400);
  });

  it('I10: errores genéricos con código en inglés', async () => {
    await http.get('/api/v1/no-existe').expect(404).expect(({ body }) => expect(body.code).toBe('not-found'));
  });
});
