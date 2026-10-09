import 'dotenv/config';
import { randomUUID } from 'node:crypto';
import type { PrismaClient } from '../src/generated/prisma/client.js';
import { BookingsAdminService } from '../src/modules/backoffice/application/bookings-admin.service.js';
import { AdminDatabase } from '../src/modules/backoffice/infrastructure/admin-database.js';
import { BookingUseCases } from '../src/modules/booking/application/booking.use-cases.js';
import { CartUseCases } from '../src/modules/cart/application/cart.use-cases.js';
import type { IdentityRepositories, IdentityStore, PasswordHasher } from '../src/modules/identity/application/ports.js';
import { StaffAuthUseCases, type StaffActor } from '../src/modules/identity/application/staff-auth.use-cases.js';
import { StaffUsersUseCases } from '../src/modules/identity/application/staff-users.use-cases.js';
import { permissionsFor } from '../src/modules/identity/domain/permissions.js';
import { PrismaIdentityStore } from '../src/modules/identity/infrastructure/identity-stores.js';
import { JwtTokenService, OtplibTotpService } from '../src/modules/identity/infrastructure/security-adapters.js';
import { PaymentUseCases } from '../src/modules/payments/application/payment.use-cases.js';
import { SandboxPaymentGateway, StaticPaymentGatewayRegistry } from '../src/modules/payments/infrastructure/sandbox-payment-gateway.js';
import { createPrismaClient } from '../src/persistence/prisma/prisma-client.js';
import { PrismaUnitOfWork } from '../src/persistence/prisma/prisma-unit-of-work.js';
import type { TransactionalRepositories, UnitOfWork } from '../src/shared/application/unit-of-work.js';
import { addDays, calendarDateToUtcDate, toLimaCalendarDate } from '../src/shared/domain/calendar-date.js';
import { AesGcmPiiCipher, DEVELOPMENT_PII_KEY_BASE64 } from '../src/shared/infrastructure/aes-gcm-pii-cipher.js';
import { SystemClock, UuidV7Generator } from '../src/shared/infrastructure/system.js';
import { BOOKING_SETTINGS, CART_SETTINGS } from './support/fixtures.js';
import { testDatabaseUrl } from './support/test-database.js';

const url = testDatabaseUrl();
const describeDb = url ? describe : describe.skip;
const META = { ip: '127.0.0.1', userAgent: 'concurrency', requestId: null };
const ids = new UuidV7Generator();
const clock = new SystemClock();

/** Espera a `promise` o a `ms`, lo que ocurra primero (no deja colgada la prueba si hay bloqueo). */
function settleOrTimeout(promise: Promise<unknown>, ms: number): Promise<void> {
  return Promise.race([promise.then(() => undefined, () => undefined), new Promise<void>((r) => setTimeout(r, ms))]);
}

/**
 * Unidad de trabajo que intercala un "hook" justo después de la primera lectura de la reserva
 * dentro de la transacción: así dos transacciones REALES se cruzan de forma determinista.
 */
class HookedUnitOfWork implements UnitOfWork {
  private fired = false;
  constructor(
    private readonly inner: UnitOfWork,
    private readonly hook: () => Promise<void>,
  ) {}
  run<T>(work: (repos: TransactionalRepositories) => Promise<T>): Promise<T> {
    return this.inner.run((repos) => work(this.wrap(repos)));
  }
  arm(): void {
    this.fired = false;
  }
  armed = false;
  private wrap(repos: TransactionalRepositories): TransactionalRepositories {
    const bookings = new Proxy(repos.bookings, {
      get: (target, prop, receiver) => {
        const value = Reflect.get(target, prop, receiver) as unknown;
        if ((prop === 'findById' || prop === 'findByIdForUpdate') && typeof value === 'function') {
          return async (...args: unknown[]) => {
            const result = await (value as (...a: unknown[]) => Promise<unknown>).apply(target, args);
            if (this.armed && !this.fired) {
              this.fired = true;
              await this.hook();
            }
            return result;
          };
        }
        return typeof value === 'function' ? (value as (...a: unknown[]) => unknown).bind(target) : value;
      },
    });
    return { ...repos, bookings };
  }
}

/** Store de identidades que pausa después de leer el usuario (cruce determinista de transacciones). */
class HookedIdentityStore implements IdentityStore {
  constructor(
    private readonly inner: IdentityStore,
    private readonly hook: () => Promise<void>,
  ) {}
  run<T>(work: (repos: IdentityRepositories) => Promise<T>): Promise<T> {
    return this.inner.run((repos) => {
      const users = new Proxy(repos.users, {
        get: (target, prop, receiver) => {
          const value = Reflect.get(target, prop, receiver) as unknown;
          if (prop === 'findById' && typeof value === 'function') {
            return async (...args: unknown[]) => {
              const result = await (value as (...a: unknown[]) => Promise<unknown>).apply(target, args);
              await this.hook();
              return result;
            };
          }
          return typeof value === 'function' ? (value as (...a: unknown[]) => unknown).bind(target) : value;
        },
      });
      return work({ ...repos, users });
    });
  }
}

const fastHasher: PasswordHasher = {
  hash: (p) => Promise.resolve(`h:${p}`),
  verify: (h, p) => Promise.resolve(h === `h:${p}`),
  needsRehash: () => false,
};

describeDb('Concurrencia con transacciones reales en PostgreSQL (pwt_test)', () => {
  let prisma: PrismaClient;

  beforeAll(async () => {
    // Nunca colgar la corrida por un deadlock o una espera de bloqueo: tiempos máximos por sesión.
    const withTimeouts = new URL(url!);
    withTimeouts.searchParams.set('options', '-c lock_timeout=5000 -c statement_timeout=20000');
    prisma = createPrismaClient(withTimeouts.toString());
    await prisma.$connect();
  });
  afterAll(async () => {
    await prisma?.$disconnect();
  });

  // ---------------------------------------------------------------------------
  // H-01: reservas y pagos
  // ---------------------------------------------------------------------------
  async function bookableTour(travelDate: string) {
    const slug = `conc-${randomUUID().slice(0, 8)}`;
    const tour = await prisma.tour.create({
      data: {
        id: ids.next(),
        slug,
        code: slug.toUpperCase(),
        type: 'tour',
        status: 'published',
        publishedAt: new Date(),
        durationDays: 1,
        translations: { create: { id: ids.next(), locale: 'es', slug, title: 'Tour de concurrencia', summary: 'Prueba' } },
      },
    });
    await prisma.rate.create({
      data: { id: ids.next(), tourId: tour.id, paxType: 'adult', residency: 'foreign', currency: 'USD', amount: 10_000n, validFrom: calendarDateToUtcDate('2026-01-01'), validTo: calendarDateToUtcDate('2028-12-31') },
    });
    await prisma.departure.create({ data: { id: ids.next(), tourId: tour.id, departureDate: calendarDateToUtcDate(travelDate), capacity: 10 } });
    return tour;
  }

  function paymentStack(uow: UnitOfWork) {
    const gateway = new SandboxPaymentGateway({ webhookSecret: 'concurrency-webhook-secret-0123456789', checkoutBaseUrl: 'http://localhost/sandbox', webhookToleranceSeconds: 300 }, clock);
    const carts = new CartUseCases(uow, clock, ids, CART_SETTINGS);
    const bookings = new BookingUseCases(uow, clock, ids, carts, BOOKING_SETTINGS);
    const payments = new PaymentUseCases(uow, clock, ids, new StaticPaymentGatewayRegistry([gateway], gateway));
    return { gateway, carts, bookings, payments };
  }

  async function heldBooking(stack: ReturnType<typeof paymentStack>, tourId: string, travelDate: string) {
    const { token, details } = await stack.carts.create({ currency: 'USD', locale: 'es' });
    await stack.carts.addItem(details.cart.id, token, { tourId, travelDate, lines: [{ paxType: 'adult', residency: 'foreign', quantity: 2 }] });
    const result = await stack.bookings.checkout({
      cartId: details.cart.id,
      cartToken: token,
      idempotencyKey: randomUUID(),
      paymentOption: 'deposit',
      customer: { email: `conc-${randomUUID().slice(0, 6)}@example.com`, firstName: 'Con', lastName: 'Currencia' },
      acceptTerms: true,
      acceptPrivacyPolicy: true,
    });
    return { booking: result.booking, access: { code: result.booking.code, token: result.accessToken } };
  }

  /** Dinero capturado en la pasarela vs. lo que la base registra (cobros - reembolsos). */
  async function moneyInvariant(gateway: SandboxPaymentGateway, bookingId: string) {
    const payments = await prisma.payment.findMany({ where: { bookingId } });
    let captured = 0n;
    for (const p of payments.filter((x) => x.kind !== 'refund' && x.provider !== 'manual' && x.providerPaymentId)) {
      const state = await gateway.getStatus(p.providerPaymentId!);
      if (state.status === 'succeeded') captured += p.amount;
    }
    const refunds = payments.filter((p) => p.kind === 'refund' && p.status === 'succeeded').reduce((s, p) => s + p.amount, 0n);
    const recorded = payments.filter((p) => p.kind !== 'refund' && p.status === 'succeeded').reduce((s, p) => s + p.amount, 0n);
    const booking = await prisma.booking.findUniqueOrThrow({ where: { id: bookingId } });
    return { captured, recorded, refunds, booking };
  }

  it('H-01a: la confirmación de un pago que se cruza con la cancelación del staff no deja dinero capturado sin registrar', async () => {
    const travelDate = addDays(toLimaCalendarDate(new Date()), 60);
    const tour = await bookableTour(travelDate);
    const base = new PrismaUnitOfWork(prisma);
    const plain = paymentStack(base);
    const { booking, access } = await heldBooking(plain, tour.id, travelDate);
    const intent = await plain.payments.createPayment({ booking: access, idempotencyKey: randomUUID() });

    const admin = new BookingsAdminService(new AdminDatabase(prisma, clock), ids, [{ minBusinessDaysBefore: 0, refundPercent: 100 }]);
    const actor: StaffActor = { userId: randomUUID(), sessionId: randomUUID(), email: 'op@pwt.test', fullName: 'Op', role: 'operator', permissions: permissionsFor('operator') };
    let cancel: Promise<unknown> = Promise.resolve();
    const hooked = new HookedUnitOfWork(base, async () => {
      cancel = admin.cancel(actor, META, booking.code, { reason: 'Cancelación concurrente de prueba' });
      await settleOrTimeout(cancel, 1500);
    });
    hooked.armed = true;
    const racing = new PaymentUseCases(hooked, clock, ids, new StaticPaymentGatewayRegistry([plain.gateway], plain.gateway));
    await racing.confirmPayment(access, intent.payment.id, {}).catch(() => undefined);
    await cancel.catch(() => undefined);

    const { captured, recorded, refunds, booking: after } = await moneyInvariant(plain.gateway, booking.id);
    expect(captured).toBe(intent.payment.amount.amount); // la pasarela cobró el adelanto
    expect(recorded).toBe(captured); // ...y la base lo registra (nada colgado en `pending`)
    expect(after.paidAmount).toBe(recorded);
    // La reserva quedó cancelada con el reembolso adeudado cubriendo lo pagado.
    expect(after.status).toBe('cancelled');
    expect(after.refundDueAmount ?? 0n).toBe(after.paidAmount - refunds);
  }, 30_000);

  it('H-01b: un solo pago activo por reserva (dos "Pagar" simultáneos con claves distintas retoman el mismo intento)', async () => {
    const travelDate = addDays(toLimaCalendarDate(new Date()), 61);
    const tour = await bookableTour(travelDate);
    const stack = paymentStack(new PrismaUnitOfWork(prisma));
    const { booking, access } = await heldBooking(stack, tour.id, travelDate);
    const [a, b] = await Promise.all([
      stack.payments.createPayment({ booking: access, idempotencyKey: randomUUID() }),
      stack.payments.createPayment({ booking: access, idempotencyKey: randomUUID() }),
    ]);
    expect(a.payment.id).toBe(b.payment.id);
    expect([a.replayed, b.replayed].filter(Boolean)).toHaveLength(1);
    expect(await prisma.payment.count({ where: { bookingId: booking.id, status: { in: ['pending', 'requires_action', 'authorized'] } } })).toBe(1);
    // El índice único parcial es la red de seguridad en la base.
    await expect(
      prisma.payment.create({
        data: { id: ids.next(), bookingId: booking.id, kind: 'deposit', provider: 'sandbox', status: 'pending', amount: 1n, currency: 'USD', bookingCurrencyAmount: 1n, idempotencyKey: randomUUID() },
      }),
    ).rejects.toThrow();
  }, 30_000);

  it('H-01c: el cobro del saldo que se cruza con un pago manual del staff no pierde ninguno (sin lost update)', async () => {
    const travelDate = addDays(toLimaCalendarDate(new Date()), 62);
    const tour = await bookableTour(travelDate);
    const base = new PrismaUnitOfWork(prisma);
    const plain = paymentStack(base);
    const { booking, access } = await heldBooking(plain, tour.id, travelDate);
    const deposit = await plain.payments.createPayment({ booking: access, idempotencyKey: randomUUID() });
    await plain.payments.confirmPayment(access, deposit.payment.id, {});
    const balance = await plain.payments.createPayment({ booking: access, idempotencyKey: randomUUID() });
    const admin = new BookingsAdminService(new AdminDatabase(prisma, clock), ids, [{ minBusinessDaysBefore: 0, refundPercent: 100 }]);
    const agentRow = await prisma.user.create({ data: { id: ids.next(), email: `ag-${randomUUID().slice(0, 6)}@pwt.test`, fullName: 'Ag', role: 'agent', passwordHash: 'x' } });
    const actor: StaffActor = { userId: agentRow.id, sessionId: randomUUID(), email: agentRow.email, fullName: 'Ag', role: 'agent', permissions: permissionsFor('agent') };
    let manual: Promise<unknown> = Promise.resolve();
    const hooked = new HookedUnitOfWork(base, async () => {
      manual = admin.recordManualPayment(actor, META, booking.code, randomUUID(), { amount: balance.payment.amount.amount, method: 'cash', reference: `REC-${randomUUID().slice(0, 8)}` });
      await settleOrTimeout(manual, 1500);
    });
    hooked.armed = true;
    const racing = new PaymentUseCases(hooked, clock, ids, new StaticPaymentGatewayRegistry([plain.gateway], plain.gateway));
    const confirmOutcome = await racing.confirmPayment(access, balance.payment.id, {}).then((p) => p.status, (e: Error) => e.message);
    const manualOutcome = await manual.then(() => 'ok', (e: Error) => e.message);
    const { captured, recorded, refunds, booking: after } = await moneyInvariant(plain.gateway, booking.id);
    void confirmOutcome;
    void manualOutcome;
    const manualTotal = (await prisma.payment.findMany({ where: { bookingId: booking.id, provider: 'manual', kind: { not: 'refund' }, status: 'succeeded' } })).reduce((s, p) => s + p.amount, 0n);
    // Todo lo cobrado (pasarela + caja) está en la base y se refleja en la reserva o se reembolsó.
    expect(recorded).toBe(captured + manualTotal);
    expect(after.paidAmount + refunds).toBe(recorded);
    expect(after.paidAmount).toBe(after.totalAmount);
    expect(after.status).toBe('paid');
  }, 30_000);

  // ---------------------------------------------------------------------------
  // H-03 / H-04: identidades
  // ---------------------------------------------------------------------------
  function authStack(store: IdentityStore) {
    const tokens = new JwtTokenService('concurrency-secret-0123456789-abcdefghij', 'pwt-test', 600);
    return new StaffAuthUseCases(store, clock, ids, fastHasher, new OtplibTotpService(), tokens, AesGcmPiiCipher.fromBase64(DEVELOPMENT_PII_KEY_BASE64), {
      accessTokenTtlSeconds: 600,
      refreshIdleTtlSeconds: 3600,
      refreshAbsoluteTtlSeconds: 7200,
      lockout: { threshold: 5, baseSeconds: 60, maxSeconds: 3600 },
      mfaIssuer: 'PWT',
    });
  }

  it('H-03: 5 intentos fallidos simultáneos cuentan 5 (contador atómico)', async () => {
    const store = new PrismaIdentityStore(prisma);
    const email = `h03-${randomUUID().slice(0, 6)}@pwt.test`;
    const users = new StaffUsersUseCases(store, clock, ids, fastHasher);
    const { user } = await users.create({ email, fullName: 'Usuario Concurrencia', role: 'agent', password: 'Lago-Titicaca#Uros-77' }, null, META);
    // Todos leen el usuario antes de que nadie escriba (barrera de 5).
    let waiting = 0;
    let release: () => void = () => undefined;
    const gate = new Promise<void>((r) => (release = r));
    const hooked = new HookedIdentityStore(store, async () => {
      waiting += 1;
      if (waiting >= 5) release();
      await settleOrTimeout(gate, 1500);
    });
    const auth = authStack(hooked);
    await Promise.all(Array.from({ length: 5 }, () => auth.login({ email, password: 'mala-clave-1234' }, META).catch(() => undefined)));
    const row = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
    expect(row.failedLoginCount).toBe(5);
    // Desde el 5.º fallo el limitador (cuenta+IP) bloquea incluso con la contraseña correcta.
    await expect(authStack(store).login({ email, password: 'Lago-Titicaca#Uros-77' }, META)).rejects.toMatchObject({ code: 'account-locked' });
  }, 30_000);

  it('H-04: un fallo de login concurrente no reactiva a un usuario deshabilitado', async () => {
    const store = new PrismaIdentityStore(prisma);
    const users = new StaffUsersUseCases(store, clock, ids, fastHasher);
    const admin = await users.create({ email: `h04-admin-${randomUUID().slice(0, 6)}@pwt.test`, fullName: 'Admin Concurrencia', role: 'admin', password: 'Lago-Titicaca#Uros-77' }, null, META);
    const email = `h04-${randomUUID().slice(0, 6)}@pwt.test`;
    const target = await users.create({ email, fullName: 'Objetivo Concurrencia', role: 'agent', password: 'Lago-Titicaca#Uros-77' }, null, META);
    const actor: StaffActor = { userId: admin.user.id, sessionId: randomUUID(), email: admin.user.email, fullName: 'Admin', role: 'admin', permissions: permissionsFor('admin') };
    let fired = false;
    const hooked = new HookedIdentityStore(store, async () => {
      if (fired) return;
      fired = true;
      const fresh = await users.get(target.user.id);
      await settleOrTimeout(users.update(actor, target.user.id, { version: fresh.version, status: 'disabled' }, META), 1500);
    });
    await authStack(hooked).login({ email, password: 'mala-clave-1234' }, META).catch(() => undefined);
    // Tras el arreglo el fallo ya no lee-modifica-escribe la fila (incremento atómico): el hook no se
    // dispara y la desactivación ocurre después; el estado final debe ser el mismo.
    if (!fired) {
      fired = true;
      const fresh = await users.get(target.user.id);
      await users.update(actor, target.user.id, { version: fresh.version, status: 'disabled' }, META);
    }
    const row = await prisma.user.findUniqueOrThrow({ where: { id: target.user.id } });
    expect(row.status).toBe('disabled');
    expect(row.failedLoginCount).toBe(1);
  }, 30_000);
});
