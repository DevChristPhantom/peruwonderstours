import 'dotenv/config';
import { randomUUID } from 'node:crypto';
import type { PrismaClient } from '../src/generated/prisma/client.js';
import { createPrismaClient, mapPrismaError, type PrismaTx } from '../src/persistence/prisma/prisma-client.js';
import { createPrismaRepositories } from '../src/persistence/prisma/prisma-unit-of-work.js';
import { calendarDateToUtcDate } from '../src/shared/domain/calendar-date.js';
import { ConflictError } from '../src/shared/domain/domain-error.js';
import { UuidV7Generator } from '../src/shared/infrastructure/system.js';

const url = process.env['DATABASE_URL'];
const describeDb = url ? describe : describe.skip;
const ids = new UuidV7Generator();

class Rollback extends Error {}

/** Repositorios de Sprint 2 contra PostgreSQL real (transacción revertida en pwt_dev). */
describeDb('Sprint 2: outbox, consentimientos y restricciones en PostgreSQL', () => {
  let prisma: PrismaClient;

  beforeAll(async () => {
    prisma = createPrismaClient(url!);
    await prisma.$connect();
  });
  afterAll(async () => {
    await prisma?.$disconnect();
  });

  async function inRollback(fn: (tx: PrismaTx) => Promise<void>): Promise<void> {
    try {
      await prisma.$transaction(
        async (tx) => {
          await fn(tx);
          throw new Rollback();
        },
        { timeout: 30_000, maxWait: 15_000 },
      );
    } catch (error) {
      if (!(error instanceof Rollback)) throw error;
    }
  }

  it('outbox: addIfAbsent deduplica con ON CONFLICT y claim incrementa intentos con lease', async () => {
    await inRollback(async (tx) => {
      const repos = createPrismaRepositories(tx);
      const now = new Date();
      const aggregateId = randomUUID();
      const msg = (dedupeKey: string) => ({
        id: ids.next(), aggregateType: 'booking', aggregateId, eventType: 'booking.balance_reminder',
        payload: { bookingId: aggregateId, daysBefore: 7 }, availableAt: new Date(now.getTime() - 1000), createdAt: now, dedupeKey,
      });
      const key = `int-test:${aggregateId}:7d`;
      expect(await repos.outbox.addIfAbsent(msg(key))).toBe(true);
      expect(await repos.outbox.addIfAbsent(msg(key))).toBe(false);
      const claimed = await repos.outboxQueue.claim(now, 500, 120, 8);
      const mine = claimed.find((e) => e.aggregateId === aggregateId)!;
      expect(mine).toMatchObject({ attempts: 1, eventType: 'booking.balance_reminder', dedupeKey: key });
      const row = await tx.outboxEvent.findUniqueOrThrow({ where: { id: mine.id } });
      expect(row.availableAt.getTime()).toBe(now.getTime() + 120_000);
      // Durante el lease nadie más lo reclama.
      expect((await repos.outboxQueue.claim(now, 500, 120, 8)).some((e) => e.id === mine.id)).toBe(false);
      await repos.outboxQueue.markFailed(mine.id, 'SMTP 451', new Date(now.getTime() + 30_000));
      await repos.emailDeliveries.insert({
        id: ids.next(), outboxEventId: mine.id, template: 'balance-reminder-7d', status: 'sent', messageId: '<x@pwt>',
        recipientHash: new Uint8Array(32), transportRef: 'memory:1', sentAt: now,
      });
      expect(await repos.emailDeliveries.find(mine.id, 'balance-reminder-7d')).toMatchObject({ messageId: '<x@pwt>' });
      await repos.outboxQueue.markPublished(mine.id, now);
      // email_deliveries es append-only.
      await expect(tx.$executeRaw`UPDATE email_deliveries SET transport_ref = 'x' WHERE outbox_event_id = ${mine.id}::uuid`).rejects.toThrow(/append-only/);
    });
  });

  it('consentimientos v2: titular sin cuenta por HMAC, CHECK de identificador y finalidades obsoletas', async () => {
    await inRollback(async (tx) => {
      const repos = createPrismaRepositories(tx);
      const hash = new Uint8Array(32).fill(7);
      const base = {
        customerId: null, anonymousId: null, policyVersion: 'v1', textHash: null, locale: 'es' as const, method: 'checkbox' as const,
        ip: '203.0.113.1', userAgent: 'int', source: 'checkout',
      };
      await repos.consents.insert({ ...base, id: ids.next(), subjectEmailHash: hash, purpose: 'marketing_email', granted: true, createdAt: new Date('2026-10-01T00:00:00Z') });
      await repos.consents.insert({ ...base, id: ids.next(), subjectEmailHash: hash, purpose: 'marketing_email', granted: false, method: 'email_link', createdAt: new Date('2026-10-02T00:00:00Z') });
      expect(await repos.consents.latestBySubject(hash, 'marketing_email')).toMatchObject({ granted: false, method: 'email_link' });
      expect(await repos.consents.historyBySubject(hash)).toHaveLength(2);
      await expect(
        tx.$executeRaw`INSERT INTO consents (id, purpose, policy_version, granted, source) VALUES (${ids.next()}::uuid, 'marketing_email', 'v1', true, 'x')`,
      ).rejects.toThrow(/consents_subject_ck/);
    });
    await inRollback(async (tx) => {
      await expect(
        tx.$executeRaw`INSERT INTO consents (id, subject_email_hash, purpose, policy_version, granted, source) VALUES (${ids.next()}::uuid, ${Buffer.alloc(32, 1)}, 'marketing', 'v1', true, 'x')`,
      ).rejects.toThrow(/consents_purpose_v2_ck/);
    });
  });

  it('el EXCLUDE de tarifas se traduce a 409 exclusion-violation', async () => {
    let mapped: unknown;
    await inRollback(async (tx) => {
      const slug = `int-s2-${randomUUID().slice(0, 8)}`;
      const tour = await tx.tour.create({ data: { id: ids.next(), slug, code: slug.toUpperCase(), type: 'tour', durationDays: 1 } });
      const rate = {
        tourId: tour.id, paxType: 'adult' as const, residency: 'foreign' as const, currency: 'USD', amount: 100n,
        validFrom: calendarDateToUtcDate('2027-01-01'), validTo: calendarDateToUtcDate('2027-12-31'),
      };
      await tx.rate.create({ data: { id: ids.next(), ...rate } });
      try {
        await tx.rate.create({ data: { id: ids.next(), ...rate, validFrom: calendarDateToUtcDate('2027-06-01') } });
      } catch (error) {
        mapped = mapPrismaError(error);
      }
    }).catch((error: unknown) => {
      mapped ??= mapPrismaError(error);
    });
    expect(mapped).toBeInstanceOf(ConflictError);
    expect((mapped as ConflictError).code).toBe('exclusion-violation');
  });

  it('auth_sessions y users: CHECK de hash de 32 bytes, motivo de revocación y MFA con secreto', async () => {
    await inRollback(async (tx) => {
      const user = await tx.user.create({ data: { id: ids.next(), email: `int-${randomUUID().slice(0, 6)}@pwt.test`, fullName: 'Int', role: 'agent', passwordHash: 'x' } });
      await expect(tx.user.update({ where: { id: user.id }, data: { mfaEnabledAt: new Date() } })).rejects.toThrow();
    });
    await inRollback(async (tx) => {
      const user = await tx.user.create({ data: { id: ids.next(), email: `int-${randomUUID().slice(0, 6)}@pwt.test`, fullName: 'Int', role: 'agent', passwordHash: 'x' } });
      const now = new Date();
      await expect(
        tx.authSession.create({
          data: { id: ids.next(), userId: user.id, familyId: ids.next(), tokenHash: new Uint8Array(32), expiresAt: new Date(now.getTime() + 1000), absoluteExpiresAt: now, createdAt: new Date(now.getTime() - 1000) },
        }),
      ).rejects.toThrow();
    });
  });
});
