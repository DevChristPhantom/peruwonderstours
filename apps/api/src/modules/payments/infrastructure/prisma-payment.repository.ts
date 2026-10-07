import { Prisma, type PaymentProvider } from '../../../generated/prisma/client.js';
import type { PrismaTx } from '../../../persistence/prisma/prisma-client.js';
import { DomainError } from '../../../shared/domain/domain-error.js';
import { assertCurrencyCode } from '../../../shared/domain/money.js';
import { DuplicatePaymentEventError } from '../application/payment.use-cases.js';
import { Payment, type PaymentEvent, type PaymentProviderCode } from '../domain/payment.js';
import type { PaymentEventRepository, PaymentRepository } from '../domain/payment.repository.js';

/**
 * El enum `payment_provider` de PostgreSQL no incluye `sandbox` (pendiente DBA). Mientras
 * tanto la pasarela simulada solo funciona con DATA_SOURCE=seed|memory.
 */
function toDbProvider(provider: PaymentProviderCode): PaymentProvider {
  if (provider === 'sandbox') {
    throw new DomainError(
      'provider-not-persistable',
      'El proveedor sandbox no existe en el enum payment_provider de la base de datos.',
      'unavailable',
    );
  }
  return provider;
}

type PaymentRow = Prisma.PaymentGetPayload<object>;

function mapPayment(row: PaymentRow): Payment {
  return Payment.restore({
    id: row.id,
    bookingId: row.bookingId,
    kind: row.kind,
    provider: row.provider,
    method: row.method,
    status: row.status,
    amount: row.amount,
    currency: assertCurrencyCode(row.currency),
    bookingCurrencyAmount: row.bookingCurrencyAmount,
    providerPaymentId: row.providerPaymentId,
    idempotencyKey: row.idempotencyKey,
    parentPaymentId: row.parentPaymentId,
    failureCode: row.failureCode,
    failureMessage: row.failureMessage,
    succeededAt: row.succeededAt,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  });
}

export class PrismaPaymentRepository implements PaymentRepository {
  constructor(private readonly db: PrismaTx) {}

  async findById(id: string): Promise<Payment | null> {
    const row = await this.db.payment.findUnique({ where: { id } });
    return row ? mapPayment(row) : null;
  }

  async findByIdempotencyKey(key: string): Promise<Payment | null> {
    const row = await this.db.payment.findUnique({ where: { idempotencyKey: key } });
    return row ? mapPayment(row) : null;
  }

  async findByProviderPaymentId(provider: PaymentProviderCode, providerPaymentId: string): Promise<Payment | null> {
    if (provider === 'sandbox') return null;
    const row = await this.db.payment.findUnique({ where: { provider_providerPaymentId: { provider, providerPaymentId } } });
    return row ? mapPayment(row) : null;
  }

  async findByBooking(bookingId: string): Promise<Payment[]> {
    const rows = await this.db.payment.findMany({ where: { bookingId }, orderBy: { createdAt: 'asc' } });
    return rows.map(mapPayment);
  }

  async save(payment: Payment): Promise<void> {
    const s = payment.toSnapshot();
    const data = {
      status: s.status,
      method: s.method,
      providerPaymentId: s.providerPaymentId,
      failureCode: s.failureCode,
      failureMessage: s.failureMessage,
      succeededAt: s.succeededAt,
    };
    await this.db.payment.upsert({
      where: { id: s.id },
      create: {
        id: s.id,
        bookingId: s.bookingId,
        kind: s.kind,
        provider: toDbProvider(s.provider),
        amount: s.amount,
        currency: s.currency,
        bookingCurrencyAmount: s.bookingCurrencyAmount,
        idempotencyKey: s.idempotencyKey,
        parentPaymentId: s.parentPaymentId,
        createdAt: s.createdAt,
        ...data,
      },
      update: data,
    });
  }
}

export class PrismaPaymentEventRepository implements PaymentEventRepository {
  constructor(private readonly db: PrismaTx) {}

  async find(provider: PaymentProviderCode, eventId: string): Promise<PaymentEvent | null> {
    if (provider === 'sandbox') return null;
    const row = await this.db.paymentEvent.findUnique({ where: { provider_eventId: { provider, eventId } } });
    if (!row) return null;
    return {
      id: row.id,
      provider: row.provider,
      eventId: row.eventId,
      eventType: row.eventType,
      paymentId: row.paymentId,
      signatureValid: row.signatureValid,
      payload: (row.payload ?? {}) as Record<string, unknown>,
      processingStatus: row.processingStatus,
      attempts: row.attempts,
      lastError: row.lastError,
      receivedAt: row.receivedAt,
      processedAt: row.processedAt,
    };
  }

  async insert(event: PaymentEvent): Promise<void> {
    try {
      await this.db.paymentEvent.create({
        data: {
          id: event.id,
          provider: toDbProvider(event.provider),
          eventId: event.eventId,
          eventType: event.eventType,
          paymentId: event.paymentId,
          signatureValid: event.signatureValid,
          payload: event.payload as Prisma.InputJsonValue,
          processingStatus: event.processingStatus,
          attempts: event.attempts,
          lastError: event.lastError,
          receivedAt: event.receivedAt,
          processedAt: event.processedAt,
        },
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new DuplicatePaymentEventError(event.provider, event.eventId);
      }
      throw error;
    }
  }

  async update(event: PaymentEvent): Promise<void> {
    await this.db.paymentEvent.update({
      where: { provider_eventId: { provider: toDbProvider(event.provider), eventId: event.eventId } },
      data: {
        paymentId: event.paymentId,
        processingStatus: event.processingStatus,
        attempts: event.attempts,
        lastError: event.lastError,
        processedAt: event.processedAt,
      },
    });
  }
}
