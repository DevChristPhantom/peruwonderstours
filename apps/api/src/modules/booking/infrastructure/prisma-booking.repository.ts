import type { Prisma } from '../../../generated/prisma/client.js';
import type { PrismaTx } from '../../../persistence/prisma/prisma-client.js';
import { calendarDateFromUtcDate, calendarDateToUtcDate } from '../../../shared/domain/calendar-date.js';
import { ConcurrencyError } from '../../../shared/domain/domain-error.js';
import { assertCurrencyCode } from '../../../shared/domain/money.js';
import { Booking } from '../domain/booking.js';
import { formatBookingCode, type BookingCodeGenerator, type BookingRepository } from '../domain/booking.repository.js';

const BOOKING_INCLUDE = { items: { include: { lines: true }, orderBy: { createdAt: 'asc' } } } satisfies Prisma.BookingInclude;
type BookingRow = Prisma.BookingGetPayload<{ include: typeof BOOKING_INCLUDE }>;

function mapBooking(row: BookingRow): Booking {
  return Booking.restore({
    id: row.id,
    code: row.code,
    customerId: row.customerId,
    cartId: row.cartId,
    status: row.status,
    source: row.source,
    locale: row.locale,
    currency: assertCurrencyCode(row.currency),
    subtotalAmount: row.subtotalAmount,
    discountAmount: row.discountAmount,
    totalAmount: row.totalAmount,
    paymentOption: row.paymentOption,
    depositPercent: row.depositPercent,
    depositAmount: row.depositAmount,
    balanceAmount: row.balanceAmount,
    balanceDueAt: row.balanceDueAt,
    paidAmount: row.paidAmount,
    refundedAmount: row.refundedAmount,
    holdExpiresAt: row.holdExpiresAt,
    firstServiceDate: calendarDateFromUtcDate(row.firstServiceDate),
    lastServiceDate: calendarDateFromUtcDate(row.lastServiceDate),
    cancellationPolicyVersion: row.cancellationPolicyVersion,
    termsVersion: row.termsVersion,
    customerNotes: row.customerNotes,
    accessTokenHash: row.accessTokenHash,
    confirmedAt: row.confirmedAt,
    cancelledAt: row.cancelledAt,
    cancellationReason: row.cancellationReason,
    refundDueAmount: row.refundDueAmount,
    version: row.version,
    completedAt: row.completedAt,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    items: row.items.map((i) => ({
      id: i.id,
      tourId: i.tourId,
      departureId: i.departureId,
      travelDate: calendarDateFromUtcDate(i.travelDate),
      status: i.status,
      tourTitle: i.tourTitle,
      paxCount: i.paxCount,
      subtotalAmount: i.subtotalAmount,
      currency: assertCurrencyCode(i.currency),
      lines: i.lines.map((l) => ({
        paxType: l.paxType,
        residency: l.residency,
        quantity: l.quantity,
        rateId: l.rateId,
        unitAmount: l.unitAmount,
        lineAmount: l.lineAmount,
      })),
    })),
    // El historial vive en booking_status_history (lo escribe el trigger).
    statusHistory: [],
  });
}

export class PrismaBookingRepository implements BookingRepository {
  constructor(private readonly db: PrismaTx) {}

  async findById(id: string): Promise<Booking | null> {
    const row = await this.db.booking.findFirst({ where: { id, deletedAt: null }, include: BOOKING_INCLUDE });
    return row ? mapBooking(row) : null;
  }

  async findByIdForUpdate(id: string): Promise<Booking | null> {
    const locked = await this.db.$queryRaw<Array<{ id: string }>>`SELECT id FROM bookings WHERE id = ${id}::uuid AND deleted_at IS NULL FOR UPDATE`;
    if (locked.length === 0) return null;
    return this.findById(id);
  }

  async findByCartId(cartId: string): Promise<Booking | null> {
    const row = await this.db.booking.findUnique({ where: { cartId }, include: BOOKING_INCLUDE });
    return row ? mapBooking(row) : null;
  }

  async findByCode(code: string): Promise<Booking | null> {
    const row = await this.db.booking.findUnique({ where: { code }, include: BOOKING_INCLUDE });
    return row ? mapBooking(row) : null;
  }

  async save(booking: Booking): Promise<void> {
    const s = booking.toSnapshot();
    const lastChange = s.statusHistory.at(-1);
    // Contexto para el trigger de historial/auditoría (SET LOCAL equivalente). Sin cambio de
    // estado en esta sesión se conserva el actor fijado por la transacción (p. ej. el staff).
    if (lastChange) {
      await this.db.$queryRaw`SELECT set_config('app.actor_type', ${lastChange.actorType}, true),
                                     set_config('app.status_reason', ${lastChange.reason ?? ''}, true)`;
    }
    const mutable = {
      status: s.status,
      paidAmount: s.paidAmount,
      refundedAmount: s.refundedAmount,
      holdExpiresAt: s.holdExpiresAt,
      confirmedAt: s.confirmedAt,
      cancelledAt: s.cancelledAt,
      cancellationReason: s.cancellationReason,
      refundDueAmount: s.refundDueAmount ?? null,
      completedAt: s.completedAt,
      accessTokenHash: s.accessTokenHash,
    };
    const exists = await this.db.booking.findUnique({ where: { id: s.id }, select: { id: true } });
    if (exists) {
      const expected = s.version ?? 0;
      const updated = await this.db.booking.updateMany({ where: { id: s.id, version: expected }, data: { ...mutable, version: expected + 1 } });
      if (updated.count === 0) {
        throw new ConcurrencyError('La reserva fue modificada por otra operación al mismo tiempo. Intenta de nuevo.');
      }
      booking.markPersisted(expected + 1);
      for (const item of s.items) {
        await this.db.bookingItem.update({ where: { id: item.id }, data: { status: item.status } });
      }
      return;
    }
    await this.db.booking.create({
      data: {
        id: s.id,
        code: s.code,
        customerId: s.customerId,
        cartId: s.cartId,
        source: s.source,
        locale: s.locale,
        currency: s.currency,
        subtotalAmount: s.subtotalAmount,
        discountAmount: s.discountAmount,
        totalAmount: s.totalAmount,
        paymentOption: s.paymentOption,
        depositPercent: s.depositPercent,
        depositAmount: s.depositAmount,
        balanceAmount: s.balanceAmount,
        balanceDueAt: s.balanceDueAt,
        firstServiceDate: calendarDateToUtcDate(s.firstServiceDate),
        lastServiceDate: calendarDateToUtcDate(s.lastServiceDate),
        cancellationPolicyVersion: s.cancellationPolicyVersion,
        termsVersion: s.termsVersion,
        customerNotes: s.customerNotes,
        createdAt: s.createdAt,
        ...mutable,
        items: {
          create: s.items.map((item) => ({
            id: item.id,
            tourId: item.tourId,
            departureId: item.departureId,
            travelDate: calendarDateToUtcDate(item.travelDate),
            status: item.status,
            tourTitle: item.tourTitle,
            paxCount: item.paxCount,
            subtotalAmount: item.subtotalAmount,
            currency: item.currency,
            lines: {
              create: item.lines.map((l) => ({
                rateId: l.rateId,
                paxType: l.paxType,
                residency: l.residency,
                quantity: l.quantity,
                unitAmount: l.unitAmount,
                lineAmount: l.lineAmount,
              })),
            },
          })),
        },
      },
    });
  }

  async findBalanceDueBetween(from: Date, to: Date, limit: number): Promise<Booking[]> {
    const rows = await this.db.booking.findMany({
      where: { status: 'partially_paid', deletedAt: null, balanceDueAt: { gte: from, lte: to } },
      include: BOOKING_INCLUDE,
      take: limit,
      orderBy: { balanceDueAt: 'asc' },
    });
    return rows.map(mapBooking);
  }

  async findWithExpiredHold(now: Date, limit: number): Promise<Booking[]> {
    const rows = await this.db.booking.findMany({
      where: { status: 'held', holdExpiresAt: { lte: now } },
      include: BOOKING_INCLUDE,
      take: limit,
      orderBy: { holdExpiresAt: 'asc' },
    });
    return rows.map(mapBooking);
  }
}

/** Usa next_document_number('booking', año): correlativo sin huecos bajo bloqueo de fila. */
export class PrismaBookingCodeGenerator implements BookingCodeGenerator {
  constructor(private readonly db: PrismaTx) {}

  async next(year: number): Promise<string> {
    const rows = await this.db.$queryRaw<Array<{ value: number }>>`
      SELECT next_document_number('booking'::sequence_scope, ${year}::int) AS value`;
    return formatBookingCode(year, Number(rows[0]!.value));
  }
}
