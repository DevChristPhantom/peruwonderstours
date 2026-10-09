import type { Prisma } from '../../../generated/prisma/client.js';
import { pageArgs, type AdminDatabase, type PageQuery } from '../infrastructure/admin-database.js';

/** Consulta de la bitácora (append-only) para administradores. */
export class AuditQueryService {
  constructor(private readonly db: AdminDatabase) {}

  list(filters: PageQuery & { entityType?: string; entityId?: string; actorId?: string; action?: string; from?: Date; to?: Date }) {
    return this.db.read(async (prisma) => {
      const where: Prisma.AuditLogWhereInput = {
        ...(filters.entityType ? { entityType: filters.entityType } : {}),
        ...(filters.entityId ? { entityId: filters.entityId } : {}),
        ...(filters.actorId ? { actorId: filters.actorId } : {}),
        ...(filters.action ? { action: filters.action.toUpperCase() } : {}),
        ...(filters.from || filters.to ? { occurredAt: { ...(filters.from ? { gte: filters.from } : {}), ...(filters.to ? { lte: filters.to } : {}) } } : {}),
      };
      const [total, rows] = await Promise.all([
        prisma.auditLog.count({ where }),
        prisma.auditLog.findMany({ where, orderBy: { occurredAt: 'desc' }, ...pageArgs(filters) }),
      ]);
      return {
        total,
        items: rows.map((r) => ({
          id: r.id,
          occurredAt: r.occurredAt,
          actorType: r.actorType,
          actorId: r.actorId,
          entityType: r.entityType,
          entityId: r.entityId,
          action: r.action,
          changedFields: r.changedFields,
          before: r.before,
          after: r.after,
          requestId: r.requestId,
          ip: r.ip,
        })),
      };
    });
  }
}
