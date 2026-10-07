import type { CalendarDate } from '../../../shared/domain/calendar-date.js';
import { DomainError, NotFoundError } from '../../../shared/domain/domain-error.js';
import type { Clock, IdGenerator } from '../../../shared/domain/ports.js';
import { Money, type CurrencyCode } from '../../../shared/domain/money.js';
import type { TransactionalRepositories, UnitOfWork } from '../../../shared/application/unit-of-work.js';
import { TourQuoteService } from '../../catalog/application/tour-quote.service.js';
import type { PaxLine } from '../../catalog/domain/pricing.js';
import { includesThirdPartyTickets, type Locale, type Tour } from '../../catalog/domain/tour.js';
import { evaluatePaymentOptions, type PaymentOptions, type PaymentPlanPolicy } from '../../booking/domain/payment-plan.js';
import { Cart, type CartItemSnapshot } from '../domain/cart.js';
import { cartTokenMatches, generateCartToken } from './cart-token.js';

export interface CartSettings {
  /** Vigencia del carrito desde la última modificación (HU-3.1: 7 días). */
  ttlMinutes: number;
  /** Tiempo que se respeta el precio cotizado (RN-12). */
  priceLockMinutes: number;
}

export type CartIssueType = 'price_changed' | 'sold_out' | 'date_unavailable' | 'unavailable';

export interface CartIssue {
  itemId: string;
  type: CartIssueType;
  blocking: boolean;
  code: string;
  message: string;
  previousSubtotal?: Money;
  currentSubtotal?: Money;
}

export interface CartDetails {
  cart: Cart;
  tours: Map<string, Tour>;
  issues: CartIssue[];
}

export class CartNotFoundError extends NotFoundError {
  constructor() {
    super('cart-not-found', 'Carrito no encontrado.');
  }
}

export class CartHasIssuesError extends DomainError {
  constructor(issues: CartIssue[]) {
    super('cart-has-issues', 'Revisa tu carrito: hay ítems sin cupo, con fecha no disponible o con precio actualizado.', 'conflict', {
      issues: issues.map((i) => ({ itemId: i.itemId, type: i.type, code: i.code })),
    });
  }
}

/** Carga el carrito validando el token (404 si no coincide, sin revelar existencia). */
export async function loadCartWithToken(repos: TransactionalRepositories, cartId: string, token: string | undefined): Promise<Cart> {
  const cart = await repos.carts.findById(cartId);
  if (!cart || !cartTokenMatches(token, cart.tokenHash)) throw new CartNotFoundError();
  return cart;
}

const ISSUE_BY_CODE: Record<string, CartIssueType> = {
  'sold-out': 'sold_out',
  'sales-closed': 'date_unavailable',
  'no-departure': 'date_unavailable',
  'departure-mismatch': 'date_unavailable',
};

export class CartUseCases {
  private readonly quotes = new TourQuoteService();

  constructor(
    private readonly unitOfWork: UnitOfWork,
    private readonly clock: Clock,
    private readonly ids: IdGenerator,
    private readonly settings: CartSettings,
  ) {}

  /** Crea un carrito anónimo. El token se devuelve una sola vez. */
  create(input: { currency: CurrencyCode; locale: Locale }): Promise<{ token: string; details: CartDetails }> {
    return this.unitOfWork.run(async (repos) => {
      const { token, tokenHash } = generateCartToken();
      const cart = Cart.create({
        id: this.ids.next(),
        tokenHash,
        currency: input.currency,
        locale: input.locale,
        now: this.clock.now(),
        ttlMinutes: this.settings.ttlMinutes,
      });
      await repos.carts.save(cart);
      return { token, details: { cart, tours: new Map(), issues: [] } };
    });
  }

  /** Lectura con revalidación sin efectos (HU-3.3). */
  get(cartId: string, token: string | undefined): Promise<CartDetails> {
    return this.unitOfWork.run(async (repos) => {
      const cart = await loadCartWithToken(repos, cartId, token);
      cart.assertActive(this.clock.now());
      return this.inspect(cart, repos, false);
    });
  }

  addItem(
    cartId: string,
    token: string | undefined,
    input: { tourId: string; travelDate: CalendarDate; departureId?: string | null; lines: PaxLine[] },
  ): Promise<{ item: CartItemSnapshot; details: CartDetails }> {
    return this.unitOfWork.run(async (repos) => {
      const now = this.clock.now();
      const cart = await loadCartWithToken(repos, cartId, token);
      cart.assertActive(now);
      const { quote, departure } = await this.quotes.quote(
        { tourId: input.tourId, travelDate: input.travelDate, departureId: input.departureId, currency: cart.currency, lines: input.lines, now },
        repos,
      );
      const item = cart.addItem({
        id: this.ids.next(),
        departureId: departure?.id ?? null,
        quote,
        now,
        priceLockMinutes: this.settings.priceLockMinutes,
        ttlMinutes: this.settings.ttlMinutes,
      });
      await repos.carts.save(cart);
      return { item, details: await this.inspect(cart, repos, false) };
    });
  }

  removeItem(cartId: string, token: string | undefined, itemId: string): Promise<CartDetails> {
    return this.unitOfWork.run(async (repos) => {
      const cart = await loadCartWithToken(repos, cartId, token);
      cart.removeItem(itemId, this.clock.now(), this.settings.ttlMinutes);
      await repos.carts.save(cart);
      return this.inspect(cart, repos, false);
    });
  }

  /** Recotiza todos los ítems y aplica los precios nuevos (el cliente ve el cambio). */
  recalculate(cartId: string, token: string | undefined): Promise<CartDetails> {
    return this.unitOfWork.run(async (repos) => {
      const cart = await loadCartWithToken(repos, cartId, token);
      cart.assertActive(this.clock.now());
      const details = await this.inspect(cart, repos, true);
      await repos.carts.save(cart);
      return details;
    });
  }

  paymentOptions(cartId: string, token: string | undefined, policy: PaymentPlanPolicy): Promise<PaymentOptions> {
    return this.unitOfWork.run(async (repos) => {
      const cart = await loadCartWithToken(repos, cartId, token);
      cart.assertActive(this.clock.now());
      const details = await this.inspect(cart, repos, false);
      return evaluatePaymentOptions({ items: paymentPlanItems(details), now: this.clock.now(), policy });
    });
  }

  /** Job de expiración: marca como `expired` los carritos activos vencidos. */
  expireStale(limit = 500): Promise<number> {
    return this.unitOfWork.run(async (repos) => {
      const now = this.clock.now();
      const carts = await repos.carts.findExpiredActive(now, limit);
      for (const cart of carts) {
        cart.expire(now);
        await repos.carts.save(cart);
      }
      return carts.length;
    });
  }

  /**
   * Revalida cada ítem contra catálogo, tarifas y cupo actuales. Con `apply` actualiza
   * precios cambiados; sin `apply` solo informa.
   */
  async inspect(cart: Cart, repos: TransactionalRepositories, apply: boolean): Promise<CartDetails> {
    const now = this.clock.now();
    const tours = new Map<string, Tour>();
    const issues: CartIssue[] = [];
    for (const item of cart.items) {
      const tour = await repos.catalog.findTourById(item.tourId);
      if (tour) tours.set(tour.id, tour);
      try {
        const { quote } = await this.quotes.quote(
          { tourId: item.tourId, travelDate: item.travelDate, departureId: item.departureId, currency: cart.currency, lines: item.lines, now },
          repos,
        );
        const previous = Money.of(item.subtotalAmount, item.currency);
        if (!previous.equals(quote.subtotal)) {
          const lockExpired = item.priceLockedUntil.getTime() <= now.getTime();
          if (apply) cart.reprice(item.id, quote, now, this.settings.priceLockMinutes);
          issues.push({
            itemId: item.id,
            type: 'price_changed',
            blocking: !apply && lockExpired,
            code: 'price-changed',
            message: 'El precio se actualizó.',
            previousSubtotal: previous,
            currentSubtotal: quote.subtotal,
          });
        } else if (apply) {
          cart.reprice(item.id, quote, now, this.settings.priceLockMinutes);
        }
      } catch (error) {
        if (!(error instanceof DomainError)) throw error;
        issues.push({
          itemId: item.id,
          type: ISSUE_BY_CODE[error.code] ?? 'unavailable',
          blocking: true,
          code: error.code,
          message: error.message,
        });
      }
    }
    return { cart, tours, issues };
  }
}

export function paymentPlanItems(details: CartDetails) {
  return details.cart.items.map((item) => {
    const tour = details.tours.get(item.tourId);
    return {
      subtotal: Money.of(item.subtotalAmount, item.currency),
      travelDate: item.travelDate,
      depositPercentOverride: tour?.depositPercentOverride ?? null,
      includesThirdPartyTickets: tour ? includesThirdPartyTickets(tour) : false,
    };
  });
}
