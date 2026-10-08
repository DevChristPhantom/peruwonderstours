import type { PrismaClient } from '../../../generated/prisma/client.js';
import { mapPrismaError, type PrismaTx } from '../../../persistence/prisma/prisma-client.js';
import { PrismaAuditTrail } from '../../../persistence/prisma/prisma-audit-trail.js';
import { createPrismaRepositories } from '../../../persistence/prisma/prisma-unit-of-work.js';
import { auditIp, type AuditEntry, type RequestMeta } from '../../../shared/application/audit.js';
import type { TransactionalRepositories } from '../../../shared/application/unit-of-work.js';
import { calendarDateFromUtcDate, calendarDateToUtcDate, type CalendarDate } from '../../../shared/domain/calendar-date.js';
import { ServiceUnavailableError } from '../../../shared/domain/domain-error.js';
import type { Clock } from '../../../shared/domain/ports.js';
import type { StaffActor } from '../../identity/application/staff-auth.use-cases.js';

/** Contexto de una operación del backoffice dentro de una transacción. */
export interface AdminTx {
  tx: PrismaTx;
  /** Repositorios de dominio ligados a la MISMA transacción (reservas, inventario, outbox...). */
  repos: TransactionalRepositories;
  actor: StaffActor;
  meta: RequestMeta;
  now: Date;
  /** Registra la acción en audit_log con actorId del staff. */
  audit(entry: Omit<AuditEntry, 'actorType' | 'actorId' | 'occurredAt' | 'ip' | 'requestId'>): Promise<void>;
}

export class BackofficeUnavailableError extends ServiceUnavailableError {
  constructor() {
    super('backoffice-requires-database', 'El backoffice requiere PostgreSQL (DATA_SOURCE=prisma).');
  }
}

/**
 * Acceso a PostgreSQL del backoffice. Cada escritura corre en una transacción READ COMMITTED
 * con el contexto del actor (`app.actor_type/actor_id/request_id/client_ip`) para que los
 * triggers de auditoría de fila registren al usuario del staff, además de la acción
 * semántica que escribe la aplicación.
 */
export class AdminDatabase {
  constructor(
    private readonly client: PrismaClient | null,
    private readonly clock: Clock,
  ) {}

  now(): Date {
    return this.clock.now();
  }

  get available(): boolean {
    return this.client !== null;
  }

  get prisma(): PrismaClient {
    if (!this.client) throw new BackofficeUnavailableError();
    return this.client;
  }

  /** Lecturas (sin transacción explícita). */
  read<T>(work: (db: PrismaClient, now: Date) => Promise<T>): Promise<T> {
    return work(this.prisma, this.clock.now()).catch((error: unknown) => {
      throw mapPrismaError(error);
    });
  }

  async run<T>(actor: StaffActor, meta: RequestMeta, work: (ctx: AdminTx) => Promise<T>): Promise<T> {
    const client = this.prisma;
    const now = this.clock.now();
    try {
      return await client.$transaction(
        async (tx) => {
          await tx.$queryRaw`SELECT set_config('app.actor_type', 'user', true),
                                    set_config('app.actor_id', ${actor.userId}, true),
                                    set_config('app.request_id', ${meta.requestId ?? ''}, true),
                                    set_config('app.client_ip', ${auditIp(meta.ip) ?? ''}, true)`;
          const audit = new PrismaAuditTrail(tx);
          return work({
            tx,
            repos: createPrismaRepositories(tx),
            actor,
            meta,
            now,
            audit: (entry) =>
              audit.record({ ...entry, actorType: 'user', actorId: actor.userId, occurredAt: now, ip: meta.ip, requestId: meta.requestId }),
          });
        },
        { isolationLevel: 'ReadCommitted', timeout: 20_000, maxWait: 5_000 },
      );
    } catch (error) {
      throw mapPrismaError(error);
    }
  }

  /** Días no hábiles nacionales en un rango (plazos legales). */
  async holidays(from: CalendarDate, to: CalendarDate): Promise<Set<CalendarDate>> {
    const rows = await this.prisma.businessHoliday.findMany({
      where: { scope: 'national', holidayDate: { gte: calendarDateToUtcDate(from), lte: calendarDateToUtcDate(to) } },
      select: { holidayDate: true },
    });
    return new Set(rows.map((r) => calendarDateFromUtcDate(r.holidayDate)));
  }
}

/** Página estándar del backoffice. */
export interface PageQuery {
  page: number;
  pageSize: number;
}

export function pageArgs(q: PageQuery): { skip: number; take: number } {
  return { skip: (q.page - 1) * q.pageSize, take: q.pageSize };
}
