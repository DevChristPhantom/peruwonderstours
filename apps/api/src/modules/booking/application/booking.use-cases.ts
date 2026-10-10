import { requestFingerprint } from '../../../shared/application/fingerprint.js';
import type { TransactionalRepositories, UnitOfWork } from '../../../shared/application/unit-of-work.js';
import { addMinutes, maxDate, toLimaCalendarDate } from '../../../shared/domain/calendar-date.js';
import { BusinessRuleError, ConflictError, ValidationError } from '../../../shared/domain/domain-error.js';
import {
  assertIdempotencyKey,
  IdempotencyConflictError,
  IdempotencyKeyReusedError,
} from '../../../shared/domain/idempotency.js';
import { Money } from '../../../shared/domain/money.js';
import type { Clock, IdGenerator } from '../../../shared/domain/ports.js';
import { serviceEndDate, snapshotTitle, type Locale } from '../../catalog/domain/tour.js';
import { CartHasIssuesError, loadCartWithToken, paymentPlanItems, type CartUseCases } from '../../cart/application/cart.use-cases.js';
import { createCustomer, normalizeEmail } from '../../customers/domain/customer.js';
import { Booking, type BookingItemSnapshot } from '../domain/booking.js';
import { calculatePaymentPlan, type PaymentOption, type PaymentPlanPolicy } from '../domain/payment-plan.js';
import { generateBookingAccessToken, loadBookingWithAccess, type BookingAccess } from './booking-access.js';
import { BookingLifecycle, BookingNotFoundError } from './booking-lifecycle.js';

export interface BookingSettings {
  policy: PaymentPlanPolicy;
  /** Duración del hold de cupo en checkout (RN-12: 15 min). */
  holdTtlMinutes: number;
  termsVersion: string;
  cancellationPolicyVersion: string;
  /** Retención de las claves de idempotencia. */
  idempotencyTtlMinutes: number;
}

export interface CheckoutInput {
  cartId: string;
  cartToken: string | undefined;
  idempotencyKey: string | undefined;
  paymentOption: PaymentOption;
  customer: { email: string; firstName: string; lastName: string; country?: string | null };
  acceptTerms: boolean;
  acceptPrivacyPolicy: boolean;
  /** Consentimientos opcionales de marketing por canal (Ley 29733; nunca obligatorios). */
  marketingEmailOptIn?: boolean;
  marketingWhatsappOptIn?: boolean;
  /** IP y User-Agent del comprador (prueba de la aceptación). */
  meta?: { ip: string | null; userAgent: string | null };
  customerNotes?: string | null;
  /** Total que el cliente vio y aceptó (céntimos). Si difiere del actual: 409. */
  expectedTotalAmount?: bigint;
  /** Idioma de la reserva (correos es/en). Por defecto el del carrito. */
  locale?: Locale;
}

export interface CheckoutResult {
  booking: Booking;
  replayed: boolean;
  /**
   * Token de acceso del comprador (X-Booking-Token). Solo existe en esta respuesta: en la
   * base se guarda su SHA-256. En un replay idempotente se emite uno nuevo y el anterior
   * queda invalidado (la respuesta original pudo perderse).
   */
  accessToken: string;
}

const CHECKOUT_SCOPE = 'checkout';

/** Registro de aceptaciones legales y consentimientos en la transacción del checkout. */
export interface CheckoutPrivacyRecorder {
  recordCheckout(
    repos: TransactionalRepositories,
    params: { customerId: string; bookingId: string; email: string; locale: Locale; marketingEmail: boolean; marketingWhatsapp: boolean; meta: { ip: string | null; userAgent: string | null }; now: Date },
  ): Promise<void>;
}

export class BookingUseCases {
  private readonly lifecycle = new BookingLifecycle();

  constructor(
    private readonly unitOfWork: UnitOfWork,
    private readonly clock: Clock,
    private readonly ids: IdGenerator,
    private readonly carts: CartUseCases,
    private readonly settings: BookingSettings,
    private readonly privacy: CheckoutPrivacyRecorder | null = null,
  ) {}

  /**
   * Checkout desde el carrito (HU-4.2/4.3): idempotente por Idempotency-Key; retiene cupo
   * con bloqueo optimista, congela precios y calcula el plan de pago. Todo o nada.
   */
  checkout(input: CheckoutInput): Promise<CheckoutResult> {
    const idempotencyKey = assertIdempotencyKey(input.idempotencyKey);
    if (!input.acceptTerms || !input.acceptPrivacyPolicy) {
      throw new ValidationError('consent-required', 'Debes aceptar los términos y la política de privacidad para reservar.');
    }
    const fingerprint = requestFingerprint({
      cartId: input.cartId,
      paymentOption: input.paymentOption,
      email: normalizeEmail(input.customer.email),
      firstName: input.customer.firstName,
      lastName: input.customer.lastName,
      country: input.customer.country ?? null,
      notes: input.customerNotes ?? null,
      expectedTotalAmount: input.expectedTotalAmount,
    });

    return this.unitOfWork.run(async (repos) => {
      const now = this.clock.now();
      const replay = await this.findReplay(repos, idempotencyKey, fingerprint);
      if (replay) {
        // El replay exige el mismo X-Cart-Token: sin él no se entrega un token de acceso nuevo.
        const cart = await loadCartWithToken(repos, input.cartId, input.cartToken);
        if (replay.cartId !== cart.id) throw new IdempotencyKeyReusedError(idempotencyKey);
        const access = generateBookingAccessToken();
        replay.rotateAccessToken(access.tokenHash, now);
        await repos.bookings.save(replay);
        return { booking: replay, replayed: true, accessToken: access.token };
      }

      const cart = await loadCartWithToken(repos, input.cartId, input.cartToken);
      if (cart.status === 'converted') {
        const existing = await repos.bookings.findByCartId(cart.id);
        throw new ConflictError('cart-already-checked-out', 'Este carrito ya generó una reserva.', {
          bookingId: existing?.id,
          bookingCode: existing?.code,
        });
      }
      cart.assertActive(now);
      if (cart.items.length === 0) throw new BusinessRuleError('cart-empty', 'Tu carrito está vacío.');

      const details = await this.carts.inspect(cart, repos, false);
      const blocking = details.issues.filter((i) => i.blocking);
      if (blocking.length > 0) throw new CartHasIssuesError(blocking);

      const total = cart.total();
      if (input.expectedTotalAmount !== undefined && !total.equals(Money.of(input.expectedTotalAmount, total.currency))) {
        throw new ConflictError('total-changed', 'El total de tu carrito cambió. Revísalo antes de continuar.', {
          expected: input.expectedTotalAmount,
          current: total.amount,
        });
      }

      const plan = calculatePaymentPlan({
        items: paymentPlanItems(details),
        requestedOption: input.paymentOption,
        now,
        policy: this.settings.policy,
      });

      const email = normalizeEmail(input.customer.email);
      let customer = await repos.customers.findByEmail(email);
      if (!customer) {
        customer = createCustomer({ id: this.ids.next(), ...input.customer, preferredLocale: input.locale ?? cart.locale, now });
        await repos.customers.save(customer);
      }

      const items: BookingItemSnapshot[] = cart.items.map((item) => {
        const tour = details.tours.get(item.tourId);
        return {
          id: this.ids.next(),
          tourId: item.tourId,
          departureId: item.departureId,
          travelDate: item.travelDate,
          status: 'active',
          tourTitle: tour ? snapshotTitle(tour, cart.locale).slice(0, 200) : item.tourId,
          paxCount: item.lines.reduce((sum, l) => sum + l.quantity, 0),
          subtotalAmount: item.subtotalAmount,
          currency: item.currency,
          lines: item.lines.map((l) => ({ ...l })),
        };
      });
      const lastServiceDate = maxDate(
        cart.items.map((item) => {
          const tour = details.tours.get(item.tourId);
          return tour ? serviceEndDate(tour, item.travelDate) : item.travelDate;
        }),
      );

      const access = generateBookingAccessToken();
      const code = await repos.bookingCodes.next(Number(toLimaCalendarDate(now).slice(0, 4)));
      const booking = Booking.create({
        id: this.ids.next(),
        code,
        customerId: customer.id,
        cartId: cart.id,
        locale: input.locale ?? cart.locale,
        plan,
        items,
        lastServiceDate,
        cancellationPolicyVersion: this.settings.cancellationPolicyVersion,
        termsVersion: this.settings.termsVersion,
        customerNotes: input.customerNotes?.slice(0, 2000) ?? null,
        accessTokenHash: access.tokenHash,
        now,
      });
      await repos.bookings.save(booking);

      // Retención de cupo con bloqueo optimista: si otra transacción tomó el último cupo,
      // SoldOutError/ConcurrencyError revierte toda la unidad de trabajo (no se cobra nada).
      const holdExpiresAt = addMinutes(now, this.settings.holdTtlMinutes);
      for (const [index, item] of items.entries()) {
        if (!item.departureId) continue;
        const departure = await repos.inventory.findDeparture(item.departureId);
        if (!departure) throw new BusinessRuleError('no-departure', 'La salida ya no está disponible.');
        departure.hold(item.paxCount);
        await repos.inventory.saveDeparture(departure);
        await repos.inventory.saveHold({
          id: this.ids.next(),
          departureId: departure.id,
          cartItemId: cart.items[index]?.id ?? null,
          bookingItemId: item.id,
          quantity: item.paxCount,
          status: 'active',
          expiresAt: holdExpiresAt,
          releasedAt: null,
        });
      }
      booking.placeHold(holdExpiresAt, now);
      await repos.bookings.save(booking);

      cart.markConverted(now);
      await repos.carts.save(cart);

      await this.privacy?.recordCheckout(repos, {
        customerId: customer.id,
        bookingId: booking.id,
        email: customer.email,
        locale: input.locale ?? cart.locale,
        marketingEmail: input.marketingEmailOptIn ?? false,
        marketingWhatsapp: input.marketingWhatsappOptIn ?? false,
        meta: input.meta ?? { ip: null, userAgent: null },
        now,
      });

      await repos.idempotency.insert({
        scope: CHECKOUT_SCOPE,
        key: idempotencyKey,
        fingerprint,
        resourceId: booking.id,
        response: { bookingId: booking.id, bookingCode: booking.code },
        createdAt: now,
        expiresAt: addMinutes(now, this.settings.idempotencyTtlMinutes),
      });
      return { booking, replayed: false, accessToken: access.token };
    });
  }

  /** Reserva por código legible + token de acceso (404 genérico si no coinciden). */
  getByCode(access: BookingAccess): Promise<Booking> {
    return this.unitOfWork.run((repos) => loadBookingWithAccess(repos, access, this.clock.now()));
  }

  getById(bookingId: string): Promise<Booking> {
    return this.unitOfWork.run(async (repos) => {
      const booking = await repos.bookings.findById(bookingId);
      if (!booking) throw new BookingNotFoundError(bookingId);
      return booking;
    });
  }

  /** Job: cancela reservas con hold vencido y libera cupo. */
  expireHolds(limit = 200): Promise<number> {
    return this.unitOfWork.run(async (repos) => {
      const now = this.clock.now();
      const bookings = await repos.bookings.findWithExpiredHold(now, limit);
      let expired = 0;
      for (const booking of bookings) {
        if (await this.lifecycle.expireIfNeeded(repos, booking, now)) expired += 1;
      }
      return expired;
    });
  }

  private async findReplay(repos: TransactionalRepositories, key: string, fingerprint: string): Promise<Booking | null> {
    const record = await repos.idempotency.find(CHECKOUT_SCOPE, key);
    if (!record || record.expiresAt.getTime() <= this.clock.now().getTime()) return null;
    if (record.fingerprint !== fingerprint) throw new IdempotencyKeyReusedError(key);
    const booking = await repos.bookings.findById(record.resourceId);
    // Registro sin recurso: la transacción original no llegó a confirmarse.
    if (!booking) throw new IdempotencyConflictError(key);
    return booking;
  }
}
