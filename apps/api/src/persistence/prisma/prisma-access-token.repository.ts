import type { AccessTokenPurpose, AccessTokenRecord, AccessTokenRepository } from '../../shared/domain/access-grant.js';
import type { PrismaTx } from './prisma-client.js';

type Row = {
  id: string;
  purpose: string;
  subjectId: string;
  tokenHash: string;
  locale: 'es' | 'en';
  expiresAt: Date;
  consumedAt: Date | null;
  revokedAt: Date | null;
  lastUsedAt: Date | null;
  createdAt: Date;
};

const map = (r: Row): AccessTokenRecord => ({ ...r, purpose: r.purpose as AccessTokenPurpose });

export class PrismaAccessTokenRepository implements AccessTokenRepository {
  constructor(private readonly db: PrismaTx) {}

  async insert(record: AccessTokenRecord): Promise<void> {
    await this.db.accessToken.create({ data: { ...record } });
  }

  async findByHash(tokenHash: string): Promise<AccessTokenRecord | null> {
    const row = await this.db.accessToken.findUnique({ where: { tokenHash } });
    return row ? map(row) : null;
  }

  async consume(id: string, now: Date): Promise<boolean> {
    const result = await this.db.accessToken.updateMany({ where: { id, consumedAt: null, revokedAt: null, expiresAt: { gt: now } }, data: { consumedAt: now } });
    return result.count === 1;
  }

  async revoke(id: string, now: Date): Promise<void> {
    await this.db.accessToken.updateMany({ where: { id, revokedAt: null }, data: { revokedAt: now } });
  }

  async revokeAllForSubject(subjectId: string, purpose: AccessTokenPurpose, now: Date): Promise<number> {
    const result = await this.db.accessToken.updateMany({ where: { subjectId, purpose, revokedAt: null, expiresAt: { gt: now } }, data: { revokedAt: now } });
    return result.count;
  }

  async touch(id: string, now: Date): Promise<void> {
    await this.db.accessToken.updateMany({
      where: { id, OR: [{ lastUsedAt: null }, { lastUsedAt: { lt: new Date(now.getTime() - 60_000) } }] },
      data: { lastUsedAt: now },
    });
  }

  countCreatedSince(subjectId: string, purpose: AccessTokenPurpose, since: Date): Promise<number> {
    return this.db.accessToken.count({ where: { subjectId, purpose, createdAt: { gte: since } } });
  }
}
