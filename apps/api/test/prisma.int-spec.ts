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
      const { booking } = await bookings.checkout(input);
      expect(booking.code).toMatch(/^PWT-\d{4}-\d{6}$/);
      expect((await bookings.checkout(input)).replayed).toBe(true);
      expect(booking.deposit.amount).toBe(10_001n); // ceil(20002 * 50 %)

      const dep = await tx.departure.findUniqueOrThrow({ where: { id: departure.id } });
      expect(dep).toMatchObject({ held: 2, booked: 0, version: 1 });
      const history = await tx.bookingStatusHistory.findMany({ where: { bookingId: booking.id }, orderBy: { createdAt: 'asc' } });
      expect(history.map((h) => h.toStatus)).toEqual(['pending', 'held']);
      expect(await tx.auditLog.count({ where: { entityType: 'bookings', entityId: booking.id } })).toBeGreaterThanOrEqual(2);

      const intent = await payments.createPayment({ bookingId: booking.id, idempotencyKey: `pay-${randomUUID()}` });
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
