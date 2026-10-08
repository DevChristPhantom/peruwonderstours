import type { Prisma } from '../../../generated/prisma/client.js';
import type { PrismaTx } from '../../../persistence/prisma/prisma-client.js';
import { calendarDateFromUtcDate, calendarDateToUtcDate, type CalendarDate } from '../../../shared/domain/calendar-date.js';
import { assertCurrencyCode } from '../../../shared/domain/money.js';
import type { ComplaintSnapshot } from '../domain/complaint.js';
import type { ComplaintRepository, ComplaintSequence, HolidayCalendar } from '../domain/complaint.repository.js';

type ComplaintRow = Prisma.ComplaintGetPayload<object>;

function bytes(value: Uint8Array): Uint8Array<ArrayBuffer> {
  return Uint8Array.from(value);
}

function mapComplaint(row: ComplaintRow): ComplaintSnapshot {
  return {
    id: row.id,
    year: row.year,
    sequence: row.sequence,
    code: row.code,
    type: row.type,
    declaredType: row.declaredType,
    status: row.status,
    channel: row.channel,
    bookingId: row.bookingId,
    provider: {
      legalName: row.providerLegalName,
      ruc: row.providerRuc,
      establishmentAddress: row.establishmentAddress,
      establishmentCode: row.establishmentCode,
    },
    consumer: {
      fullName: row.consumerName,
      docType: row.consumerDocType,
      docEnc: row.consumerDocEnc,
      docHash: row.consumerDocHash,
      address: row.consumerAddress,
      email: row.consumerEmail,
      phoneEnc: row.consumerPhoneEnc,
      isMinor: row.isMinor,
    },
    guardian:
      row.isMinor && row.guardianName && row.guardianAddress && row.guardianPhoneEnc && row.guardianEmail
        ? { fullName: row.guardianName, address: row.guardianAddress, phoneEnc: row.guardianPhoneEnc, email: row.guardianEmail }
        : null,
    good: {
      type: row.goodType,
      description: row.goodDescription,
      claimedAmount: row.claimedAmount,
      currency: row.claimedCurrency ? assertCurrencyCode(row.claimedCurrency) : null,
    },
    detail: row.detail,
    consumerRequest: row.consumerRequest,
    responseChannel: row.responseChannel,
    conformityAcceptedAt: row.conformityAcceptedAt,
    conformityTextVersion: row.conformityTextVersion,
    privacyNoticeVersion: row.privacyNoticeVersion,
    responseText: row.responseText,
    responseSentAt: row.responseSentAt,
    responseDueAt: row.responseDueAt,
    submittedAt: row.submittedAt,
    ip: row.ip,
    accessTokenHash: row.accessTokenHash,
  };
}

export class PrismaComplaintRepository implements ComplaintRepository {
  constructor(private readonly db: PrismaTx) {}

  async insert(c: ComplaintSnapshot): Promise<void> {
    await this.db.complaint.create({
      data: {
        id: c.id,
        year: c.year,
        sequence: c.sequence,
        code: c.code,
        type: c.type,
        declaredType: c.declaredType,
        status: c.status,
        channel: c.channel,
        bookingId: c.bookingId,
        providerLegalName: c.provider.legalName,
        providerRuc: c.provider.ruc,
        establishmentAddress: c.provider.establishmentAddress,
        establishmentCode: c.provider.establishmentCode,
        consumerName: c.consumer.fullName,
        consumerDocType: c.consumer.docType,
        consumerDocEnc: bytes(c.consumer.docEnc),
        consumerDocHash: bytes(c.consumer.docHash),
        consumerAddress: c.consumer.address,
        consumerEmail: c.consumer.email,
        consumerPhoneEnc: c.consumer.phoneEnc ? bytes(c.consumer.phoneEnc) : null,
        isMinor: c.consumer.isMinor,
        guardianName: c.guardian?.fullName ?? null,
        guardianAddress: c.guardian?.address ?? null,
        guardianPhoneEnc: c.guardian ? bytes(c.guardian.phoneEnc) : null,
        guardianEmail: c.guardian?.email ?? null,
        goodType: c.good.type,
        goodDescription: c.good.description,
        claimedAmount: c.good.claimedAmount,
        claimedCurrency: c.good.currency,
        detail: c.detail,
        consumerRequest: c.consumerRequest,
        responseChannel: c.responseChannel,
        conformityAcceptedAt: c.conformityAcceptedAt,
        conformityTextVersion: c.conformityTextVersion,
        privacyNoticeVersion: c.privacyNoticeVersion,
        responseDueAt: c.responseDueAt,
        submittedAt: c.submittedAt,
        createdAt: c.submittedAt,
        ip: c.ip,
        accessTokenHash: c.accessTokenHash,
      },
    });
  }

  async findByCode(code: string): Promise<ComplaintSnapshot | null> {
    const row = await this.db.complaint.findUnique({ where: { code } });
    return row ? mapComplaint(row) : null;
  }

  async findById(id: string): Promise<ComplaintSnapshot | null> {
    const row = await this.db.complaint.findUnique({ where: { id } });
    return row ? mapComplaint(row) : null;
  }

  async updateAccessTokenHash(id: string, accessTokenHash: string): Promise<void> {
    await this.db.complaint.update({ where: { id }, data: { accessTokenHash } });
  }
}

/** next_document_number('complaint', año): correlativo sin huecos bajo bloqueo de fila hasta el COMMIT. */
export class PrismaComplaintSequence implements ComplaintSequence {
  constructor(private readonly db: PrismaTx) {}

  async next(year: number): Promise<number> {
    const rows = await this.db.$queryRaw<Array<{ value: number }>>`
      SELECT next_document_number('complaint'::sequence_scope, ${year}::int) AS value`;
    return Number(rows[0]!.value);
  }
}

/** Feriados de ámbito nacional. [A VALIDAR: feriados regionales (p. ej. PE-PUN) para la oficina de Puno.] */
export class PrismaHolidayCalendar implements HolidayCalendar {
  constructor(private readonly db: PrismaTx) {}

  async holidaysBetween(from: CalendarDate, to: CalendarDate): Promise<Set<CalendarDate>> {
    const rows = await this.db.businessHoliday.findMany({
      where: { scope: 'national', holidayDate: { gte: calendarDateToUtcDate(from), lte: calendarDateToUtcDate(to) } },
      select: { holidayDate: true },
    });
    return new Set(rows.map((r) => calendarDateFromUtcDate(r.holidayDate)));
  }
}
