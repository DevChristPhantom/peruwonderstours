import type { Prisma } from '../../../generated/prisma/client.js';
import type { PrismaTx } from '../../../persistence/prisma/prisma-client.js';
import type {
  ConsentPurpose,
  ConsentRecord,
  ConsentRepository,
  LegalAcceptanceRecord,
  LegalAcceptanceRepository,
} from '../domain/consent.js';

type ConsentRow = Prisma.ConsentGetPayload<object>;
type AcceptanceRow = Prisma.LegalAcceptanceGetPayload<object>;

const bytes = (v: Uint8Array): Uint8Array<ArrayBuffer> => Uint8Array.from(v);

function mapConsent(r: ConsentRow): ConsentRecord {
  return {
    id: r.id,
    customerId: r.customerId,
    subjectEmailHash: r.subjectEmailHash,
    anonymousId: r.anonymousId,
    // Las finalidades obsoletas no se escriben desde Sprint 2 (CHECK consents_purpose_v2_ck).
    purpose: r.purpose as ConsentPurpose,
    policyVersion: r.policyVersion,
    textHash: r.textHash,
    locale: r.locale,
    granted: r.granted,
    method: r.method,
    ip: r.ip,
    userAgent: r.userAgent,
    source: r.source,
    createdAt: r.createdAt,
  };
}

function mapAcceptance(r: AcceptanceRow): LegalAcceptanceRecord {
  return {
    id: r.id,
    customerId: r.customerId,
    bookingId: r.bookingId,
    subjectEmailHash: r.subjectEmailHash,
    document: r.document,
    documentVersion: r.documentVersion,
    textHash: r.textHash,
    locale: r.locale,
    ip: r.ip,
    userAgent: r.userAgent,
    source: r.source,
    createdAt: r.createdAt,
  };
}

export class PrismaConsentRepository implements ConsentRepository {
  constructor(private readonly db: PrismaTx) {}

  async insert(c: ConsentRecord): Promise<void> {
    await this.db.consent.create({
      data: {
        id: c.id,
        customerId: c.customerId,
        subjectEmailHash: c.subjectEmailHash ? bytes(c.subjectEmailHash) : null,
        anonymousId: c.anonymousId,
        purpose: c.purpose,
        policyVersion: c.policyVersion,
        textHash: c.textHash,
        locale: c.locale,
        granted: c.granted,
        method: c.method,
        ip: c.ip,
        userAgent: c.userAgent,
        source: c.source,
        createdAt: c.createdAt,
      },
    });
  }

  async latestBySubject(subjectEmailHash: Uint8Array, purpose: ConsentPurpose): Promise<ConsentRecord | null> {
    const row = await this.db.consent.findFirst({
      where: { subjectEmailHash: bytes(subjectEmailHash), purpose },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    });
    return row ? mapConsent(row) : null;
  }

  async historyBySubject(subjectEmailHash: Uint8Array): Promise<ConsentRecord[]> {
    const rows = await this.db.consent.findMany({ where: { subjectEmailHash: bytes(subjectEmailHash) }, orderBy: [{ createdAt: 'asc' }, { id: 'asc' }] });
    return rows.map(mapConsent);
  }
}

export class PrismaLegalAcceptanceRepository implements LegalAcceptanceRepository {
  constructor(private readonly db: PrismaTx) {}

  async insert(a: LegalAcceptanceRecord): Promise<void> {
    await this.db.legalAcceptance.create({
      data: {
        id: a.id,
        customerId: a.customerId,
        bookingId: a.bookingId,
        subjectEmailHash: bytes(a.subjectEmailHash),
        document: a.document,
        documentVersion: a.documentVersion,
        textHash: a.textHash,
        locale: a.locale,
        ip: a.ip,
        userAgent: a.userAgent,
        source: a.source,
        createdAt: a.createdAt,
      },
    });
  }

  async findByBooking(bookingId: string): Promise<LegalAcceptanceRecord[]> {
    return (await this.db.legalAcceptance.findMany({ where: { bookingId }, orderBy: { createdAt: 'asc' } })).map(mapAcceptance);
  }
}
