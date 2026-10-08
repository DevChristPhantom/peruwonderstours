import type { Prisma } from '../../../generated/prisma/client.js';
import type { RequestMeta } from '../../../shared/application/audit.js';
import type { PiiCipher } from '../../../shared/application/pii-cipher.js';
import { addDays, toLimaCalendarDate } from '../../../shared/domain/calendar-date.js';
import { ConcurrencyError, ConflictError, NotFoundError, ValidationError } from '../../../shared/domain/domain-error.js';
import type { IdGenerator } from '../../../shared/domain/ports.js';
import type { StaffActor } from '../../identity/application/staff-auth.use-cases.js';
import { normalizeSubjectEmail } from '../../privacy/domain/consent.js';
import { dsrDueAt, dsrExtendedDueAt, type DsrType } from '../domain/backoffice-rules.js';
import { pageArgs, type AdminDatabase, type AdminTx, type PageQuery } from '../infrastructure/admin-database.js';

type DsrRow = Prisma.DataSubjectRequestGetPayload<{ include: { respondedBy: { select: { id: true; fullName: true } } } }>;
export type DsrStatus = 'received' | 'in_progress' | 'answered' | 'rejected' | 'withdrawn';
export type DsrChannel = 'email' | 'web' | 'office' | 'phone' | 'letter';

const OPEN: readonly DsrStatus[] = ['received', 'in_progress'];

function present(r: DsrRow, now: Date) {
  return {
    id: r.id,
    code: r.code,
    type: r.type,
    status: r.status,
    subjectName: r.subjectName,
    subjectEmail: r.subjectEmail,
    customerId: r.customerId,
    channel: r.channel,
    detail: r.detail,
    receivedAt: r.receivedAt,
    dueAt: r.dueAt,
    overdue: OPEN.includes(r.status) && now.getTime() > r.dueAt.getTime(),
    extended: r.extendedAt !== null,
    extendedAt: r.extendedAt,
    extensionReason: r.extensionReason,
    response: r.responseText ? { text: r.responseText, respondedAt: r.respondedAt, respondedBy: r.respondedBy } : null,
    version: r.version,
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
  };
}

export class DsrNotFoundError extends NotFoundError {
  constructor() {
    super('privacy-request-not-found', 'Solicitud no encontrada.');
  }
}

/**
 * Solicitudes de derechos del titular (ARCO, portabilidad, revocación) con plazos en días
 * hábiles (Reglamento Ley 29733, art. 69) y ampliación única (art. 71). Endpoints básicos.
 */
export class PrivacyAdminService {
  constructor(
    private readonly db: AdminDatabase,
    private readonly ids: IdGenerator,
    private readonly cipher: PiiCipher,
  ) {}

  list(filters: PageQuery & { status?: DsrStatus; type?: DsrType; overdue?: boolean }) {
    return this.db.read(async (prisma, now) => {
      const where: Prisma.DataSubjectRequestWhereInput = {
        ...(filters.status ? { status: filters.status } : {}),
        ...(filters.type ? { type: filters.type } : {}),
        ...(filters.overdue ? { status: { in: [...OPEN] }, dueAt: { lt: now } } : {}),
      };
      const [total, rows] = await Promise.all([
        prisma.dataSubjectRequest.count({ where }),
        prisma.dataSubjectRequest.findMany({ where, orderBy: [{ dueAt: 'asc' }], ...pageArgs(filters), include: { respondedBy: { select: { id: true, fullName: true } } } }),
      ]);
      return { total, items: rows.map((r) => present(r, now)) };
    });
  }

  async get(actor: StaffActor, meta: RequestMeta, id: string) {
    return this.db.run(actor, meta, async (ctx) => {
      const row = await this.load(ctx, id);
      await ctx.audit({ entityType: 'data_subject_requests', entityId: row.id, action: 'PRIVACY_REQUEST_VIEWED' });
      return present(row, ctx.now);
    });
  }

  create(
    actor: StaffActor,
    meta: RequestMeta,
    input: { type: DsrType; subjectName: string; subjectEmail: string; channel: DsrChannel; detail: string; receivedAt?: Date },
  ) {
    const email = normalizeSubjectEmail(input.subjectEmail);
    return this.db.run(actor, meta, async (ctx) => {
      const receivedAt = input.receivedAt ?? ctx.now;
      if (receivedAt.getTime() > ctx.now.getTime() + 60_000) {
        throw new ValidationError('validation-failed', 'La fecha de recepción no puede ser futura.', { errors: [{ field: 'receivedAt', messages: ['No puede ser futura.'] }] });
      }
      const day = toLimaCalendarDate(receivedAt);
      const holidays = await this.db.holidays(day, addDays(day, 90));
      const dueAt = dsrDueAt(input.type, receivedAt, holidays);
      const year = Number(day.slice(0, 4));
      const rows = await ctx.tx.$queryRaw<Array<{ value: number }>>`SELECT next_document_number('data_subject_request'::sequence_scope, ${year}::int) AS value`;
      const code = `ARCO-${year}-${String(Number(rows[0]!.value)).padStart(6, '0')}`;
      const customer = await ctx.tx.customer.findUnique({ where: { email }, select: { id: true } });
      const row = await ctx.tx.dataSubjectRequest.create({
        data: {
          id: this.ids.next(),
          code,
          type: input.type,
          subjectName: input.subjectName.trim(),
          subjectEmail: email,
          subjectEmailHash: Uint8Array.from(this.cipher.hash(email)),
          customerId: customer?.id ?? null,
          channel: input.channel,
          detail: input.detail.trim(),
          receivedAt,
          dueAt,
          createdByUserId: actor.userId,
        },
        include: { respondedBy: { select: { id: true, fullName: true } } },
      });
      await ctx.audit({ entityType: 'data_subject_requests', entityId: row.id, action: 'PRIVACY_REQUEST_CREATED', after: { code, type: input.type, dueAt: dueAt.toISOString() } });
      return present(row, ctx.now);
    });
  }

  setStatus(actor: StaffActor, meta: RequestMeta, id: string, input: { status: 'in_progress' | 'withdrawn'; version: number }) {
    return this.mutate(actor, meta, id, input.version, 'PRIVACY_REQUEST_STATUS', (row) => {
      if (!OPEN.includes(row.status)) throw new ConflictError('privacy-request-closed', 'La solicitud ya está cerrada.');
      return { status: input.status };
    });
  }

  extend(actor: StaffActor, meta: RequestMeta, id: string, input: { reason: string; version: number }) {
    return this.mutate(actor, meta, id, input.version, 'PRIVACY_REQUEST_EXTENDED', async (row) => {
      if (!OPEN.includes(row.status)) throw new ConflictError('privacy-request-closed', 'La solicitud ya está cerrada.');
      if (row.extendedAt) throw new ConflictError('privacy-request-already-extended', 'El plazo solo puede ampliarse una vez.');
      const day = toLimaCalendarDate(row.dueAt);
      const holidays = await this.db.holidays(day, addDays(day, 90));
      return { dueAt: dsrExtendedDueAt(row.type, row.dueAt, holidays), extendedAt: this.db.now(), extensionReason: input.reason.trim().slice(0, 1000) };
    });
  }

  respond(actor: StaffActor, meta: RequestMeta, id: string, input: { status: 'answered' | 'rejected'; responseText: string; version: number }) {
    return this.mutate(actor, meta, id, input.version, 'PRIVACY_REQUEST_ANSWERED', (row) => {
      if (!OPEN.includes(row.status)) throw new ConflictError('privacy-request-closed', 'La solicitud ya está cerrada.');
      return { status: input.status, responseText: input.responseText.trim(), respondedAt: this.db.now(), respondedByUserId: actor.userId };
    });
  }

  /** Historial de consentimientos y aceptaciones de un titular (por HMAC del correo). */
  consentHistory(actor: StaffActor, meta: RequestMeta, email: string) {
    const normalized = normalizeSubjectEmail(email);
    const hash = Uint8Array.from(this.cipher.hash(normalized));
    return this.db.run(actor, meta, async (ctx) => {
      const [consents, acceptances] = await Promise.all([
        ctx.tx.consent.findMany({ where: { subjectEmailHash: hash }, orderBy: { createdAt: 'asc' } }),
        ctx.tx.legalAcceptance.findMany({ where: { subjectEmailHash: hash }, orderBy: { createdAt: 'asc' } }),
      ]);
      await ctx.audit({ entityType: 'consents', entityId: null, action: 'CONSENT_HISTORY_VIEWED', after: { records: consents.length } });
      const current: Record<string, boolean> = {};
      for (const c of consents) current[c.purpose] = c.granted;
      return {
        current,
        consents: consents.map((c) => ({ purpose: c.purpose, granted: c.granted, method: c.method, source: c.source, policyVersion: c.policyVersion, createdAt: c.createdAt })),
        legalAcceptances: acceptances.map((a) => ({ document: a.document, documentVersion: a.documentVersion, bookingId: a.bookingId, source: a.source, createdAt: a.createdAt })),
      };
    });
  }

  private mutate(
    actor: StaffActor,
    meta: RequestMeta,
    id: string,
    version: number,
    action: string,
    change: (row: DsrRow) => Prisma.DataSubjectRequestUncheckedUpdateManyInput | Promise<Prisma.DataSubjectRequestUncheckedUpdateManyInput>,
  ) {
    return this.db.run(actor, meta, async (ctx) => {
      const row = await this.load(ctx, id);
      const data = await change(row);
      const updated = await ctx.tx.dataSubjectRequest.updateMany({ where: { id: row.id, version }, data: { ...data, version: { increment: 1 } } });
      if (updated.count === 0) throw new ConcurrencyError('La solicitud fue modificada por otra operación. Recarga e intenta de nuevo.');
      const fresh = await this.load(ctx, id);
      await ctx.audit({ entityType: 'data_subject_requests', entityId: row.id, action, before: { status: row.status }, after: { status: fresh.status, dueAt: fresh.dueAt.toISOString() } });
      return present(fresh, ctx.now);
    });
  }

  private async load(ctx: AdminTx, id: string): Promise<DsrRow> {
    const row = /^[0-9a-f-]{36}$/i.test(id)
      ? await ctx.tx.dataSubjectRequest.findUnique({ where: { id }, include: { respondedBy: { select: { id: true, fullName: true } } } })
      : null;
    if (!row) throw new DsrNotFoundError();
    return row;
  }
}
