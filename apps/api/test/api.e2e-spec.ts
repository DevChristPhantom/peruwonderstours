import { createHmac, randomUUID } from 'node:crypto';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import { addDays, toLimaCalendarDate } from '../src/shared/domain/calendar-date.js';

const WEBHOOK_SECRET = 'e2e-only-webhook-secret-0123456789';

function signed(body: string): Record<string, string> {
  const t = Math.floor(Date.now() / 1000);
  const v1 = createHmac('sha256', WEBHOOK_SECRET).update(`${t}.${body}`).digest('hex');
  return { 'x-sandbox-signature': `t=${t},v1=${v1}`, 'content-type': 'application/json' };
}

describe('API v1 en modo seed (e2e)', () => {
  let app: INestApplication<App>;
  let http: ReturnType<typeof request>;

  beforeAll(async () => {
    Object.assign(process.env, {
      NODE_ENV: 'test',
      DATA_SOURCE: 'seed',
      DEMO_PRICING: 'true',
      SEED_DATA_DIR: '../../data/seed',
      SANDBOX_WEBHOOK_SECRET: WEBHOOK_SECRET,
      SWAGGER_ENABLED: 'true',
      CORS_ORIGINS: 'http://localhost:3000',
    });
    // Import diferido: ConfigModule.forRoot lee el entorno al importar el módulo.
    const { AppModule } = await import('../src/app.module.js');
    const { configureApp } = await import('../src/app.setup.js');
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication({ rawBody: true });
    configureApp(app);
    await app.init();
    http = request(app.getHttpServer());
  });

  afterAll(async () => {
    await app?.close();
  });

  it('health y readiness', async () => {
    await http.get('/api/v1/health').expect(200).expect(({ body }) => expect(body).toMatchObject({ status: 'ok', dataSource: 'seed' }));
    await http.get('/api/v1/health/ready').expect(200);
  });

  it('Swagger publica OpenAPI en /api/docs', async () => {
    const res = await http.get('/api/docs/openapi.json').expect(200);
    expect(Object.keys(res.body.paths)).toEqual(expect.arrayContaining(['/api/v1/tours', '/api/v1/bookings', '/api/v1/payments/webhooks/{provider}']));
    await http.get('/api/docs').expect(200);
  });

  it('lista tours paginados con precio desde en céntimos (number) y cabeceras de seguridad', async () => {
    const res = await http.get('/api/v1/tours?pageSize=5&currency=USD').expect(200);
    expect(res.body.meta).toMatchObject({ page: 1, pageSize: 5, total: 41, totalPages: 9 });
    expect(res.body.data).toHaveLength(5);
    expect(typeof res.body.data[0].priceFrom.amount).toBe('number');
    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['x-powered-by']).toBeUndefined();
  });

  it('busca tolerante a tildes/typos y filtra por destino y categoría', async () => {
    const search = await http.get('/api/v1/tours').query({ q: 'machupichu' }).expect(200);
    expect(search.body.meta.total).toBeGreaterThan(0);
    expect(search.body.data[0].title.toLowerCase()).toContain('machu');
    const byDestination = await http.get('/api/v1/tours').query({ destination: 'tours-en-puno', pageSize: 50 }).expect(200);
    expect(byDestination.body.meta.total).toBeGreaterThan(0);
    const byCategory = await http.get('/api/v1/tours').query({ category: 'full-days', sort: 'price_asc', pageSize: 50 }).expect(200);
    const prices = byCategory.body.data.map((t: { priceFrom: { amount: number } }) => t.priceFrom.amount);
    expect(prices).toEqual([...prices].sort((a: number, b: number) => a - b));
    const none = await http.get('/api/v1/tours').query({ destination: 'no-existe' }).expect(200);
    expect(none.body).toMatchObject({ data: [], meta: { total: 0 } });
  });

  it('destinos y categorías con conteo', async () => {
    const d = await http.get('/api/v1/destinations').expect(200);
    expect(d.body.data).toHaveLength(5);
    expect(d.body.data.every((x: { tourCount: number }) => x.tourCount >= 0)).toBe(true);
    const c = await http.get('/api/v1/categories').expect(200);
    expect(c.body.data).toHaveLength(5);
  });

  it('ficha por slug con FAQ e itinerario; 404 problem+json si no existe o no hay traducción', async () => {
    const list = await http.get('/api/v1/tours?pageSize=1').expect(200);
    const slug = list.body.data[0].slug;
    const detail = await http.get(`/api/v1/tours/${slug}`).expect(200);
    expect(detail.body.data).toMatchObject({ slug, locale: 'es' });
    expect(Array.isArray(detail.body.data.itinerary)).toBe(true);
    expect(Array.isArray(detail.body.data.faqs)).toBe(true);

    const missing = await http.get('/api/v1/tours/no-existe').expect(404);
    expect(missing.headers['content-type']).toContain('application/problem+json');
    expect(missing.body).toMatchObject({ status: 404, code: 'tour-not-found', type: 'https://peruwonderstours.com/problems/tour-not-found', instance: '/api/v1/tours/no-existe' });
    await http.get(`/api/v1/tours/${slug}?locale=en`).expect(404);
  });

  it('validación global: 400 con lista de campos y forbidNonWhitelisted', async () => {
    const res = await http.get('/api/v1/tours?pageSize=500&foo=bar').expect(400);
    expect(res.headers['content-type']).toContain('application/problem+json');
    expect(res.body.code).toBe('validation-failed');
    const fields = res.body.errors.map((e: { field: string }) => e.field);
    expect(fields).toEqual(expect.arrayContaining(['pageSize', 'foo']));
    await http.post('/api/v1/carts').send({ currency: 'EUR' }).expect(400);
    await http.get('/api/v1/carts/not-a-uuid').expect(400);
    await http.get('/api/v1/ruta-inexistente').expect(404).expect('content-type', /problem\+json/);
  });

  it('flujo completo: carrito -> opciones -> checkout idempotente -> pago del adelanto -> webhook duplicado -> saldo', async () => {
    const list = await http.get('/api/v1/tours?category=full-days&currency=USD&pageSize=50').expect(200);
    const tour = list.body.data.find((t: { minPax: number; bookable: boolean }) => t.bookable);
    const travelDate = addDays(toLimaCalendarDate(new Date()), 30);

    const cartRes = await http.post('/api/v1/carts').send({ currency: 'USD', locale: 'es' }).expect(201);
    const { token, cart } = cartRes.body.data;
    expect(token).toBeTruthy();
    await http.get(`/api/v1/carts/${cart.id}`).expect(404);

    const add = await http
      .post(`/api/v1/carts/${cart.id}/items`)
      .set('X-Cart-Token', token)
      .send({ tourId: tour.id, travelDate, pax: [{ paxType: 'adult', residency: 'foreign', quantity: tour.minPax }] })
      .expect(201);
    const total = add.body.data.cart.total.amount;
    expect(add.body.data.cart).toMatchObject({ itemCount: 1, canCheckout: true });
    await http
      .post(`/api/v1/carts/${cart.id}/items`)
      .set('X-Cart-Token', token)
      .send({ tourId: tour.id, travelDate, pax: [{ paxType: 'adult', residency: 'foreign', quantity: tour.minPax }] })
      .expect(409);

    const options = await http.get(`/api/v1/carts/${cart.id}/payment-options`).set('X-Cart-Token', token).expect(200);
    const depositAvailable = options.body.data.depositAvailable as boolean;
    const paymentOption = depositAvailable ? 'deposit' : 'full';

    const checkoutBody = {
      cartId: cart.id,
      paymentOption,
      customer: { email: 'e2e@example.com', firstName: 'E2E', lastName: 'Test', country: 'PE' },
      acceptTerms: true,
      acceptPrivacyPolicy: true,
      expectedTotalAmount: total,
    };
    await http.post('/api/v1/bookings').set('X-Cart-Token', token).send(checkoutBody).expect(400); // sin Idempotency-Key
    const key = randomUUID();
    const created = await http.post('/api/v1/bookings').set('X-Cart-Token', token).set('Idempotency-Key', key).send(checkoutBody).expect(201);
    const booking = created.body.data;
    expect(booking).toMatchObject({ status: 'held', paymentOption });
    expect(booking.code).toMatch(/^PWT-\d{4}-\d{6}$/);
    expect(booking).not.toHaveProperty('customer');
    const replay = await http.post('/api/v1/bookings').set('X-Cart-Token', token).set('Idempotency-Key', key).send(checkoutBody).expect(200);
    expect(replay.headers['idempotent-replayed']).toBe('true');
    expect(replay.body.data.id).toBe(booking.id);
    await http
      .post('/api/v1/bookings')
      .set('X-Cart-Token', token)
      .set('Idempotency-Key', key)
      .send({ ...checkoutBody, paymentOption: 'full' })
      .expect(422);

    const payKey = randomUUID();
    const pay = await http.post(`/api/v1/bookings/${booking.id}/payments`).set('Idempotency-Key', payKey).send({ method: 'card' }).expect(201);
    expect(pay.body.data.nextAction.type).toBe('redirect');
    const payment = pay.body.data.payment;
    expect(payment.amount.amount).toBe(booking.nextPayment.amount.amount);
    await http.post(`/api/v1/bookings/${booking.id}/payments`).set('Idempotency-Key', payKey).send({ method: 'card' }).expect(200);

    // El proveedor aprueba (sandbox) y notifica por webhook firmado.
    const providerPaymentId = pay.body.data.nextAction.url.split('/').pop();
    const gatewayState = await http.post(`/api/v1/payments/${payment.id}/confirm`).send({ confirmation: { simulate: 'succeed' } }).expect(200);
    expect(gatewayState.body.data.status).toBe('succeeded');
    const body = JSON.stringify({ id: `evt_${randomUUID()}`, type: 'payment.succeeded', data: { providerPaymentId, status: 'succeeded' } });
    const w1 = await http.post('/api/v1/payments/webhooks/sandbox').set(signed(body)).send(body).expect(200);
    const w2 = await http.post('/api/v1/payments/webhooks/sandbox').set(signed(body)).send(body).expect(200);
    expect(w1.body.status).toBe('processed');
    expect(w2.body.status).toBe('duplicate');
    await http.post('/api/v1/payments/webhooks/sandbox').set({ 'x-sandbox-signature': 't=1,v1=00', 'content-type': 'application/json' }).send(body).expect(401);

    const afterDeposit = await http.get(`/api/v1/bookings/${booking.id}`).expect(200);
    expect(afterDeposit.body.data.status).toBe(paymentOption === 'deposit' ? 'partially_paid' : 'paid');

    if (paymentOption === 'deposit') {
      const balance = await http.post(`/api/v1/bookings/${booking.id}/payments`).set('Idempotency-Key', randomUUID()).send({}).expect(201);
      expect(balance.body.data.payment.kind).toBe('balance');
      await http.post(`/api/v1/payments/${balance.body.data.payment.id}/confirm`).send({}).expect(200);
      const paid = await http.get(`/api/v1/bookings/${booking.id}`).expect(200);
      expect(paid.body.data).toMatchObject({ status: 'paid', outstanding: { amount: 0, currency: 'USD' } });
    }
    const again = await http.post(`/api/v1/bookings/${booking.id}/payments`).set('Idempotency-Key', randomUUID()).send({}).expect(409);
    expect(again.body.code).toBe('booking-already-paid');
  });

  it('salida dentro de 7 días: solo 100 % (422 deposit-not-available)', async () => {
    const list = await http.get('/api/v1/tours?currency=USD&pageSize=50&category=full-days').expect(200);
    const tour = list.body.data.find((t: { bookable: boolean }) => t.bookable);
    const travelDate = addDays(toLimaCalendarDate(new Date()), 3);
    const { body } = await http.post('/api/v1/carts').send({ currency: 'USD' }).expect(201);
    await http
      .post(`/api/v1/carts/${body.data.cart.id}/items`)
      .set('X-Cart-Token', body.data.token)
      .send({ tourId: tour.id, travelDate, pax: [{ paxType: 'adult', residency: 'foreign', quantity: tour.minPax }] })
      .expect(201);
    const options = await http.get(`/api/v1/carts/${body.data.cart.id}/payment-options`).set('X-Cart-Token', body.data.token).expect(200);
    expect(options.body.data).toMatchObject({ depositAvailable: false, depositUnavailableReason: 'departure_too_close' });
    const res = await http
      .post('/api/v1/bookings')
      .set('X-Cart-Token', body.data.token)
      .set('Idempotency-Key', randomUUID())
      .send({
        cartId: body.data.cart.id,
        paymentOption: 'deposit',
        customer: { email: 'near@example.com', firstName: 'N', lastName: 'T' },
        acceptTerms: true,
        acceptPrivacyPolicy: true,
      })
      .expect(422);
    expect(res.body.code).toBe('deposit-not-available');
  });
});
