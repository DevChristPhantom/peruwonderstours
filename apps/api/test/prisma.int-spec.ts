import 'dotenv/config';
import { randomUUID } from 'node:crypto';
import type { PrismaClient } from '../src/generated/prisma/client.js';
import { BookingUseCases } from '../src/modules/booking/application/booking.use-cases.js';
import { CartUseCases } from '../src/modules/cart/application/cart.use-cases.js';
import { PaymentUseCases } from '../src/modules/payments/application/payment.use-cases.js';
import type { PaymentGateway } from '../src/modules/payments/domain/payment-gateway.js';
import { SandboxPaymentGateway, StaticPaymentGatewayRegistry } from '../src/modules/payments/infrastructure/sandbox-payment-gateway.js';
import { createPrismaClient, type PrismaTx } from '../src/persistence/prisma/prisma-client.js';
import { PrismaUnitOfWork, TransactionBoundUnitOfWork } from '../src/persistence/prisma/prisma-unit-of-work.js';
import { addDays, calendarDateToUtcDate, toLimaCalendarDate } from '../src/shared/domain/calendar-date.js';
import { ConcurrencyError } from '../src/shared/domain/domain-error.js';
import { IdempotencyConflictError } from '../src/shared/domain/idempotency.js';
import { ComplaintUseCases } from '../src/modules/complaints/application/complaint.use-cases.js';
import {
  applyDemoPricing,
  deleteDemoPricing,
  DEMO_MARK,
  DEMO_SEASON_CODE,
  DemoPricingInUseError,
} from '../src/database/seed/demo-pricing-seed.js';
import { demoDepartureId } from '../src/modules/catalog/infrastructure/seed/demo-pricing.js';
import { readSeedBundle } from '../src/modules/catalog/infrastructure/seed/seed-files.js';
import { seedDatabaseInTransaction } from '../src/database/seed/seed-database.js';
import { AesGcmPiiCipher, DEVELOPMENT_PII_KEY_BASE64 } from '../src/shared/infrastructure/aes-gcm-pii-cipher.js';
import { PrismaIdempotencyRepository } from '../src/persistence/prisma/prisma-idempotency.repository.js';
import { FixedClock, UuidV7Generator } from '../src/shared/infrastructure/system.js';
import { BOOKING_SETTINGS, CART_SETTINGS, WEBHOOK_SECRET } from './support/fixtures.js';

const url = process.env['DATABASE_URL'];
const describeDb = url ? describe : describe.skip;

class Rollback extends Error {}

describeDb('Repositorios Prisma contra PostgreSQL (transacción revertida)', () => {
  let prisma: PrismaClient;

  beforeAll(async () => {
    prisma = createPrismaClient(url!);
    await prisma.$connect();
    await prisma.$queryRaw`SELECT 1`;
  });

  afterAll(async () => {
    await prisma?.$disconnect();
  });

  async function inRollback(fn: (tx: PrismaTx) => Promise<void>): Promise<void> {
    try {
      await prisma.$transaction(
        async (tx) => {
          await fn(tx);
          throw new Rollback();
        },
        { timeout: 30_000, maxWait: 15_000 },
      );
    } catch (error) {
      if (!(error instanceof Rollback)) throw error;
    }
  }

  async function createBookableTour(tx: PrismaTx, travelDate: string, capacity: number) {
    const slug = `int-test-${randomUUID().slice(0, 8)}`;
    const tour = await tx.tour.create({
      data: {
        slug,
        code: slug.toUpperCase().slice(0, 40),
        type: 'tour',
        status: 'published',
        publishedAt: new Date(),
        durationDays: 1,
        minPax: 1,
        translations: { create: { locale: 'es', slug, title: 'Tour de integración Machu Picchu', summary: 'Prueba en Cusco' } },
      },
    });
    await tx.rate.create({
      data: { tourId: tour.id, paxType: 'adult', residency: 'foreign', currency: 'USD', amount: 10_001n, validFrom: calendarDateToUtcDate('2026-01-01'), validTo: calendarDateToUtcDate('2027-12-31') },
    });
    const departure = await tx.departure.create({ data: { tourId: tour.id, departureDate: calendarDateToUtcDate(travelDate), capacity } });
    return { tour, departure };
  }

  it('catálogo: búsqueda FTS + trigram, filtros, ficha con FAQ y conteos sobre la semilla', async () => {
    await inRollback(async (tx) => {
      await tx.tour.updateMany({ data: { status: 'published', publishedAt: new Date() } });
      const uow = new TransactionBoundUnitOfWork(tx);
      await uow.run(async (repos) => {
        const base = { locale: 'es' as const, currency: 'USD' as const, today: '2026-10-07', sort: 'relevance' as const, page: 1, pageSize: 50 };
        const all = await repos.catalog.searchTours(base);
        expect(all.total).toBeGreaterThanOrEqual(41);
        const search = await repos.catalog.searchTours({ ...base, text: 'cuzco machupichu' });
        expect(search.total).toBeGreaterThan(0);
        expect(search.items.some((i) => /machu/i.test(i.tour.translations[0]!.title))).toBe(true);
        const cusco = await repos.catalog.searchTours({ ...base, destinationSlug: 'cuzco' });
        expect(cusco.total).toBeGreaterThan(0);
        const packages = await repos.catalog.searchTours({ ...base, type: 'package', minDays: 4, sort: 'duration_desc' });
        expect(packages.items.every((i) => (i.tour.durationDays ?? 0) >= 4)).toBe(true);
        const detail = await repos.catalog.findTourBySlug('arequipa-colca-profundo-condores-4d-3n', 'es');
        expect(detail?.translations[0]?.faqs.length).toBeGreaterThan(0);
        expect(detail?.media.filter((m) => m.isCover)).toHaveLength(1);
        const counts = await repos.catalog.countPublishedTours();
        expect([...counts.byDestination.values()].reduce((a, b) => a + b, 0)).toBeGreaterThan(0);
        expect(await repos.catalog.listDestinations()).toHaveLength(5);
      });
    });
  });

  it('flujo completo con triggers reales: checkout -> hold -> pago -> webhook idempotente', async () => {
    await inRollback(async (tx) => {
      const clock = new FixedClock(new Date());
      const travelDate = addDays(toLimaCalendarDate(clock.now()), 30);
      const { tour, departure } = await createBookableTour(tx, travelDate, 3);
      const uow = new TransactionBoundUnitOfWork(tx);
      const ids = new UuidV7Generator();
      const sandbox = new SandboxPaymentGateway({ webhookSecret: WEBHOOK_SECRET, checkoutBaseUrl: 'http://localhost/sbx', webhookToleranceSeconds: 300 }, clock);
      // `sandbox` no existe en el enum payment_provider: se simula un proveedor real.
      const culqiLike: PaymentGateway = {
        provider: 'culqi',
        createIntent: (i) => sandbox.createIntent(i),
        confirm: (id, c) => sandbox.confirm(id, c),
        refund: (i) => sandbox.refund(i),
        getStatus: (id) => sandbox.getStatus(id),
        verifyWebhook: (raw, h) => sandbox.verifyWebhook(raw, h),
      };
      const carts = new CartUseCases(uow, clock, ids, CART_SETTINGS);
      const bookings = new BookingUseCases(uow, clock, ids, carts, BOOKING_SETTINGS);
      const payments = new PaymentUseCases(uow, clock, ids, new StaticPaymentGatewayRegistry([culqiLike], culqiLike));

      const { token, details } = await carts.create({ currency: 'USD', locale: 'es' });
      await carts.addItem(details.cart.id, token, { tourId: tour.id, travelDate, lines: [{ paxType: 'adult', residency: 'foreign', quantity: 2 }] });
      const key = `int-${randomUUID()}`;
      const input = {
        cartId: details.cart.id,
        cartToken: token,
        idempotencyKey: key,
        paymentOption: 'deposit' as const,
        customer: { email: `int-${randomUUID().slice(0, 8)}@example.com`, firstName: 'Int', lastName: 'Test' },
        acceptTerms: true,
        acceptPrivacyPolicy: true,
      };
      const { booking, accessToken: firstToken } = await bookings.checkout(input);
      expect(booking.code).toMatch(/^PWT-\d{4}-\d{6}$/);
      const replay = await bookings.checkout(input);
      expect(replay.replayed).toBe(true);
      // El replay rota el token: el original deja de servir.
      await expect(bookings.getByCode({ code: booking.code, token: replay.accessToken })).resolves.toBeDefined();
      await expect(bookings.getByCode({ code: booking.code, token: firstToken })).rejects.toMatchObject({ code: 'booking-not-found' });
      const access = { code: booking.code, token: replay.accessToken };
      const stored0 = await tx.booking.findUniqueOrThrow({ where: { id: booking.id } });
      expect(stored0.accessTokenHash).toMatch(/^[0-9a-f]{64}$/);
      expect(await tx.idempotencyKey.findUniqueOrThrow({ where: { scope_key: { scope: 'checkout', key } } })).toMatchObject({
        resourceId: booking.id,
        response: { bookingId: booking.id, bookingCode: booking.code },
      });
      expect(booking.deposit.amount).toBe(10_001n); // ceil(20002 * 50 %)

      const dep = await tx.departure.findUniqueOrThrow({ where: { id: departure.id } });
      expect(dep).toMatchObject({ held: 2, booked: 0, version: 1 });
      const history = await tx.bookingStatusHistory.findMany({ where: { bookingId: booking.id }, orderBy: { createdAt: 'asc' } });
      expect(history.map((h) => h.toStatus)).toEqual(['pending', 'held']);
      expect(await tx.auditLog.count({ where: { entityType: 'bookings', entityId: booking.id } })).toBeGreaterThanOrEqual(2);

      const intent = await payments.createPayment({ booking: access,idempotencyKey: `pay-${randomUUID()}` });
      await sandbox.confirm(intent.payment.providerPaymentId!, {});
      const body = JSON.stringify({ id: `evt_${randomUUID()}`, type: 'payment.succeeded', data: { providerPaymentId: intent.payment.providerPaymentId, status: 'succeeded', amount: 10_001, currency: 'USD' } });
      const headers = { 'x-sandbox-signature': sandbox.signWebhook(body) };
      expect((await payments.handleWebhook('culqi', Buffer.from(body), headers)).status).toBe('processed');
      expect((await payments.handleWebhook('culqi', Buffer.from(body), headers)).status).toBe('duplicate');

      const stored = await tx.booking.findUniqueOrThrow({ where: { id: booking.id } });
      expect(stored).toMatchObject({ status: 'partially_paid', paidAmount: 10_001n, holdExpiresAt: null });
      expect(await tx.departure.findUniqueOrThrow({ where: { id: departure.id } })).toMatchObject({ held: 0, booked: 2 });
      expect(await tx.inventoryHold.findFirstOrThrow({ where: { departureId: departure.id } })).toMatchObject({ status: 'converted' });
      expect(await tx.paymentEvent.count({ where: { provider: 'culqi' } })).toBeGreaterThanOrEqual(1);
    });
  });

  it('pasarela sandbox persistible (enum payment_provider incluye sandbox)', async () => {
    await inRollback(async (tx) => {
      const clock = new FixedClock(new Date());
      const travelDate = addDays(toLimaCalendarDate(clock.now()), 31);
      const { tour } = await createBookableTour(tx, travelDate, 2);
      const uow = new TransactionBoundUnitOfWork(tx);
      const ids = new UuidV7Generator();
      const sandbox = new SandboxPaymentGateway({ webhookSecret: WEBHOOK_SECRET, checkoutBaseUrl: 'http://localhost/sbx', webhookToleranceSeconds: 300 }, clock);
      const carts = new CartUseCases(uow, clock, ids, CART_SETTINGS);
      const bookings = new BookingUseCases(uow, clock, ids, carts, BOOKING_SETTINGS);
      const payments = new PaymentUseCases(uow, clock, ids, new StaticPaymentGatewayRegistry([sandbox], sandbox));
      const { token, details } = await carts.create({ currency: 'USD', locale: 'es' });
      await carts.addItem(details.cart.id, token, { tourId: tour.id, travelDate, lines: [{ paxType: 'adult', residency: 'foreign', quantity: 1 }] });
      const result = await bookings.checkout({
        cartId: details.cart.id,
        cartToken: token,
        idempotencyKey: `int-${randomUUID()}`,
        paymentOption: 'full',
        customer: { email: `int-${randomUUID().slice(0, 8)}@example.com`, firstName: 'Int', lastName: 'Sandbox' },
        acceptTerms: true,
        acceptPrivacyPolicy: true,
      });
      const access = { code: result.booking.code, token: result.accessToken };
      const intent = await payments.createPayment({ booking: access, idempotencyKey: `pay-${randomUUID()}` });
      const confirmed = await payments.confirmPayment(access, intent.payment.id, {});
      expect(confirmed.status).toBe('succeeded');
      expect(await tx.payment.findUniqueOrThrow({ where: { id: intent.payment.id } })).toMatchObject({ provider: 'sandbox', status: 'succeeded' });
      expect((await bookings.getByCode(access)).status).toBe('paid');
    });
  });

  it('idempotency_keys: conflicto por PK, reutilización tras vencer y purga', async () => {
    await inRollback(async (tx) => {
      const repo = new PrismaIdempotencyRepository(tx);
      const now = new Date();
      const record = {
        scope: 'int-test',
        key: `idem-${randomUUID()}`,
        fingerprint: 'a'.repeat(64),
        resourceId: randomUUID(),
        response: { ok: true },
        createdAt: now,
        expiresAt: new Date(now.getTime() + 60_000),
      };
      await repo.insert(record);
      expect(await repo.find(record.scope, record.key)).toMatchObject({ fingerprint: record.fingerprint, response: { ok: true } });
      // Un fallo dentro de la transacción la aborta en PostgreSQL: se aísla con SAVEPOINT.
      await tx.$executeRawUnsafe('SAVEPOINT dup');
      await expect(repo.insert(record)).rejects.toBeInstanceOf(IdempotencyConflictError);
      await tx.$executeRawUnsafe('ROLLBACK TO SAVEPOINT dup');
      const later = new Date(now.getTime() + 120_000);
      await repo.insert({ ...record, fingerprint: 'b'.repeat(64), createdAt: later, expiresAt: new Date(later.getTime() + 60_000) });
      expect((await repo.find(record.scope, record.key))?.fingerprint).toBe('b'.repeat(64));
      expect(await repo.deleteExpired(new Date(later.getTime() + 120_000))).toBeGreaterThanOrEqual(1);
      expect(await repo.find(record.scope, record.key)).toBeNull();
    });
  });

  it('Libro de Reclamaciones: correlativo, feriados de business_holidays, PII cifrada, outbox y CHECK', async () => {
    await inRollback(async (tx) => {
      const uow = new TransactionBoundUnitOfWork(tx);
      const clock = new FixedClock(new Date('2026-10-07T15:00:00Z'));
      const cipher = AesGcmPiiCipher.fromBase64(DEVELOPMENT_PII_KEY_BASE64);
      const complaints = new ComplaintUseCases(uow, clock, new UuidV7Generator(), cipher, {
        provider: { legalName: 'Peru Wonders Tours (prueba)', ruc: '20000000001', establishmentAddress: 'Jr. Lima 123, Puno', establishmentCode: 'WEB' },
        conformityTextVersion: 'conf-v1',
        privacyNoticeVersion: 'priv-v1',
        idempotencyTtlMinutes: 60,
      });
      const before = await tx.documentSequence.findFirst({ where: { scope: 'complaint', year: 2026 } });
      const draft = {
        consumer: { fullName: 'Int Test', docType: 'dni' as const, docNumber: '45678912', address: 'Jr. Lima 123, Puno', phone: '+51987654321', email: 'int@example.com', isMinor: false },
        guardian: null,
        good: { type: 'service' as const, description: 'Tour de prueba', claimedAmount: 1000n, currency: 'PEN' as const },
        declaredType: 'queja' as const,
        detail: 'Detalle de prueba de integración.',
        consumerRequest: 'Pedido de prueba.',
        responseChannel: 'letter' as const,
        conformityAccepted: true,
      };
      const key = `int-${randomUUID()}`;
      const result = await complaints.submit({ draft, idempotencyKey: key, ip: '203.0.113.7' });
      const expectedSeq = (before?.lastValue ?? 0) + 1;
      expect(result.complaint.code).toBe(`LR-2026-${String(expectedSeq).padStart(6, '0')}`);
      // 8-oct-2026 (Combate de Angamos) viene de business_holidays => vence el 29-oct (Lima).
      expect(result.complaint.responseDueAt.toISOString()).toBe('2026-10-30T04:59:59.999Z');

      const row = await tx.complaint.findUniqueOrThrow({ where: { code: result.complaint.code } });
      expect(row).toMatchObject({
        type: 'queja',
        declaredType: 'queja',
        channel: 'web',
        responseChannel: 'letter',
        providerRuc: '20000000001',
        conformityTextVersion: 'conf-v1',
        ip: '203.0.113.7',
      });
      expect(Buffer.from(row.consumerDocEnc).toString('utf8')).not.toContain('45678912');
      expect(row.accessTokenHash).toMatch(/^[0-9a-f]{64}$/);
      expect(await tx.outboxEvent.count({ where: { aggregateId: row.id, eventType: 'complaint.submitted' } })).toBe(1);
      expect(await tx.idempotencyKey.count({ where: { scope: 'complaint', key } })).toBe(1);

      const view = await complaints.getByCode({ code: result.complaint.code, token: result.accessToken });
      expect(view.consumerDocNumber).toBe('45678912');

      // Replay: misma hoja, sin consumir otro número.
      const replay = await complaints.submit({ draft, idempotencyKey: key, ip: '203.0.113.7' });
      expect(replay).toMatchObject({ replayed: true, complaint: { code: result.complaint.code } });
      expect((await tx.documentSequence.findFirstOrThrow({ where: { scope: 'complaint', year: 2026 } })).lastValue).toBe(expectedSeq);

      // CHECK en la base: un menor sin representante completo se rechaza aunque la app falle.
      await tx.$executeRawUnsafe('SAVEPOINT minor');
      await expect(tx.complaint.update({ where: { id: row.id }, data: { isMinor: true } })).rejects.toThrow(/complaints_minor_ck|check/i);
      await tx.$executeRawUnsafe('ROLLBACK TO SAVEPOINT minor');
      await tx.$executeRawUnsafe('SAVEPOINT settled');
      await expect(tx.complaint.update({ where: { id: row.id }, data: { status: 'settled' } })).rejects.toThrow(/complaints_settlement_ck|check/i);
      await tx.$executeRawUnsafe('ROLLBACK TO SAVEPOINT settled');
      expect(await tx.businessHoliday.count({ where: { scope: 'national' } })).toBeGreaterThanOrEqual(32);
    });
  });

  it('seed --publish publica los borradores ya cargados y reejecutar no duplica nada', async () => {
    await inRollback(async (tx) => {
      const bundle = await readSeedBundle(process.env['SEED_DATA_DIR'] ?? '../../data/seed');
      await tx.tour.updateMany({ data: { status: 'draft', publishedAt: null } });
      const toursBefore = await tx.tour.count();
      const now = new Date();
      const draftRun = await seedDatabaseInTransaction(tx, bundle, { publishTours: false, refreshContent: false, now });
      expect(draftRun.tours).toMatchObject({ created: 0, published: 0 });
      expect(await tx.tour.count({ where: { status: 'published' } })).toBe(0);
      const publishRun = await seedDatabaseInTransaction(tx, bundle, { publishTours: true, refreshContent: false, now });
      expect(publishRun.tours).toMatchObject({ created: 0, existing: 41, published: 41 });
      expect(await tx.tour.count({ where: { status: 'published', publishedAt: { not: null } } })).toBeGreaterThanOrEqual(41);
      const again = await seedDatabaseInTransaction(tx, bundle, { publishTours: true, refreshContent: false, now });
      expect(again.tours.published).toBe(0);
      expect(await tx.tour.count()).toBe(toursBefore);
    });
  });

  it('seed --demo-pricing: marca DEMO, idempotente, no pisa tarifas reales y --remove-demo-pricing aborta si hay uso', async () => {
    await inRollback(async (tx) => {
      // Un tour con tarifa real (sin temporada DEMO) debe quedar fuera.
      const { tour: realTour } = await createBookableTour(tx, addDays(toLimaCalendarDate(new Date()), 50), 4);
      const now = new Date();
      const first = await applyDemoPricing(tx, { now, departureDays: 3, capacity: 12 });
      const tours = await tx.tour.count({ where: { deletedAt: null } });
      expect(first.toursSkippedWithRealRates).toContain(realTour.slug);
      expect(first.tours).toBe(tours - first.toursSkippedWithRealRates.length);
      expect(first.rates.created + first.rates.updated).toBe(first.tours * 16);

      let season = await tx.season.findUniqueOrThrow({ where: { code: DEMO_SEASON_CODE } });
      expect(season.name).toBe(DEMO_MARK);
      expect(await tx.rate.count({ where: { seasonId: season.id } })).toBe(first.tours * 16);
      expect(await tx.rate.count({ where: { tourId: realTour.id, seasonId: season.id } })).toBe(0);
      const demoDepartures = await tx.departure.count({ where: { tour: { rates: { some: { seasonId: season.id } } } } });
      expect(demoDepartures).toBeGreaterThanOrEqual(first.tours * 3);

      // Idempotente: reejecutar no duplica.
      const second = await applyDemoPricing(tx, { now, departureDays: 3, capacity: 12 });
      expect(second).toMatchObject({ season: 'updated', rates: { created: 0, updated: first.tours * 16 }, departures: { created: 0 } });

      // pwt_dev puede tener uso previo de salidas DEMO (pruebas manuales con la API de desarrollo):
      // se mide la línea base para que la prueba no dependa de esos datos.
      const baselineError = await deleteDemoPricing(tx).catch((e: unknown) => e);
      const baseline = baselineError instanceof DemoPricingInUseError ? baselineError.usage : {};
      // En una base limpia (CI) no hay uso previo y la medición SÍ borra lo DEMO: se vuelve a cargar.
      if (!(baselineError instanceof DemoPricingInUseError)) {
        await applyDemoPricing(tx, { now, departureDays: 3, capacity: 12 });
        season = await tx.season.findUniqueOrThrow({ where: { code: DEMO_SEASON_CODE } });
      }

      // Un carrito con una salida DEMO: aborta sin borrar nada.
      const demoTour = await tx.tour.findFirstOrThrow({ where: { rates: { some: { seasonId: season.id } } }, orderBy: { slug: 'asc' } });
      await tx.tour.update({ where: { id: demoTour.id }, data: { status: 'published', publishedAt: now } });
      const clock = new FixedClock(now);
      const carts = new CartUseCases(new TransactionBoundUnitOfWork(tx), clock, new UuidV7Generator(), CART_SETTINGS);
      const cart = await carts.create({ currency: 'USD', locale: 'es' });
      const travelDate = addDays(toLimaCalendarDate(now), 2);
      const added = await carts.addItem(cart.details.cart.id, cart.token, {
        tourId: demoTour.id,
        travelDate,
        lines: [{ paxType: 'adult', residency: 'foreign', quantity: Math.max(1, demoTour.minPax ?? 1) }],
      });
      expect(added.item.departureId).toBe(demoDepartureId(demoTour.slug, travelDate));
      const usage = await deleteDemoPricing(tx).catch((e: unknown) => e);
      expect(usage).toBeInstanceOf(DemoPricingInUseError);
      expect((usage as DemoPricingInUseError).usage).toMatchObject({ cartItems: (baseline['cartItems'] ?? 0) + 1 });
      expect(await tx.rate.count({ where: { seasonId: season.id } })).toBe(first.tours * 16);

      // Sin uso: borra solo lo DEMO (la tarifa y salida reales siguen).
      await tx.cartItemLine.deleteMany({ where: { cartItem: { cartId: cart.details.cart.id } } });
      await tx.cartItem.deleteMany({ where: { cartId: cart.details.cart.id } });
      if (Object.keys(baseline).length > 0) {
        // Con uso previo en pwt_dev sigue abortando por ese uso y no borra nada.
        const still = await deleteDemoPricing(tx).catch((e: unknown) => e);
        expect((still as DemoPricingInUseError).usage).toEqual(baseline);
        return;
      }
      const removed = await deleteDemoPricing(tx);
      expect(removed).toMatchObject({ rates: first.tours * 16, season: 1 });
      expect(removed.departures).toBeGreaterThanOrEqual(first.tours * 3);
      expect(await tx.season.count({ where: { code: DEMO_SEASON_CODE } })).toBe(0);
      expect(await tx.rate.count({ where: { tourId: realTour.id } })).toBe(1);
      expect(await tx.departure.count({ where: { tourId: realTour.id } })).toBe(1);
    });
  });

  it('bloqueo optimista: guardar una salida con versión vieja lanza ConcurrencyError', async () => {
    await inRollback(async (tx) => {
      const { departure } = await createBookableTour(tx, addDays(toLimaCalendarDate(new Date()), 40), 5);
      const uow = new TransactionBoundUnitOfWork(tx);
      await uow.run(async (repos) => {
        const a = (await repos.inventory.findDeparture(departure.id))!;
        const b = (await repos.inventory.findDeparture(departure.id))!;
        a.hold(1);
        await repos.inventory.saveDeparture(a);
        b.hold(1);
        await expect(repos.inventory.saveDeparture(b)).rejects.toBeInstanceOf(ConcurrencyError);
      });
    });
  });

  it('el CHECK de la base impide sobreventa aunque la app falle', async () => {
    await expect(
      inRollback(async (tx) => {
        const { departure } = await createBookableTour(tx, addDays(toLimaCalendarDate(new Date()), 41), 2);
        await tx.departure.update({ where: { id: departure.id }, data: { held: 3 } });
      }),
    ).rejects.toThrow(/departures_no_overbooking_ck|check/i);
  });

  it('PrismaUnitOfWork ejecuta y anida transacciones', async () => {
    const uow = new PrismaUnitOfWork(prisma);
    const nested = await uow.run(async (outer) => {
      const categories = await outer.catalog.listCategories();
      const inner = await uow.run(async (repos) => repos.catalog.listDestinations());
      return { categories: categories.length, destinations: inner.length };
    });
    expect(nested).toEqual({ categories: 5, destinations: 5 });
  });
});
