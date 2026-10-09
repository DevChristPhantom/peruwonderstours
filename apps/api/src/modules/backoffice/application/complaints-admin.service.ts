import type { Prisma } from '../../../generated/prisma/client.js';
import { auditJson, type RequestMeta } from '../../../shared/application/audit.js';
import type { PiiCipher } from '../../../shared/application/pii-cipher.js';
import { addDays, toLimaCalendarDate, type CalendarDate } from '../../../shared/domain/calendar-date.js';
import { BusinessRuleError, ConflictError, NotFoundError, ValidationError } from '../../../shared/domain/domain-error.js';
import { assertCurrencyCode } from '../../../shared/domain/money.js';
import type { IdGenerator } from '../../../shared/domain/ports.js';
import { normalizeDraft, resolveBookingLink, type ComplaintSettings } from '../../complaints/application/complaint.use-cases.js';
import { businessDaysLookahead, COMPLAINT_RESPONSE_BUSINESS_DAYS, complaintResponseDue } from '../../complaints/domain/business-days.js';
import {
  assertComplaintRules,
  complaintAad,
  COMPLAINT_LEGAL_NOTICES,
  formatComplaintCode,
  formatSheetNumber,
  normalizeDocNumber,
  type ComplaintDraft,
  type ComplaintSnapshot,
  type ComplaintStatus,
  type ComplaintType,
} from '../../complaints/domain/complaint.js';
import type { StaffActor } from '../../identity/application/staff-auth.use-cases.js';
import { MAIL_EVENTS, outboxMessage } from '../../notifications/domain/mail-events.js';
import {
  complaintTrafficLight,
  isLateTranscription,
  resumedResponseDue,
  settlementExpiry,
  SETTLEMENT_SUSPENSION_BUSINESS_DAYS,
  type TrafficLight,
} from '../domain/backoffice-rules.js';
import { endOfBusinessDayAfter } from '../../complaints/domain/business-days.js';
import { pageArgs, type AdminDatabase, type AdminTx, type PageQuery } from '../infrastructure/admin-database.js';

type ComplaintRow = Prisma.ComplaintGetPayload<{ include: { respondedBy: { select: { id: true; fullName: true } }; reclassifiedBy: { select: { id: true; fullName: true } } } }>;

const OPEN_STATUSES: readonly ComplaintStatus[] = ['received', 'in_review'];

export class AdminComplaintNotFoundError extends NotFoundError {
  constructor() {
    super('complaint-not-found', 'Hoja de reclamación no encontrada.');
  }
}

export interface ComplaintListFilters extends PageQuery {
  status?: ComplaintStatus;
  type?: ComplaintType;
  light?: TrafficLight;
  code?: string;
  channel?: 'web' | 'backup_book' | 'office_assisted';
}

export interface TranscriptionInput {
  backupSheetNumber: string;
  /** Fecha y hora en que el consumidor llenó la hoja física. */
  submittedAt: Date;
  draft: Omit<ComplaintDraft, 'conformityAccepted'>;
  bookingCode?: string | null;
}

/**
 * Bandeja del Libro de Reclamaciones (HU-8.2): semáforo 10/13/15 días hábiles, respuesta
 * (fecha de comunicación + entrega por correo), reclasificación queja <-> reclamo, solución
 * directa (art. 6-A, suspensión <= 5 días hábiles) y transcripción del libro de respaldo (art. 4-A).
 * El plazo de 15 días hábiles es improrrogable: no existe acción para ampliarlo.
 */
export class ComplaintsAdminService {
  constructor(
    private readonly db: AdminDatabase,
    private readonly ids: IdGenerator,
    private readonly cipher: PiiCipher,
    private readonly settings: ComplaintSettings,
  ) {}

  async list(filters: ComplaintListFilters) {
    const now = this.db.now();
    const today = toLimaCalendarDate(now);
    const holidays = await this.db.holidays(addDays(today, -60), addDays(today, 60));
    const where: Prisma.ComplaintWhereInput = {
      ...(filters.status ? { status: filters.status } : {}),
      ...(filters.type ? { type: filters.type } : {}),
      ...(filters.channel ? { channel: filters.channel } : {}),
      ...(filters.code ? { code: { startsWith: filters.code.trim().toUpperCase() } } : {}),
      ...(filters.light && filters.light !== 'done' ? { status: { in: [...OPEN_STATUSES] } } : {}),
    };
    const select = {
      id: true, code: true, year: true, sequence: true, type: true, declaredType: true, status: true, channel: true, consumerName: true,
      submittedAt: true, responseDueAt: true, responseSentAt: true, respondedAt: true, acknowledgmentSentAt: true, settlementOfferedAt: true,
      settlementExpiresAt: true, settlementAcceptedAt: true, settlementRejectedAt: true, backupSheetNumber: true, transcribedAt: true, reclassifiedAt: true,
    } satisfies Prisma.ComplaintSelect;
    type Row = Prisma.ComplaintGetPayload<{ select: typeof select }>;
    const present = (c: Row) => {
      const light = complaintTrafficLight({
        status: c.status,
        responseSentAt: c.responseSentAt,
        responseDueAt: c.responseDueAt,
        settlementOfferedAt: c.settlementOfferedAt,
        settlementExpiresAt: c.settlementExpiresAt,
        settlementResolved: c.settlementAcceptedAt !== null || c.settlementRejectedAt !== null,
        now,
        holidays,
      });
      return {
        id: c.id,
        code: c.code,
        sheetNumber: formatSheetNumber(c.year, c.sequence),
        type: c.type,
        declaredType: c.declaredType,
        status: c.status,
        channel: c.channel,
        consumerName: c.consumerName,
        submittedAt: c.submittedAt,
        responseDueAt: c.responseDueAt,
        respondedAt: c.respondedAt,
        responseSentAt: c.responseSentAt,
        acknowledgmentSentAt: c.acknowledgmentSentAt,
        trafficLight: light.light,
        businessDaysElapsed: light.businessDaysElapsed,
        businessDaysRemaining: light.businessDaysRemaining,
        settlement: c.settlementOfferedAt
          ? { offeredAt: c.settlementOfferedAt, expiresAt: c.settlementExpiresAt, acceptedAt: c.settlementAcceptedAt, rejectedAt: c.settlementRejectedAt }
          : null,
        reclassified: c.reclassifiedAt !== null,
        lateTranscription: c.channel === 'backup_book' && c.transcribedAt ? isLateTranscription(c.submittedAt, c.transcribedAt) : false,
      };
    };
    if (filters.light) {
      const rows = await this.db.read((p) => p.complaint.findMany({ where, select, orderBy: { responseDueAt: 'asc' }, take: 2000 }));
      const all = rows.map(present).filter((c) => c.trafficLight === filters.light);
      const { skip, take } = pageArgs(filters);
      return { total: all.length, items: all.slice(skip, skip + take) };
    }
    const [total, rows] = await this.db.read((p) =>
      Promise.all([p.complaint.count({ where }), p.complaint.findMany({ where, select, orderBy: [{ responseDueAt: 'asc' }], ...pageArgs(filters) })]),
    );
    return { total, items: rows.map(present) };
  }

  /** Hoja completa con datos personales descifrados (la consulta queda auditada). */
  async detail(actor: StaffActor, meta: RequestMeta, id: string) {
    return this.db.run(actor, meta, async (ctx) => {
      const row = await this.load(ctx, id);
      await ctx.audit({ entityType: 'complaints', entityId: row.id, action: 'COMPLAINT_PII_VIEWED' });
      const outbox = await ctx.tx.outboxEvent.findMany({ where: { aggregateType: 'complaint', aggregateId: row.id }, orderBy: { createdAt: 'asc' } });
      const holidays = await this.db.holidays(addDays(toLimaCalendarDate(ctx.now), -60), addDays(toLimaCalendarDate(ctx.now), 60));
      const light = complaintTrafficLight({
        status: row.status,
        responseSentAt: row.responseSentAt,
        responseDueAt: row.responseDueAt,
        settlementOfferedAt: row.settlementOfferedAt,
        settlementExpiresAt: row.settlementExpiresAt,
        settlementResolved: row.settlementAcceptedAt !== null || row.settlementRejectedAt !== null,
        now: ctx.now,
        holidays,
      });
      return {
        id: row.id,
        code: row.code,
        sheetNumber: formatSheetNumber(row.year, row.sequence),
        type: row.type,
        declaredType: row.declaredType,
        status: row.status,
        channel: row.channel,
        backupSheetNumber: row.backupSheetNumber,
        transcribedAt: row.transcribedAt,
        lateTranscription: row.channel === 'backup_book' && row.transcribedAt ? isLateTranscription(row.submittedAt, row.transcribedAt) : false,
        bookingId: row.bookingId,
        declaredBookingCode: row.declaredBookingCode,
        provider: { legalName: row.providerLegalName, ruc: row.providerRuc, establishmentAddress: row.establishmentAddress, establishmentCode: row.establishmentCode },
        consumer: {
          fullName: row.consumerName,
          docType: row.consumerDocType,
          docNumber: this.cipher.decrypt(row.consumerDocEnc, complaintAad(row.id, 'consumer_doc_enc')),
          address: row.consumerAddress,
          email: row.consumerEmail,
          phone: row.consumerPhoneEnc ? this.cipher.decrypt(row.consumerPhoneEnc, complaintAad(row.id, 'consumer_phone_enc')) : null,
          isMinor: row.isMinor,
        },
        guardian: row.isMinor
          ? {
              fullName: row.guardianName,
              address: row.guardianAddress,
              email: row.guardianEmail,
              phone: row.guardianPhoneEnc ? this.cipher.decrypt(row.guardianPhoneEnc, complaintAad(row.id, 'guardian_phone_enc')) : null,
            }
          : null,
        good: {
          type: row.goodType,
          description: row.goodDescription,
          claimedAmount: row.claimedAmount !== null && row.claimedCurrency ? { amount: row.claimedAmount, currency: assertCurrencyCode(row.claimedCurrency) } : null,
        },
        detail: row.detail,
        consumerRequest: row.consumerRequest,
        responseChannel: row.responseChannel,
        conformityAcceptedAt: row.conformityAcceptedAt,
        submittedAt: row.submittedAt,
        responseDueAt: row.responseDueAt,
        originalResponseDueAt: row.originalResponseDueAt,
        trafficLight: light.light,
        businessDaysElapsed: light.businessDaysElapsed,
        businessDaysRemaining: light.businessDaysRemaining,
        response: { text: row.responseText, respondedAt: row.respondedAt, respondedBy: row.respondedBy, sentAt: row.responseSentAt, deliveryRef: row.responseDeliveryRef },
        acknowledgment: { sentAt: row.acknowledgmentSentAt, deliveryRef: row.acknowledgmentDeliveryRef, pdfSha256: row.pdfSha256 },
        reclassification: row.reclassifiedAt ? { at: row.reclassifiedAt, by: row.reclassifiedBy, reason: row.reclassificationReason } : null,
        settlement: row.settlementOfferedAt
          ? {
              offerText: row.settlementOfferText,
              offeredAt: row.settlementOfferedAt,
              expiresAt: row.settlementExpiresAt,
              acceptedAt: row.settlementAcceptedAt,
              acceptanceEvidence: row.settlementAcceptanceEvidence,
              rejectedAt: row.settlementRejectedAt,
            }
          : null,
        legalNotices: [...COMPLAINT_LEGAL_NOTICES],
        emails: outbox.map((e) => ({ eventType: e.eventType, createdAt: e.createdAt, publishedAt: e.publishedAt, attempts: e.attempts, lastError: e.lastError })),
      };
    });
  }

  markInReview(actor: StaffActor, meta: RequestMeta, id: string) {
    return this.db.run(actor, meta, async (ctx) => {
      const row = await this.load(ctx, id);
      if (row.status !== 'received') throw new ConflictError('complaint-invalid-state', 'Solo una hoja recibida pasa a revisión.');
      await ctx.tx.complaint.update({ where: { id: row.id }, data: { status: 'in_review' } });
      await ctx.audit({ entityType: 'complaints', entityId: row.id, action: 'COMPLAINT_IN_REVIEW' });
      return { id: row.id, status: 'in_review' as const };
    });
  }

  /**
   * Respuesta del proveedor. Canal correo: el relay envía la respuesta y fija `responseSentAt`
   * (fecha de comunicación del Anexo I) al entregarla. Canal carta: el staff registra la fecha
   * de envío y el n.º de cargo; igualmente se envía una copia por correo.
   */
  respond(actor: StaffActor, meta: RequestMeta, id: string, input: { responseText: string; letterSentAt?: Date; letterDeliveryRef?: string }) {
    const text = input.responseText.trim();
    if (text.length < 10) throw new ValidationError('validation-failed', 'La respuesta es demasiado corta.', { errors: [{ field: 'responseText', messages: ['Mínimo 10 caracteres.'] }] });
    return this.db.run(actor, meta, async (ctx) => {
      const row = await this.load(ctx, id, true);
      if (!OPEN_STATUSES.includes(row.status)) throw new ConflictError('complaint-already-closed', `La hoja ya está en estado "${row.status}".`);
      if (row.settlementAcceptedAt) throw new ConflictError('complaint-settled', 'La hoja se cerró por solución directa aceptada.');
      let respondedAt = ctx.now;
      let responseSentAt: Date | null = null;
      let responseDeliveryRef: string | null = null;
      if (row.responseChannel === 'letter') {
        if (!input.letterSentAt || !input.letterDeliveryRef?.trim()) {
          throw new ValidationError('validation-failed', 'El consumidor pidió respuesta por carta: indica fecha de envío y n.º de cargo.', {
            errors: [{ field: 'letterDeliveryRef', messages: ['Obligatorio para respuesta por carta.'] }, { field: 'letterSentAt', messages: ['Obligatorio para respuesta por carta.'] }],
          });
        }
        if (input.letterSentAt.getTime() > ctx.now.getTime() + 60_000 || input.letterSentAt.getTime() < row.submittedAt.getTime()) {
          throw new ValidationError('validation-failed', 'Fecha de envío de la carta inválida.', { errors: [{ field: 'letterSentAt', messages: ['Debe estar entre el registro de la hoja y ahora.'] }] });
        }
        respondedAt = input.letterSentAt.getTime() < ctx.now.getTime() ? input.letterSentAt : ctx.now;
        responseSentAt = input.letterSentAt;
        responseDeliveryRef = `carta:${input.letterDeliveryRef.trim()}`.slice(0, 200);
      }
      await ctx.tx.complaint.update({
        where: { id: row.id },
        data: { status: 'answered', responseText: text, respondedAt, respondedByUserId: actor.userId, responseSentAt, responseDeliveryRef },
      });
      await ctx.repos.outbox.add(
        outboxMessage(this.ids, {
          aggregateType: 'complaint',
          aggregateId: row.id,
          eventType: MAIL_EVENTS.complaintAnswered,
          payload: { complaintId: row.id, code: row.code, channel: row.responseChannel },
          now: ctx.now,
        }),
      );
      await ctx.audit({
        entityType: 'complaints',
        entityId: row.id,
        action: 'COMPLAINT_ANSWERED',
        after: { responseChannel: row.responseChannel, respondedAt: respondedAt.toISOString(), letterDeliveryRef: responseDeliveryRef, onTime: respondedAt.getTime() <= row.responseDueAt.getTime() },
      });
      return { id: row.id, status: 'answered' as const, respondedAt, responseSentAt, responseChannel: row.responseChannel };
    });
  }

  /** Queja <-> reclamo (art. 6): conserva el tipo declarado; el plazo no cambia. */
  reclassify(actor: StaffActor, meta: RequestMeta, id: string, input: { type: ComplaintType; reason: string }) {
    return this.db.run(actor, meta, async (ctx) => {
      const row = await this.load(ctx, id, true);
      if (!OPEN_STATUSES.includes(row.status)) throw new ConflictError('complaint-already-closed', 'Solo se reclasifican hojas pendientes de respuesta.');
      if (row.type === input.type) throw new ConflictError('complaint-type-unchanged', `La hoja ya se tramita como "${input.type}".`);
      await ctx.tx.complaint.update({
        where: { id: row.id },
        data: { type: input.type, reclassifiedAt: ctx.now, reclassifiedByUserId: actor.userId, reclassificationReason: input.reason.trim().slice(0, 500) },
      });
      await ctx.audit({
        entityType: 'complaints',
        entityId: row.id,
        action: 'COMPLAINT_RECLASSIFIED',
        before: { type: row.type, declaredType: row.declaredType },
        after: { type: input.type, reason: input.reason.trim().slice(0, 500) },
      });
      return { id: row.id, type: input.type, declaredType: row.declaredType, responseDueAt: row.responseDueAt };
    });
  }

  /** Oferta de solución directa (art. 6-A): suspende el plazo hasta 5 días hábiles. */
  offerSettlement(actor: StaffActor, meta: RequestMeta, id: string, input: { offerText: string }) {
    return this.db.run(actor, meta, async (ctx) => {
      const row = await this.load(ctx, id, true);
      if (!OPEN_STATUSES.includes(row.status)) throw new ConflictError('complaint-already-closed', 'La hoja ya fue respondida o cerrada.');
      if (row.settlementOfferedAt) throw new ConflictError('settlement-already-offered', 'Ya se ofreció una solución directa para esta hoja.');
      if (ctx.now.getTime() > row.responseDueAt.getTime()) throw new BusinessRuleError('complaint-overdue', 'El plazo de respuesta ya venció: responde la hoja.');
      const holidays = await this.db.holidays(toLimaCalendarDate(ctx.now), addDays(toLimaCalendarDate(row.responseDueAt), 30));
      const expiresAt = settlementExpiry(ctx.now, holidays);
      const extendedDue = endOfBusinessDayAfter(row.responseDueAt, SETTLEMENT_SUSPENSION_BUSINESS_DAYS, holidays);
      await ctx.tx.complaint.update({
        where: { id: row.id },
        data: {
          settlementOfferText: input.offerText.trim(),
          settlementOfferedAt: ctx.now,
          settlementExpiresAt: expiresAt,
          originalResponseDueAt: row.originalResponseDueAt ?? row.responseDueAt,
          responseDueAt: extendedDue,
          status: 'in_review',
        },
      });
      await ctx.repos.outbox.add(
        outboxMessage(this.ids, {
          aggregateType: 'complaint',
          aggregateId: row.id,
          eventType: MAIL_EVENTS.complaintSettlementOffered,
          payload: { complaintId: row.id, code: row.code },
          now: ctx.now,
        }),
      );
      await ctx.audit({
        entityType: 'complaints',
        entityId: row.id,
        action: 'COMPLAINT_SETTLEMENT_OFFERED',
        after: { expiresAt: expiresAt.toISOString(), responseDueAt: extendedDue.toISOString(), originalResponseDueAt: row.responseDueAt.toISOString() },
      });
      return { id: row.id, settlementExpiresAt: expiresAt, responseDueAt: extendedDue };
    });
  }

  acceptSettlement(actor: StaffActor, meta: RequestMeta, id: string, input: { evidence: string; acceptedAt?: Date }) {
    return this.db.run(actor, meta, async (ctx) => {
      const row = await this.load(ctx, id, true);
      const offeredAt = this.pendingOffer(row);
      const acceptedAt = input.acceptedAt ?? ctx.now;
      if (acceptedAt.getTime() < offeredAt.getTime() || acceptedAt.getTime() > ctx.now.getTime() + 60_000) {
        throw new ValidationError('validation-failed', 'Fecha de aceptación inválida.', { errors: [{ field: 'acceptedAt', messages: ['Debe estar entre la oferta y ahora.'] }] });
      }
      if (row.settlementExpiresAt && acceptedAt.getTime() > row.settlementExpiresAt.getTime()) {
        throw new ConflictError('settlement-expired', 'La aceptación llegó después de los 5 días hábiles: la oferta se entiende rechazada y debe responderse la hoja.');
      }
      await ctx.tx.complaint.update({
        where: { id: row.id },
        data: { status: 'settled', settlementAcceptedAt: acceptedAt, settlementAcceptanceEvidence: input.evidence.trim() },
      });
      await ctx.audit({ entityType: 'complaints', entityId: row.id, action: 'COMPLAINT_SETTLEMENT_ACCEPTED', after: { acceptedAt: acceptedAt.toISOString() } });
      return { id: row.id, status: 'settled' as const, settlementAcceptedAt: acceptedAt };
    });
  }

  /** Rechazo (o silencio): el plazo se reanuda; el vencimiento se corre lo que duró la suspensión. */
  rejectSettlement(actor: StaffActor, meta: RequestMeta, id: string, _input: { note?: string }) {
    return this.db.run(actor, meta, async (ctx) => {
      const row = await this.load(ctx, id, true);
      const offeredAt = this.pendingOffer(row);
      const resolvedAt = row.settlementExpiresAt && ctx.now.getTime() > row.settlementExpiresAt.getTime() ? row.settlementExpiresAt : ctx.now;
      const original = row.originalResponseDueAt ?? row.responseDueAt;
      const holidays = await this.db.holidays(toLimaCalendarDate(offeredAt), addDays(toLimaCalendarDate(original), 30));
      const newDue = resumedResponseDue({ originalDueAt: original, offeredAt, resolvedAt, holidays });
      await ctx.tx.complaint.update({ where: { id: row.id }, data: { settlementRejectedAt: resolvedAt, responseDueAt: newDue } });
      await ctx.audit({
        entityType: 'complaints',
        entityId: row.id,
        action: 'COMPLAINT_SETTLEMENT_REJECTED',
        after: { resolvedAt: resolvedAt.toISOString(), responseDueAt: newDue.toISOString() },
      });
      return { id: row.id, responseDueAt: newDue, settlementRejectedAt: resolvedAt };
    });
  }

  /** Transcripción de una hoja del libro de respaldo físico (art. 4-A: dentro de 1 día calendario). */
  transcribe(actor: StaffActor, meta: RequestMeta, input: TranscriptionInput) {
    const draft = normalizeDraft({ ...input.draft, conformityAccepted: true });
    assertComplaintRules(draft);
    const sheet = input.backupSheetNumber.trim();
    if (!/^[A-Za-z0-9-]{1,40}$/.test(sheet)) {
      throw new ValidationError('validation-failed', 'N.º de hoja física inválido.', { errors: [{ field: 'backupSheetNumber', messages: ['1-40 caracteres: letras, números y guiones.'] }] });
    }
    return this.db.run(actor, meta, async (ctx) => {
      const submittedAt = input.submittedAt;
      if (submittedAt.getTime() > ctx.now.getTime() + 60_000) {
        throw new ValidationError('validation-failed', 'La fecha de la hoja física no puede ser futura.', { errors: [{ field: 'submittedAt', messages: ['No puede ser futura.'] }] });
      }
      if (await ctx.tx.complaint.findFirst({ where: { channel: 'backup_book', backupSheetNumber: sheet }, select: { id: true } })) {
        throw new ConflictError('backup-sheet-already-transcribed', `La hoja física ${sheet} ya fue transcrita.`);
      }
      const submittedDate = toLimaCalendarDate(submittedAt);
      const year = Number(submittedDate.slice(0, 4));
      const sequence = await ctx.repos.complaintSequence.next(year);
      const holidays: Set<CalendarDate> = await ctx.repos.holidays.holidaysBetween(submittedDate, addDays(submittedDate, businessDaysLookahead(COMPLAINT_RESPONSE_BUSINESS_DAYS)));
      const { dueAt } = complaintResponseDue(submittedAt, holidays);
      const bookingCode = input.bookingCode?.trim().toUpperCase() || null;
      const link = await resolveBookingLink(ctx.repos, bookingCode, draft.consumer.email, null);
      const docNumber = normalizeDocNumber(draft.consumer.docNumber);
      const id = this.ids.next();
      const complaint: ComplaintSnapshot = {
        id,
        year,
        sequence,
        code: formatComplaintCode(year, sequence),
        type: draft.declaredType ?? 'reclamo',
        declaredType: draft.declaredType,
        status: 'received',
        channel: 'backup_book',
        bookingId: link.bookingId,
        declaredBookingCode: link.declaredBookingCode,
        provider: { ...this.settings.provider },
        consumer: {
          fullName: draft.consumer.fullName,
          docType: draft.consumer.docType,
          docEnc: this.cipher.encrypt(docNumber, complaintAad(id, 'consumer_doc_enc')),
          docHash: this.cipher.hash(`${draft.consumer.docType}:${docNumber}`),
          address: draft.consumer.address,
          email: draft.consumer.email,
          phoneEnc: this.cipher.encrypt(draft.consumer.phone, complaintAad(id, 'consumer_phone_enc')),
          isMinor: draft.consumer.isMinor,
        },
        guardian: draft.guardian
          ? { fullName: draft.guardian.fullName, address: draft.guardian.address, phoneEnc: this.cipher.encrypt(draft.guardian.phone, complaintAad(id, 'guardian_phone_enc')), email: draft.guardian.email }
          : null,
        good: { ...draft.good },
        detail: draft.detail,
        consumerRequest: draft.consumerRequest,
        responseChannel: draft.responseChannel,
        conformityAcceptedAt: null,
        conformityTextVersion: null,
        privacyNoticeVersion: this.settings.privacyNoticeVersion,
        responseText: null,
        responseSentAt: null,
        responseDueAt: dueAt,
        submittedAt,
        ip: null,
        accessTokenHash: null,
        backupSheetNumber: sheet,
        transcribedAt: ctx.now,
      };
      await ctx.repos.complaints.insert(complaint);
      await ctx.repos.outbox.add(
        outboxMessage(this.ids, {
          aggregateType: 'complaint',
          aggregateId: complaint.id,
          eventType: MAIL_EVENTS.complaintSubmitted,
          payload: { complaintId: complaint.id, code: complaint.code, action: 'send-acknowledgment-to-consumer' },
          now: ctx.now,
        }),
      );
      const late = isLateTranscription(submittedAt, ctx.now);
      await ctx.audit({
        entityType: 'complaints',
        entityId: complaint.id,
        action: 'COMPLAINT_TRANSCRIBED',
        after: auditJson({ code: complaint.code, backupSheetNumber: sheet, submittedAt: submittedAt.toISOString(), lateTranscription: late }),
      });
      return {
        id: complaint.id,
        code: complaint.code,
        sheetNumber: formatSheetNumber(year, sequence),
        backupSheetNumber: sheet,
        submittedAt,
        transcribedAt: ctx.now,
        responseDueAt: dueAt,
        lateTranscription: late,
        warning: late ? 'La transcripción superó el día calendario del art. 4-A; documenta la causa (p. ej. libro virtual no disponible).' : null,
      };
    });
  }

  private pendingOffer(row: ComplaintRow): Date {
    if (!row.settlementOfferedAt) throw new ConflictError('settlement-not-offered', 'No hay una oferta de solución directa para esta hoja.');
    if (row.settlementAcceptedAt || row.settlementRejectedAt) throw new ConflictError('settlement-already-resolved', 'La oferta de solución directa ya fue resuelta.');
    if (!OPEN_STATUSES.includes(row.status)) throw new ConflictError('complaint-already-closed', 'La hoja ya fue respondida o cerrada.');
    return row.settlementOfferedAt;
  }

  private async load(ctx: AdminTx, id: string, forUpdate = false): Promise<ComplaintRow> {
    if (!/^[0-9a-f-]{36}$/i.test(id)) throw new AdminComplaintNotFoundError();
    if (forUpdate) await ctx.tx.$queryRaw`SELECT id FROM complaints WHERE id = ${id}::uuid FOR UPDATE`;
    const row = await ctx.tx.complaint.findUnique({
      where: { id },
      include: { respondedBy: { select: { id: true, fullName: true } }, reclassifiedBy: { select: { id: true, fullName: true } } },
    });
    if (!row) throw new AdminComplaintNotFoundError();
    return row;
  }
}
