import 'dotenv/config';
import type { PrismaClient } from '../src/generated/prisma/client.js';
import { createPrismaClient } from '../src/persistence/prisma/prisma-client.js';

const url = process.env['DATABASE_URL'];
const describeDb = url ? describe : describe.skip;

class Rollback extends Error {}

/**
 * Regresión: el adapter `pg` envía los `Date` sin zona horaria. Con el servidor en
 * America/Lima, los `timestamptz` escritos por la app quedaban 5 h corridos frente a `now()`.
 * La sesión debe ir en UTC para que el instante guardado sea el mismo que el de la app.
 */
describeDb('Zona horaria de la sesión Prisma', () => {
  let prisma: PrismaClient;

  beforeAll(async () => {
    prisma = createPrismaClient(url!);
    await prisma.$connect();
  });
  afterAll(async () => {
    await prisma?.$disconnect();
  });

  it('la sesión usa UTC', async () => {
    const rows = await prisma.$queryRaw<{ tz: string }[]>`SELECT current_setting('TimeZone') AS tz`;
    expect(rows[0]?.tz).toBe('UTC');
  });

  it('un Date escrito por la app conserva el mismo instante', async () => {
    const createdAt = new Date('2026-10-07T22:20:01.000Z');
    const expiresAt = new Date(createdAt.getTime() + 60 * 60 * 1000);
    let storedEpochMs: number | null = null;

    await prisma
      .$transaction(async (tx) => {
        await tx.idempotencyKey.create({
          data: {
            scope: 'tz-regression',
            key: 'tz-regression-key',
            requestHash: '0'.repeat(64),
            createdAt,
            expiresAt,
          },
        });
        const rows = await tx.$queryRaw<{ epoch: number }[]>`
          SELECT (extract(epoch FROM created_at) * 1000)::float8 AS epoch
          FROM idempotency_keys WHERE scope = 'tz-regression' AND key = 'tz-regression-key'`;
        storedEpochMs = Number(rows[0]?.epoch);
        throw new Rollback();
      })
      .catch((error: unknown) => {
        if (!(error instanceof Rollback)) throw error;
      });

    expect(storedEpochMs).toBe(createdAt.getTime());
  });
});
