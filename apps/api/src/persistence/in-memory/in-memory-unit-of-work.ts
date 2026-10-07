import { AsyncLocalStorage } from 'node:async_hooks';
import type { TransactionalRepositories, UnitOfWork } from '../../shared/application/unit-of-work.js';
import type { InMemoryDataStore } from './in-memory-data-store.js';
import { createInMemoryRepositories } from './in-memory-repositories.js';

/**
 * Unidad de trabajo en memoria: serializa las transacciones (equivalente a SERIALIZABLE)
 * y revierte el estado completo si el trabajo lanza. Las llamadas anidadas se ejecutan
 * dentro de la transacción en curso.
 */
export class InMemoryUnitOfWork implements UnitOfWork {
  private queue: Promise<unknown> = Promise.resolve();
  private readonly context = new AsyncLocalStorage<boolean>();
  private readonly repos: TransactionalRepositories;

  constructor(private readonly store: InMemoryDataStore) {
    this.repos = createInMemoryRepositories(store);
  }

  run<T>(work: (repos: TransactionalRepositories) => Promise<T>): Promise<T> {
    if (this.context.getStore()) return work(this.repos);
    const next = this.queue.then(() =>
      this.context.run(true, async () => {
        const snapshot = this.store.snapshot();
        try {
          return await work(this.repos);
        } catch (error) {
          this.store.restore(snapshot);
          throw error;
        }
      }),
    );
    this.queue = next.catch(() => undefined);
    return next;
  }
}
