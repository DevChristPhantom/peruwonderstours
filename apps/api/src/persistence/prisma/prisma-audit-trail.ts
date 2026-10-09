import type { Prisma } from '../../generated/prisma/client.js';
import { auditEntityId, auditIp, auditJson, type AuditEntry, type AuditTrail } from '../../shared/application/audit.js';
import { UuidV7Generator } from '../../shared/infrastructure/system.js';
import type { PrismaTx } from './prisma-client.js';

const ids = new UuidV7Generator();

/** Inserta acciones de aplicación en `audit_log` dentro de la transacción en curso. */
export class PrismaAuditTrail implements AuditTrail {
  constructor(private readonly db: PrismaTx) {}

  async record(entry: AuditEntry): Promise<void> {
    await this.db.auditLog.create({
      data: {
        id: ids.next(),
        occurredAt: entry.occurredAt,
        actorType: entry.actorType,
        actorId: auditEntityId(entry.actorId),
        entityType: entry.entityType.slice(0, 60),
        entityId: auditEntityId(entry.entityId),
        action: entry.action.slice(0, 40),
        changedFields: entry.changedFields ?? [],
        before: (auditJson(entry.before) ?? undefined) as Prisma.InputJsonValue | undefined,
        after: (auditJson(entry.after) ?? undefined) as Prisma.InputJsonValue | undefined,
        requestId: entry.requestId?.slice(0, 64) ?? null,
        ip: auditIp(entry.ip),
      },
    });
  }
}

/** Auditoría en memoria (modo seed/memory y pruebas unitarias). */
export class InMemoryAuditTrail implements AuditTrail {
  readonly entries: AuditEntry[] = [];
  record(entry: AuditEntry): Promise<void> {
    this.entries.push(structuredClone(entry));
    return Promise.resolve();
  }
}
