import { accessTokenMatches, generateAccessToken, isWellFormedAccessToken } from '../../../shared/application/access-token.js';
import { requestFingerprint } from '../../../shared/application/fingerprint.js';
import type { PiiCipher } from '../../../shared/application/pii-cipher.js';
import type { TransactionalRepositories, UnitOfWork } from '../../../shared/application/unit-of-work.js';
import { addDays, addMinutes, toLimaCalendarDate } from '../../../shared/domain/calendar-date.js';
import { DomainError, NotFoundError } from '../../../shared/domain/domain-error.js';
import { assertIdempotencyKey, IdempotencyConflictError, IdempotencyKeyReusedError } from '../../../shared/domain/idempotency.js';
import type { Clock, IdGenerator } from '../../../shared/domain/ports.js';
import { BOOKING_CODE_PATTERN } from '../../booking/application/booking-access.js';
import { businessDaysLookahead, COMPLAINT_RESPONSE_BUSINESS_DAYS, complaintResponseDue } from '../domain/business-days.js';
import {
  assertComplaintRules,
  COMPLAINT_CODE_PATTERN,
  formatComplaintCode,
  normalizeDocNumber,
  type ComplaintDraft,
  type ComplaintSnapshot,
  type ProviderSnapshot,
} from '../domain/complaint.js';

export interface ComplaintSettings {
  /** Proveedor y establecimiento que se congelan en cada hoja (variables de entorno). */
  provider: ProviderSnapshot;
  /** Versión del texto de conformidad que sustituye la firma. */
  conformityTextVersion: string;
  privacyNoticeVersion: string;
  idempotencyTtlMinutes: number;
}

export interface SubmitComplaintInput {
  draft: ComplaintDraft;
  /** Código de reserva opcional (PWT-AAAA-NNNNNN): si existe se vincula; nunca es obligatorio. */
  bookingCode?: string | null;
  idempotencyKey: string | undefined;
  ip: string | null;
}

export interface SubmitComplaintResult {
  complaint: ComplaintSnapshot;
  /** Token de consulta (X-Complaint-Token); solo en esta respuesta. En replay se emite uno nuevo. */
  accessToken: string;
  replayed: boolean;
}

/** Hoja con los datos personales descifrados para su titular (constancia / impresión). */
export interface ComplaintView {
  complaint: ComplaintSnapshot;
  consumerDocNumber: string;
  consumerPhone: string | null;
  guardianPhone: string | null;
}

export interface ComplaintAccess {
  code: string;
  token: string | undefined;
}

export class ComplaintTokenRequiredError extends DomainError {
  constructor() {
    super('complaint-token-required', 'Falta la cabecera X-Complaint-Token o su formato es inválido.', 'unauthorized');
  }
}

/** 404 genérico: no revela si el código existe cuando el token no coincide. */
export class ComplaintNotFoundError extends NotFoundError {
  constructor() {
    super('complaint-not-found', 'Hoja de reclamación no encontrada.');
  }
}

const SCOPE = 'complaint';
export const COMPLAINT_SUBMITTED_EVENT = 'complaint.submitted';

/**
 * Libro de Reclamaciones virtual (HU-8.1): registro sin cuenta, correlativo anual sin
 * huecos, plazo de 15 días hábiles, constancia con fecha y hora y evento outbox para el
 * correo con la hoja al consumidor (envío real pendiente).
 */
export class ComplaintUseCases {
  constructor(
    private readonly unitOfWork: UnitOfWork,
    private readonly clock: Clock,
    private readonly ids: IdGenerator,
    private readonly cipher: PiiCipher,
    private readonly settings: ComplaintSettings,
  ) {}

  async submit(input: SubmitComplaintInput): Promise<SubmitComplaintResult> {
    const key = assertIdempotencyKey(input.idempotencyKey);
    const draft = normalizeDraft(input.draft);
    assertComplaintRules(draft);
    const bookingCode = input.bookingCode?.trim().toUpperCase() || null;
    const fingerprint = requestFingerprint({ ...draft, bookingCode });

    return this.unitOfWork.run(async (repos) => {
      const now = this.clock.now();
      const replay = await this.findReplay(repos, key, fingerprint);
      if (replay) {
        const access = generateAccessToken();
        await repos.complaints.updateAccessTokenHash(replay.id, access.tokenHash);
        return { complaint: { ...replay, accessTokenHash: access.tokenHash }, accessToken: access.token, replayed: true };
      }

      const today = toLimaCalendarDate(now);
      const year = Number(today.slice(0, 4));
      const sequence = await repos.complaintSequence.next(year);
      const holidays = await repos.holidays.holidaysBetween(today, addDays(today, businessDaysLookahead(COMPLAINT_RESPONSE_BUSINESS_DAYS)));
      const { dueAt } = complaintResponseDue(now, holidays);
      const booking = bookingCode && BOOKING_CODE_PATTERN.test(bookingCode) ? await repos.bookings.findByCode(bookingCode) : null;
      const access = generateAccessToken();
      const docNumber = normalizeDocNumber(draft.consumer.docNumber);

      const complaint: ComplaintSnapshot = {
        id: this.ids.next(),
        year,
        sequence,
        code: formatComplaintCode(year, sequence),
        type: draft.declaredType ?? 'reclamo',
        declaredType: draft.declaredType,
        status: 'received',
        channel: 'web',
        bookingId: booking?.id ?? null,
        provider: { ...this.settings.provider },
        consumer: {
          fullName: draft.consumer.fullName,
          docType: draft.consumer.docType,
          docEnc: this.cipher.encrypt(docNumber),
          docHash: this.cipher.hash(`${draft.consumer.docType}:${docNumber}`),
          address: draft.consumer.address,
          email: draft.consumer.email,
          phoneEnc: this.cipher.encrypt(draft.consumer.phone),
          isMinor: draft.consumer.isMinor,
        },
        guardian: draft.guardian
          ? {
              fullName: draft.guardian.fullName,
              address: draft.guardian.address,
              phoneEnc: this.cipher.encrypt(draft.guardian.phone),
              email: draft.guardian.email,
            }
          : null,
        good: { ...draft.good },
        detail: draft.detail,
        consumerRequest: draft.consumerRequest,
        responseChannel: draft.responseChannel,
        conformityAcceptedAt: now,
        conformityTextVersion: this.settings.conformityTextVersion,
        privacyNoticeVersion: this.settings.privacyNoticeVersion,
        responseText: null,
        responseSentAt: null,
        responseDueAt: dueAt,
        submittedAt: now,
        ip: input.ip,
        accessTokenHash: access.tokenHash,
      };
      await repos.complaints.insert(complaint);

      // Constancia por correo (art. 4-B): la envía el relay del outbox; el payload no lleva PII.
      await repos.outbox.add({
        id: this.ids.next(),
        aggregateType: 'complaint',
        aggregateId: complaint.id,
        eventType: COMPLAINT_SUBMITTED_EVENT,
        payload: { complaintId: complaint.id, code: complaint.code, action: 'send-acknowledgment-to-consumer' },
        availableAt: now,
        createdAt: now,
      });

      await repos.idempotency.insert({
        scope: SCOPE,
        key,
        fingerprint,
        resourceId: complaint.id,
        response: { complaintId: complaint.id, code: complaint.code },
        createdAt: now,
        expiresAt: addMinutes(now, this.settings.idempotencyTtlMinutes),
      });
      return { complaint, accessToken: access.token, replayed: false };
    });
  }

  /** Hoja por código + token del consumidor; datos personales descifrados para su titular. */
  getByCode(access: ComplaintAccess): Promise<ComplaintView> {
    return this.unitOfWork.run(async (repos) => {
      if (!isWellFormedAccessToken(access.token)) throw new ComplaintTokenRequiredError();
      const code = access.code.trim().toUpperCase();
      const complaint = COMPLAINT_CODE_PATTERN.test(code) ? await repos.complaints.findByCode(code) : null;
      const matches = accessTokenMatches(access.token, complaint?.accessTokenHash ?? null);
      if (!complaint || !matches) throw new ComplaintNotFoundError();
      return {
        complaint,
        consumerDocNumber: this.cipher.decrypt(complaint.consumer.docEnc),
        consumerPhone: complaint.consumer.phoneEnc ? this.cipher.decrypt(complaint.consumer.phoneEnc) : null,
        guardianPhone: complaint.guardian ? this.cipher.decrypt(complaint.guardian.phoneEnc) : null,
      };
    });
  }

  private async findReplay(repos: TransactionalRepositories, key: string, fingerprint: string): Promise<ComplaintSnapshot | null> {
    const record = await repos.idempotency.find(SCOPE, key);
    if (!record || record.expiresAt.getTime() <= this.clock.now().getTime()) return null;
    if (record.fingerprint !== fingerprint) throw new IdempotencyKeyReusedError(key);
    const complaint = await repos.complaints.findById(record.resourceId);
    if (!complaint) throw new IdempotencyConflictError(key);
    return complaint;
  }
}

function clean(value: string): string {
  return value.trim().replace(/\s+/g, ' ');
}

/** Normaliza espacios y correos (minúsculas) antes de validar y de calcular la huella. */
export function normalizeDraft(draft: ComplaintDraft): ComplaintDraft {
  return {
    ...draft,
    consumer: {
      ...draft.consumer,
      fullName: clean(draft.consumer.fullName),
      address: clean(draft.consumer.address),
      email: draft.consumer.email.trim().toLowerCase(),
      phone: draft.consumer.phone.replace(/[\s()-]/g, ''),
      docNumber: normalizeDocNumber(draft.consumer.docNumber),
    },
    guardian: draft.guardian
      ? {
          fullName: clean(draft.guardian.fullName),
          address: clean(draft.guardian.address),
          email: draft.guardian.email.trim().toLowerCase(),
          phone: draft.guardian.phone.replace(/[\s()-]/g, ''),
        }
      : null,
    good: { ...draft.good, description: clean(draft.good.description) },
    detail: draft.detail.trim(),
    consumerRequest: draft.consumerRequest.trim(),
  };
}
