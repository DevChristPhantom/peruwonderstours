import { addMinutes, type CalendarDate } from '../../../shared/domain/calendar-date.js';
import { BusinessRuleError, ConflictError, DomainError, NotFoundError } from '../../../shared/domain/domain-error.js';
import { CurrencyMismatchError, Money, type CurrencyCode } from '../../../shared/domain/money.js';
import type { PaxType, Residency, Locale } from '../../catalog/domain/tour.js';
import type { Quote } from '../../catalog/domain/pricing.js';

export type CartStatus = 'active' | 'converted' | 'abandoned' | 'expired';

export interface CartItemLineSnapshot {
  paxType: PaxType;
  residency: Residency;
  quantity: number;
  rateId: string | null;
  unitAmount: bigint;
  lineAmount: bigint;
}

export interface CartItemSnapshot {
  id: string;
  tourId: string;
  departureId: string | null;
  travelDate: CalendarDate;
  currency: CurrencyCode;
  subtotalAmount: bigint;
  priceLockedUntil: Date;
  createdAt: Date;
  lines: CartItemLineSnapshot[];
}

export interface CartSnapshot {
  id: string;
  /** SHA-256 (hex) del token opaco que tiene el navegador. */
  tokenHash: string;
  customerId: string | null;
  currency: CurrencyCode;
  locale: Locale;
  status: CartStatus;
  expiresAt: Date;
  createdAt: Date;
  updatedAt: Date;
  items: CartItemSnapshot[];
}

export const MAX_CART_ITEMS = 20;

export class CartExpiredError extends DomainError {
  constructor(cartId: string) {
    super('cart-expired', 'Tu carrito expiró. Crea uno nuevo para continuar.', 'gone', { cartId });
  }
}

export class CartNotActiveError extends ConflictError {
  constructor(cartId: string, status: CartStatus) {
    super('cart-not-active', 'Este carrito ya no admite cambios.', { cartId, status });
  }
}

export class CartItemNotFoundError extends NotFoundError {
  constructor(itemId: string) {
    super('cart-item-not-found', 'El ítem no existe en el carrito.', { itemId });
  }
}

/** Agregado carrito: una sola moneda, ítems con precio congelado hasta `priceLockedUntil`. */
export class Cart {
  private constructor(private props: CartSnapshot) {}

  static create(params: {
    id: string;
    tokenHash: string;
    currency: CurrencyCode;
    locale: Locale;
    now: Date;
    ttlMinutes: number;
  }): Cart {
    return new Cart({
      id: params.id,
      tokenHash: params.tokenHash,
      customerId: null,
      currency: params.currency,
      locale: params.locale,
      status: 'active',
      expiresAt: addMinutes(params.now, params.ttlMinutes),
      createdAt: params.now,
      updatedAt: params.now,
      items: [],
    });
  }

  static restore(snapshot: CartSnapshot): Cart {
    return new Cart(structuredClone(snapshot));
  }

  get id(): string {
    return this.props.id;
  }
  get tokenHash(): string {
    return this.props.tokenHash;
  }
  get currency(): CurrencyCode {
    return this.props.currency;
  }
  get locale(): Locale {
    return this.props.locale;
  }
  get status(): CartStatus {
    return this.props.status;
  }
  get expiresAt(): Date {
    return this.props.expiresAt;
  }
  get items(): readonly CartItemSnapshot[] {
    return this.props.items;
  }

  isExpired(now: Date): boolean {
    return this.props.status === 'expired' || this.props.expiresAt.getTime() <= now.getTime();
  }

  /** Lanza si el carrito no puede modificarse ni pagarse. */
  assertActive(now: Date): void {
    if (this.isExpired(now)) throw new CartExpiredError(this.id);
    if (this.props.status !== 'active') throw new CartNotActiveError(this.id, this.props.status);
  }

  total(): Money {
    return this.props.items.reduce((acc, item) => acc.add(Money.of(item.subtotalAmount, item.currency)), Money.zero(this.props.currency));
  }

  addItem(params: {
    id: string;
    departureId: string | null;
    quote: Quote;
    now: Date;
    priceLockMinutes: number;
    ttlMinutes: number;
  }): CartItemSnapshot {
    const { quote, now } = params;
    this.assertActive(now);
    if (quote.currency !== this.props.currency) {
      throw new CurrencyMismatchError(this.props.currency, quote.currency);
    }
    if (this.props.items.length >= MAX_CART_ITEMS) {
      throw new BusinessRuleError('cart-full', `El carrito admite como máximo ${MAX_CART_ITEMS} ítems.`);
    }
    const duplicate = this.props.items.find(
      (i) => i.tourId === quote.tourId && i.travelDate === quote.travelDate && i.departureId === params.departureId,
    );
    if (duplicate) {
      throw new ConflictError('cart-item-duplicate', 'Este tour ya está en tu carrito para esa fecha. Edítalo o quítalo.', {
        itemId: duplicate.id,
      });
    }
    const item: CartItemSnapshot = {
      id: params.id,
      tourId: quote.tourId,
      departureId: params.departureId,
      travelDate: quote.travelDate,
      currency: quote.currency,
      subtotalAmount: quote.subtotal.amount,
      priceLockedUntil: addMinutes(now, params.priceLockMinutes),
      createdAt: now,
      lines: quote.lines.map((l) => ({
        paxType: l.paxType,
        residency: l.residency,
        quantity: l.quantity,
        rateId: l.rateId,
        unitAmount: l.unitAmount.amount,
        lineAmount: l.lineAmount.amount,
      })),
    };
    this.props.items.push(item);
    this.touch(now, params.ttlMinutes);
    return item;
  }

  removeItem(itemId: string, now: Date, ttlMinutes: number): void {
    this.assertActive(now);
    const index = this.props.items.findIndex((i) => i.id === itemId);
    if (index < 0) throw new CartItemNotFoundError(itemId);
    this.props.items.splice(index, 1);
    this.touch(now, ttlMinutes);
  }

  /** Reemplaza el precio de un ítem por una cotización nueva (RN-12: el cliente ve el cambio). */
  reprice(itemId: string, quote: Quote, now: Date, priceLockMinutes: number): { previous: Money; current: Money } {
    const item = this.props.items.find((i) => i.id === itemId);
    if (!item) throw new CartItemNotFoundError(itemId);
    const previous = Money.of(item.subtotalAmount, item.currency);
    item.subtotalAmount = quote.subtotal.amount;
    item.priceLockedUntil = addMinutes(now, priceLockMinutes);
    item.lines = quote.lines.map((l) => ({
      paxType: l.paxType,
      residency: l.residency,
      quantity: l.quantity,
      rateId: l.rateId,
      unitAmount: l.unitAmount.amount,
      lineAmount: l.lineAmount.amount,
    }));
    this.props.updatedAt = now;
    return { previous, current: quote.subtotal };
  }

  markConverted(now: Date): void {
    this.assertActive(now);
    this.props.status = 'converted';
    this.props.updatedAt = now;
  }

  expire(now: Date): void {
    if (this.props.status !== 'active') return;
    this.props.status = 'expired';
    this.props.updatedAt = now;
  }

  toSnapshot(): CartSnapshot {
    return structuredClone(this.props);
  }

  private touch(now: Date, ttlMinutes: number): void {
    this.props.updatedAt = now;
    this.props.expiresAt = addMinutes(now, ttlMinutes);
  }
}
