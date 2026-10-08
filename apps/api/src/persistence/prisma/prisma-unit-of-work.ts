import { AsyncLocalStorage } from 'node:async_hooks';
import type { PrismaClient } from '../../generated/prisma/client.js';
import type { TransactionalRepositories, UnitOfWork } from '../../shared/application/unit-of-work.js';
import { PrismaBookingCodeGenerator, PrismaBookingRepository } from '../../modules/booking/infrastructure/prisma-booking.repository.js';
import { PrismaCartRepository } from '../../modules/cart/infrastructure/prisma-cart.repository.js';
import { PrismaCatalogRepository, PrismaInventoryRepository } from '../../modules/catalog/infrastructure/prisma-catalog.repository.js';
import { PrismaCustomerRepository } from '../../modules/customers/infrastructure/prisma-customer.repository.js';
import { PrismaPaymentEventRepository, PrismaPaymentRepository } from '../../modules/payments/infrastructure/prisma-payment.repository.js';
import { mapPrismaError, type PrismaTx } from './prisma-client.js';
import { PrismaIdempotencyRepository } from './prisma-idempotency.repository.js';
import { PrismaOutboxRepository } from './prisma-outbox.repository.js';
import {
  PrismaComplaintRepository,
  PrismaComplaintSequence,
  PrismaHolidayCalendar,
} from '../../modules/complaints/infrastructure/prisma-complaint.repository.js';

export function createPrismaRepositories(tx: PrismaTx): TransactionalRepositories {
  return {
    catalog: new PrismaCatalogRepository(tx),
    inventory: new PrismaInventoryRepository(tx),
    carts: new PrismaCartRepository(tx),
    customers: new PrismaCustomerRepository(tx),
    bookings: new PrismaBookingRepository(tx),
    bookingCodes: new PrismaBookingCodeGenerator(tx),
    payments: new PrismaPaymentRepository(tx),
    paymentEvents: new PrismaPaymentEventRepository(tx),
    idempotency: new PrismaIdempotencyRepository(tx),
    complaints: new PrismaComplaintRepository(tx),
    complaintSequence: new PrismaComplaintSequence(tx),
    holidays: new PrismaHolidayCalendar(tx),
    outbox: new PrismaOutboxRepository(tx),
  };
}

/**
 * Transacción interactiva READ COMMITTED: la concurrencia de cupos la resuelve el bloqueo
 * optimista (`version`) y el CHECK `booked + held <= capacity`; los UNIQUE cubren dobles envíos.
 */
export class PrismaUnitOfWork implements UnitOfWork {
  private readonly context = new AsyncLocalStorage<TransactionalRepositories>();

  constructor(
    private readonly client: PrismaClient,
    private readonly options: { timeoutMs: number } = { timeoutMs: 15_000 },
  ) {}

  async run<T>(work: (repos: TransactionalRepositories) => Promise<T>): Promise<T> {
    const current = this.context.getStore();
    if (current) return work(current);
    try {
      return await this.client.$transaction(
        (tx) => {
          const repos = createPrismaRepositories(tx);
          return this.context.run(repos, () => work(repos));
        },
        { isolationLevel: 'ReadCommitted', timeout: this.options.timeoutMs, maxWait: 5_000 },
      );
    } catch (error) {
      throw mapPrismaError(error);
    }
  }
}

/** Unidad de trabajo atada a una transacción externa (pruebas de integración con rollback). */
export class TransactionBoundUnitOfWork implements UnitOfWork {
  private readonly repos: TransactionalRepositories;
  constructor(tx: PrismaTx) {
    this.repos = createPrismaRepositories(tx);
  }
  run<T>(work: (repos: TransactionalRepositories) => Promise<T>): Promise<T> {
    return work(this.repos);
  }
}
