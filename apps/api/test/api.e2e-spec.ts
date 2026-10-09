import { createHmac, randomUUID } from 'node:crypto';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import { addDays, toLimaCalendarDate } from '../src/shared/domain/calendar-date.js';

const WEBHOOK_SECRET = 'e2e-only-webhook-secret-0123456789';
const STRICT_LIMIT = 40;

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
      WEB_ORIGIN: 'http://localhost:3000',
      THROTTLE_STRICT_LIMIT: String(STRICT_LIMIT),
      BODY_LIMIT_KB: '16',
      OUTBOX_RELAY_ENABLED: 'false',
      MAIL_TRANSPORT: 'memory',
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
    expect(Object.keys(res.body.paths)).toEqual(expect.arrayContaining(['/api/v1/tours', '/api/v1/bookings', '/api/v1/payments/webhooks/{provider}', '/api/v1/complaints', '/api/v1/complaints/{code}']));
    await http.get('/api/docs').expect(200);
  });

  it('lista tours paginados con precio desde en céntimos (number) y cabeceras de seguridad', async () => {
    const res = await http.get('/api/v1/tours?pageSize=5&currency=USD').expect(200);
    expect(res.body.meta).toMatchObject({ page: 1, pageSize: 5, total: 41, totalPages: 9 });
    expect(res.body.data).toHaveLength(5);
    expect(typeof res.body.data[0].priceFrom.amount).toBe('number');
    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['x-powered-by']).toBeUndefined();
    // helmet: CSP restrictiva en la API, HSTS, sin framing.
    expect(res.headers['content-security-policy']).toContain("default-src 'none'");
    expect(res.headers['content-security-policy']).toContain("frame-ancestors 'none'");
    expect(res.headers['strict-transport-security']).toContain('max-age=');
    expect(res.headers['x-frame-options']).toBe('DENY');
    expect(res.headers['referrer-policy']).toBe('no-referrer');
    // Rate limiting global informado en cabeceras.
    expect(res.headers['x-ratelimit-limit']).toBe('300');
  });

  it('CORS: solo los orígenes de WEB_ORIGIN; sin Origin (servidor a servidor) no aplica', async () => {
    const ok = await http.options('/api/v1/bookings').set('Origin', 'http://localhost:3000').set('Access-Control-Request-Method', 'POST').set('Access-Control-Request-Headers', 'x-booking-token,idempotency-key');
    expect(ok.headers['access-control-allow-origin']).toBe('http://localhost:3000');
    expect(ok.headers['access-control-allow-headers']).toContain('X-Booking-Token');
    const evil = await http.get('/api/v1/health').set('Origin', 'https://evil.example');
    expect(evil.headers['access-control-allow-origin']).toBeUndefined();
    const server = await http.get('/api/v1/health').expect(200);
    expect(server.headers['access-control-allow-origin']).toBeUndefined();
  });

  it('cuerpo mayor que BODY_LIMIT_KB => 413 problem+json; JSON inválido => 400', async () => {
    const big = await http.post('/api/v1/carts').set('content-type', 'application/json').send(JSON.stringify({ currency: 'USD', pad: 'x'.repeat(20 * 1024) })).expect(413);
    expect(big.headers['content-type']).toContain('application/problem+json');
    expect(big.body).toMatchObject({ status: 413, code: 'payload-too-large' });
    const bad = await http.post('/api/v1/carts').set('content-type', 'application/json').send('{"currency":').expect(400);
    expect(bad.body.code).toBe('malformed-body');
  });

  it('Swagger UI con su propia CSP (scripts del mismo origen)', async () => {
    const res = await http.get('/api/docs').expect(200);
    expect(res.headers['content-security-policy']).toContain("script-src 'self'");
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
    expect(booking.accessToken).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(created.headers['location']).toBe(`/api/v1/bookings/${booking.code}`);
    expect(created.headers['cache-control']).toBe('no-store');
    const replay = await http.post('/api/v1/bookings').set('X-Cart-Token', token).set('Idempotency-Key', key).send(checkoutBody).expect(200);
    expect(replay.headers['idempotent-replayed']).toBe('true');
    expect(replay.body.data.id).toBe(booking.id);
    // El replay rota el token: el primero deja de servir (404 genérico).
    const bookingToken: string = replay.body.data.accessToken;
    expect(bookingToken).not.toBe(booking.accessToken);
    await http.get(`/api/v1/bookings/${booking.code}`).set('X-Booking-Token', booking.accessToken).expect(404);
    await http.post('/api/v1/bookings').set('X-Cart-Token', 'otro').set('Idempotency-Key', key).send(checkoutBody).expect(404);

    // Acceso por código + X-Booking-Token; sin token 401; token ajeno o código inexistente => mismo 404.
    const byCode = await http.get(`/api/v1/bookings/${booking.code}`).set('X-Booking-Token', bookingToken).expect(200);
    expect(byCode.body.data).toMatchObject({ id: booking.id, code: booking.code, status: 'held' });
    expect(byCode.body.data).not.toHaveProperty('accessToken');
    const noToken = await http.get(`/api/v1/bookings/${booking.code}`).expect(401);
    expect(noToken.body.code).toBe('booking-token-required');
    const wrong = await http.get(`/api/v1/bookings/${booking.code}`).set('X-Booking-Token', 'A'.repeat(43)).expect(404);
    const unknown = await http.get('/api/v1/bookings/PWT-2099-999999').set('X-Booking-Token', bookingToken).expect(404);
    const byUuid = await http.get(`/api/v1/bookings/${booking.id}`).set('X-Booking-Token', bookingToken).expect(404);
    for (const r of [wrong, unknown, byUuid]) {
      expect(r.body).toMatchObject({ code: 'booking-not-found', detail: 'Reserva no encontrada.' });
      expect(r.body).not.toHaveProperty('details');
    }
    await http
      .post('/api/v1/bookings')
      .set('X-Cart-Token', token)
      .set('Idempotency-Key', key)
      .send({ ...checkoutBody, paymentOption: 'full' })
      .expect(422);

    const payKey = randomUUID();
    const pay = await http.post(`/api/v1/bookings/${booking.code}/payments`).set('X-Booking-Token', bookingToken).set('Idempotency-Key', payKey).send({ method: 'card' }).expect(201);
    expect(pay.body.data.nextAction.type).toBe('redirect');
    const payment = pay.body.data.payment;
    expect(payment.amount.amount).toBe(booking.nextPayment.amount.amount);
    await http.post(`/api/v1/bookings/${booking.code}/payments`).set('X-Booking-Token', bookingToken).set('Idempotency-Key', payKey).send({ method: 'card' }).expect(200);

    // El proveedor aprueba (sandbox) y notifica por webhook firmado.
    const providerPaymentId = pay.body.data.nextAction.url.split('/').pop();
    const gatewayState = await http.post(`/api/v1/bookings/${booking.code}/payments/${payment.id}/confirm`).set('X-Booking-Token', bookingToken).send({ confirmation: { simulate: 'succeed' } }).expect(200);
    expect(gatewayState.body.data.status).toBe('succeeded');
    const body = JSON.stringify({ id: `evt_${randomUUID()}`, type: 'payment.succeeded', data: { providerPaymentId, status: 'succeeded', amount: payment.amount.amount, currency: payment.amount.currency } });
    const w1 = await http.post('/api/v1/payments/webhooks/sandbox').set(signed(body)).send(body).expect(200);
    const w2 = await http.post('/api/v1/payments/webhooks/sandbox').set(signed(body)).send(body).expect(200);
    expect(w1.body.status).toBe('processed');
    expect(w2.body.status).toBe('duplicate');
    await http.post('/api/v1/payments/webhooks/sandbox').set({ 'x-sandbox-signature': 't=1,v1=00', 'content-type': 'application/json' }).send(body).expect(401);

    const afterDeposit = await http.get(`/api/v1/bookings/${booking.code}`).set('X-Booking-Token', bookingToken).expect(200);
    expect(afterDeposit.body.data.status).toBe(paymentOption === 'deposit' ? 'partially_paid' : 'paid');

    if (paymentOption === 'deposit') {
      const balance = await http.post(`/api/v1/bookings/${booking.code}/payments`).set('X-Booking-Token', bookingToken).set('Idempotency-Key', randomUUID()).send({}).expect(201);
      expect(balance.body.data.payment.kind).toBe('balance');
      await http.post(`/api/v1/bookings/${booking.code}/payments/${balance.body.data.payment.id}/confirm`).set('X-Booking-Token', bookingToken).send({}).expect(200);
      const paid = await http.get(`/api/v1/bookings/${booking.code}`).set('X-Booking-Token', bookingToken).expect(200);
      expect(paid.body.data).toMatchObject({ status: 'paid', outstanding: { amount: 0, currency: 'USD' } });
    }
    const again = await http.post(`/api/v1/bookings/${booking.code}/payments`).set('X-Booking-Token', bookingToken).set('Idempotency-Key', randomUUID()).send({}).expect(409);
    expect(again.body.code).toBe('booking-already-paid');

    const listed = await http.get(`/api/v1/bookings/${booking.code}/payments`).set('X-Booking-Token', bookingToken).expect(200);
    expect(listed.body.data.length).toBeGreaterThanOrEqual(1);
    expect(listed.body.data[0]).toMatchObject({ id: payment.id, provider: 'sandbox', status: 'succeeded' });
    await http.get(`/api/v1/bookings/${booking.code}/payments/${payment.id}`).set('X-Booking-Token', bookingToken).expect(200);
    await http.get(`/api/v1/bookings/${booking.code}/payments`).set('X-Booking-Token', 'B'.repeat(43)).expect(404);
    await http.post(`/api/v1/bookings/${booking.code}/payments`).set('Idempotency-Key', randomUUID()).send({}).expect(401);
    // Rutas sin token de la versión anterior ya no existen.
    await http.get(`/api/v1/payments/${payment.id}`).expect(404);
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

  it('Libro de Reclamaciones: registro sin cuenta, constancia, idempotencia y consulta con token', async () => {
    const body = {
      consumer: { fullName: 'Ana Quispe', docType: 'dni', docNumber: '45678912', address: 'Jr. Lima 123, Puno', phone: '+51987654321', email: 'Ana@Example.com', isMinor: false },
      good: { type: 'service', claimedAmount: 45000, currency: 'PEN', description: 'Tour Uros y Taquile' },
      declaredType: 'reclamo',
      detail: 'El tour no incluyó el almuerzo ofrecido en la ficha.',
      consumerRequest: 'Devolución parcial del monto.',
      responseChannel: 'email',
      conformityAccepted: true,
    };
    // Datos mínimos faltantes => 400 con campos; no se crea hoja.
    const invalid = await http
      .post('/api/v1/complaints')
      .set('Idempotency-Key', randomUUID())
      .send({ ...body, consumer: { ...body.consumer, fullName: '', email: 'no-es-correo' }, conformityAccepted: false })
      .expect(400);
    expect(invalid.headers['content-type']).toContain('application/problem+json');
    expect(invalid.body.errors.map((e: { field: string }) => e.field)).toEqual(expect.arrayContaining(['consumer.fullName', 'consumer.email', 'conformityAccepted']));
    // Regla de dominio (menor sin representante): mismo formato de errores.
    const minor = await http
      .post('/api/v1/complaints')
      .set('Idempotency-Key', randomUUID())
      .send({ ...body, consumer: { ...body.consumer, isMinor: true } })
      .expect(400);
    expect(minor.body).toMatchObject({ code: 'validation-failed', errors: [{ field: 'guardian' }] });
    await http.post('/api/v1/complaints').send(body).expect(400); // sin Idempotency-Key

    const key = randomUUID();
    const created = await http.post('/api/v1/complaints').set('Idempotency-Key', key).send(body).expect(201);
    const receipt = created.body.data;
    expect(receipt.code).toMatch(/^LR-\d{4}-\d{6}$/);
    expect(receipt.sheetNumber).toMatch(/^\d{9}-\d{4}$/);
    expect(Date.parse(receipt.responseDueAt)).toBeGreaterThan(Date.parse(receipt.createdAt) + 14 * 86_400_000);
    expect(receipt.accessToken).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(created.headers['cache-control']).toBe('no-store');

    const replay = await http.post('/api/v1/complaints').set('Idempotency-Key', key).send(body).expect(200);
    expect(replay.headers['idempotent-replayed']).toBe('true');
    expect(replay.body.data.code).toBe(receipt.code);
    const token: string = replay.body.data.accessToken;

    const sheet = await http.get(`/api/v1/complaints/${receipt.code}`).set('X-Complaint-Token', token).expect(200);
    expect(sheet.body.data).toMatchObject({
      code: receipt.code,
      status: 'received',
      type: 'reclamo',
      consumer: { docNumber: '45678912', email: 'ana@example.com', phone: '+51987654321' },
      good: { claimedAmount: { amount: 45000, currency: 'PEN' } },
      provider: { legalName: 'POR CONFIRMAR', establishmentCode: 'WEB' },
      answer: null,
    });
    expect(sheet.body.data.legalNotices).toHaveLength(2);
    await http.get(`/api/v1/complaints/${receipt.code}`).set('X-Complaint-Token', receipt.accessToken).expect(404);
    await http.get(`/api/v1/complaints/${receipt.code}`).expect(401);
    const unknown = await http.get('/api/v1/complaints/LR-2099-000001').set('X-Complaint-Token', token).expect(404);
    expect(unknown.body).toMatchObject({ code: 'complaint-not-found' });
    expect(unknown.body).not.toHaveProperty('details');
  });

  it('rate limiting estricto en POST /bookings: 429 problem+json con Retry-After', async () => {
    let res: request.Response | undefined;
    for (let i = 0; i <= STRICT_LIMIT; i += 1) {
      res = await http.post('/api/v1/bookings').send({});
      if (res.status === 429) break;
    }
    expect(res?.status).toBe(429);
    expect(res?.headers['content-type']).toContain('application/problem+json');
    expect(res?.body).toMatchObject({ status: 429, code: 'demasiadas-solicitudes' });
    expect(Number(res?.headers['retry-after-strict'])).toBeGreaterThan(0);
    // El límite global sigue permitiendo lecturas.
    await http.get('/api/v1/health').expect(200);
    await http.get('/api/v1/categories').expect(200);
  });
});
