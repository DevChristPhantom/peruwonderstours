import type { Prisma } from '../../../generated/prisma/client.js';
import type { PrismaTx } from '../../../persistence/prisma/prisma-client.js';
import { calendarDateFromUtcDate, calendarDateToUtcDate } from '../../../shared/domain/calendar-date.js';
import { assertCurrencyCode } from '../../../shared/domain/money.js';
import { Cart } from '../domain/cart.js';
import type { CartRepository } from '../domain/cart.repository.js';

const CART_INCLUDE = { items: { include: { lines: true }, orderBy: { createdAt: 'asc' } } } satisfies Prisma.CartInclude;
type CartRow = Prisma.CartGetPayload<{ include: typeof CART_INCLUDE }>;

function mapCart(row: CartRow): Cart {
  return Cart.restore({
    id: row.id,
    tokenHash: Buffer.from(row.tokenHash).toString('hex'),
    customerId: row.customerId,
    currency: assertCurrencyCode(row.currency),
    locale: row.locale,
    status: row.status,
    expiresAt: row.expiresAt,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    items: row.items.map((i) => ({
      id: i.id,
      tourId: i.tourId,
      departureId: i.departureId,
      travelDate: calendarDateFromUtcDate(i.travelDate),
      currency: assertCurrencyCode(i.currency),
      subtotalAmount: i.subtotalAmount,
      priceLockedUntil: i.priceLockedUntil,
      createdAt: i.createdAt,
      lines: i.lines.map((l) => ({
        paxType: l.paxType,
        residency: l.residency,
        quantity: l.quantity,
        rateId: l.rateId,
        unitAmount: l.unitAmount,
        lineAmount: l.lineAmount,
      })),
    })),
  });
}

export class PrismaCartRepository implements CartRepository {
  constructor(private readonly db: PrismaTx) {}

  async findById(id: string): Promise<Cart | null> {
    const row = await this.db.cart.findUnique({ where: { id }, include: CART_INCLUDE });
    return row ? mapCart(row) : null;
  }

  /** Upsert del carrito; los ítems se sincronizan (borrar ausentes, recrear líneas). */
  async save(cart: Cart): Promise<void> {
    const s = cart.toSnapshot();
    const data = {
      customerId: s.customerId,
      currency: s.currency,
      locale: s.locale,
      status: s.status,
      expiresAt: s.expiresAt,
    };
    await this.db.cart.upsert({
      where: { id: s.id },
      create: { id: s.id, tokenHash: Buffer.from(s.tokenHash, 'hex'), createdAt: s.createdAt, ...data },
      update: data,
    });
    const keep = s.items.map((i) => i.id);
    await this.db.cartItem.deleteMany({ where: { cartId: s.id, id: { notIn: keep } } });
    for (const item of s.items) {
      const itemData = {
        tourId: item.tourId,
        departureId: item.departureId,
        travelDate: calendarDateToUtcDate(item.travelDate),
        subtotalAmount: item.subtotalAmount,
        currency: item.currency,
        priceLockedUntil: item.priceLockedUntil,
      };
      await this.db.cartItem.upsert({
        where: { id: item.id },
        create: { id: item.id, cartId: s.id, createdAt: item.createdAt, ...itemData },
        update: itemData,
      });
      await this.db.cartItemLine.deleteMany({ where: { cartItemId: item.id } });
      await this.db.cartItemLine.createMany({
        data: item.lines.map((l) => ({
          cartItemId: item.id,
          rateId: l.rateId,
          paxType: l.paxType,
          residency: l.residency,
          quantity: l.quantity,
          unitAmount: l.unitAmount,
          lineAmount: l.lineAmount,
        })),
      });
    }
  }

  async findExpiredActive(now: Date, limit: number): Promise<Cart[]> {
    const rows = await this.db.cart.findMany({
      where: { status: 'active', expiresAt: { lte: now } },
      include: CART_INCLUDE,
      take: limit,
      orderBy: { expiresAt: 'asc' },
    });
    return rows.map(mapCart);
  }
}
