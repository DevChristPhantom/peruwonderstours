import { AsyncLocalStorage } from 'node:async_hooks';
import type { Prisma, PrismaClient } from '../../../generated/prisma/client.js';
import { mapPrismaError, type PrismaTx } from '../../../persistence/prisma/prisma-client.js';
import { InMemoryAuditTrail, PrismaAuditTrail } from '../../../persistence/prisma/prisma-audit-trail.js';
import { UuidV7Generator } from '../../../shared/infrastructure/system.js';
import type {
  AuthSessionRecord,
  AuthSessionRepository,
  IdentityRepositories,
  IdentityStore,
  LoginThrottleRepository,
  StaffUserFields,
  ThrottleKey,
  RecoveryCodeRepository,
  RevocationReason,
  StaffUserRepository,
} from '../application/ports.js';
import type { StaffUser } from '../domain/staff-user.js';

const ids = new UuidV7Generator();
const bytes = (v: Uint8Array): Uint8Array<ArrayBuffer> => Uint8Array.from(v);

type UserRow = Prisma.UserGetPayload<object>;
type SessionRow = Prisma.AuthSessionGetPayload<object>;

function mapUser(row: UserRow): StaffUser {
  return {
    id: row.id,
    email: row.email,
    fullName: row.fullName,
    role: row.role,
    status: row.status,
    passwordHash: row.passwordHash,
    mfaSecretEnc: row.mfaSecretEnc,
    mfaEnabledAt: row.mfaEnabledAt,
    mfaLastTimeStep: row.mfaLastTimeStep === null ? null : Number(row.mfaLastTimeStep),
    failedLoginCount: row.failedLoginCount,
    lockedUntil: row.lockedUntil,
    lastFailedLoginAt: row.lastFailedLoginAt,
    passwordChangedAt: row.passwordChangedAt,
    mustChangePassword: row.mustChangePassword,
    lastLoginAt: row.lastLoginAt,
    version: row.version,
    createdAt: row.createdAt,
    deletedAt: row.deletedAt,
  };
}

function mapSession(row: SessionRow): AuthSessionRecord {
  return {
    id: row.id,
    userId: row.userId!,
    familyId: row.familyId,
    tokenHash: row.tokenHash,
    replacedById: row.replacedById,
    ip: row.ip,
    userAgent: row.userAgent,
    expiresAt: row.expiresAt,
    absoluteExpiresAt: row.absoluteExpiresAt,
    revokedAt: row.revokedAt,
    revokedReason: row.revokedReason,
    createdAt: row.createdAt,
  };
}

function mutableUser(u: StaffUser) {
  return {
    fullName: u.fullName,
    role: u.role,
    status: u.status,
    passwordHash: u.passwordHash,
    mfaSecretEnc: u.mfaSecretEnc ? bytes(u.mfaSecretEnc) : null,
    mfaEnabledAt: u.mfaEnabledAt,
    mfaLastTimeStep: u.mfaLastTimeStep === null ? null : BigInt(u.mfaLastTimeStep),
    failedLoginCount: u.failedLoginCount,
    lockedUntil: u.lockedUntil,
    lastFailedLoginAt: u.lastFailedLoginAt,
    passwordChangedAt: u.passwordChangedAt,
    mustChangePassword: u.mustChangePassword,
    lastLoginAt: u.lastLoginAt,
    version: u.version,
    deletedAt: u.deletedAt,
  };
}

/** Solo las columnas pedidas, en el formato de Prisma (bytea / bigint). */
function fieldsData(fields: StaffUserFields): Prisma.UserUpdateManyMutationInput {
  const data: Prisma.UserUpdateManyMutationInput = {};
  for (const [key, value] of Object.entries(fields)) {
    if (value === undefined) continue;
    if (key === 'mfaSecretEnc') data.mfaSecretEnc = value ? bytes(value as Uint8Array) : null;
    else if (key === 'mfaLastTimeStep') data.mfaLastTimeStep = value === null ? null : BigInt(value as number);
    else (data as Record<string, unknown>)[key] = value;
  }
  return data;
}

class PrismaStaffUserRepository implements StaffUserRepository {
  constructor(private readonly db: PrismaTx) {}
  async findByEmail(email: string): Promise<StaffUser | null> {
    const row = await this.db.user.findFirst({ where: { email, deletedAt: null } });
    return row ? mapUser(row) : null;
  }
  async findById(id: string): Promise<StaffUser | null> {
    const row = await this.db.user.findUnique({ where: { id } });
    return row ? mapUser(row) : null;
  }
  async insert(u: StaffUser): Promise<void> {
    await this.db.user.create({ data: { id: u.id, email: u.email, createdAt: u.createdAt, ...mutableUser(u) } });
  }
  async updateFields(id: string, fields: StaffUserFields, options: { expectedVersion?: number; bumpVersion?: boolean } = {}): Promise<boolean> {
    const data = fieldsData(fields);
    if (options.bumpVersion) data.version = { increment: 1 };
    const result = await this.db.user.updateMany({
      where: { id, ...(options.expectedVersion !== undefined ? { version: options.expectedVersion } : {}) },
      data,
    });
    return result.count === 1;
  }
  async incrementFailedLogins(id: string, now: Date): Promise<void> {
    await this.db.$executeRaw`UPDATE users SET failed_login_count = failed_login_count + 1, last_failed_login_at = ${now} WHERE id = ${id}::uuid`;
  }
  async list(): Promise<StaffUser[]> {
    return (await this.db.user.findMany({ orderBy: { createdAt: 'asc' } })).map(mapUser);
  }
}

class PrismaAuthSessionRepository implements AuthSessionRepository {
  constructor(private readonly db: PrismaTx) {}
  async insert(s: AuthSessionRecord): Promise<void> {
    await this.db.authSession.create({
      data: {
        id: s.id, userId: s.userId, familyId: s.familyId, tokenHash: bytes(s.tokenHash), replacedById: s.replacedById, ip: s.ip,
        userAgent: s.userAgent, expiresAt: s.expiresAt, absoluteExpiresAt: s.absoluteExpiresAt, revokedAt: s.revokedAt,
        revokedReason: s.revokedReason, createdAt: s.createdAt,
      },
    });
  }
  async findByTokenHashForUpdate(tokenHash: Uint8Array): Promise<AuthSessionRecord | null> {
    const locked = await this.db.$queryRaw<Array<{ id: string }>>`
      SELECT id FROM auth_sessions WHERE token_hash = ${Buffer.from(tokenHash)} AND user_id IS NOT NULL FOR UPDATE`;
    if (locked.length === 0) return null;
    const row = await this.db.authSession.findUnique({ where: { id: locked[0]!.id } });
    return row ? mapSession(row) : null;
  }
  async findActiveInFamily(familyId: string, now: Date): Promise<AuthSessionRecord | null> {
    if (!/^[0-9a-f-]{36}$/i.test(familyId)) return null;
    const row = await this.db.authSession.findFirst({
      where: { familyId, userId: { not: null }, revokedAt: null, expiresAt: { gt: now }, absoluteExpiresAt: { gt: now } },
      orderBy: { createdAt: 'desc' },
    });
    return row ? mapSession(row) : null;
  }
  async revoke(id: string, reason: RevocationReason, now: Date, replacedById: string | null = null): Promise<void> {
    await this.db.authSession.updateMany({ where: { id, revokedAt: null }, data: { revokedAt: now, revokedReason: reason, replacedById } });
  }
  async revokeFamily(familyId: string, reason: RevocationReason, now: Date): Promise<number> {
    const r = await this.db.authSession.updateMany({ where: { familyId, revokedAt: null }, data: { revokedAt: now, revokedReason: reason } });
    return r.count;
  }
  async revokeAllForUser(userId: string, reason: RevocationReason, now: Date): Promise<number> {
    const r = await this.db.authSession.updateMany({ where: { userId, revokedAt: null }, data: { revokedAt: now, revokedReason: reason } });
    return r.count;
  }
  async listActiveForUser(userId: string, now: Date): Promise<AuthSessionRecord[]> {
    const rows = await this.db.authSession.findMany({
      where: { userId, revokedAt: null, expiresAt: { gt: now }, absoluteExpiresAt: { gt: now } },
      orderBy: { createdAt: 'desc' },
    });
    const seen = new Set<string>();
    return rows.filter((r) => (seen.has(r.familyId) ? false : (seen.add(r.familyId), true))).map(mapSession);
  }
}

/** Contadores atómicos en SQL: N intentos concurrentes cuentan N (H-03). */
class PrismaLoginThrottleRepository implements LoginThrottleRepository {
  constructor(private readonly db: PrismaTx) {}

  async retryAfterSeconds(keys: readonly ThrottleKey[], now: Date): Promise<number> {
    const rows = await this.db.authLoginThrottle.findMany({ where: { key: { in: keys.map((k) => k.key) }, blockedUntil: { gt: now } }, select: { blockedUntil: true } });
    return Math.max(0, ...rows.map((r) => Math.ceil((r.blockedUntil!.getTime() - now.getTime()) / 1000)));
  }

  async registerFailure(keys: readonly ThrottleKey[], now: Date): Promise<number> {
    let wait = 0;
    for (const k of keys) {
      // Ventana de 24 h: un fallo viejo no suma. Desde el umbral, espera = base * 2^(n - umbral) con tope.
      const rows = await this.db.$queryRaw<Array<{ blocked_until: Date | null }>>`
        INSERT INTO auth_login_throttle AS t (key, account_key, failures, last_failure_at, blocked_until)
        VALUES (${k.key}, ${k.accountKey}, 1, ${now},
                CASE WHEN 1 >= ${k.policy.threshold}::int THEN ${now}::timestamptz + make_interval(secs => ${k.policy.baseSeconds}::int) END)
        ON CONFLICT (key) DO UPDATE SET
          failures = CASE WHEN t.last_failure_at < ${now}::timestamptz - interval '24 hours' THEN 1 ELSE t.failures + 1 END,
          last_failure_at = ${now},
          blocked_until = CASE
            WHEN (CASE WHEN t.last_failure_at < ${now}::timestamptz - interval '24 hours' THEN 1 ELSE t.failures + 1 END) >= ${k.policy.threshold}::int
            THEN ${now}::timestamptz + make_interval(secs => LEAST(${k.policy.maxSeconds}::int,
                   ${k.policy.baseSeconds}::int * power(2, LEAST((CASE WHEN t.last_failure_at < ${now}::timestamptz - interval '24 hours' THEN 1 ELSE t.failures + 1 END) - ${k.policy.threshold}::int, 20))::int))
            ELSE t.blocked_until END
        RETURNING blocked_until`;
      const until = rows[0]?.blocked_until;
      if (until && until.getTime() > now.getTime()) wait = Math.max(wait, Math.ceil((until.getTime() - now.getTime()) / 1000));
    }
    return wait;
  }

  async reset(keys: readonly ThrottleKey[]): Promise<void> {
    await this.db.authLoginThrottle.deleteMany({ where: { key: { in: keys.map((k) => k.key) } } });
  }

  async resetAccount(accountKey: string): Promise<void> {
    await this.db.authLoginThrottle.deleteMany({ where: { accountKey } });
  }
}

class PrismaRecoveryCodeRepository implements RecoveryCodeRepository {
  constructor(private readonly db: PrismaTx) {}
  async replaceAll(userId: string, codeHashes: readonly string[], now: Date): Promise<void> {
    await this.db.userRecoveryCode.deleteMany({ where: { userId } });
    if (codeHashes.length > 0) {
      await this.db.userRecoveryCode.createMany({ data: codeHashes.map((codeHash) => ({ id: ids.next(), userId, codeHash, createdAt: now })) });
    }
  }
  async consume(userId: string, codeHash: string, now: Date): Promise<boolean> {
    const r = await this.db.userRecoveryCode.updateMany({ where: { userId, codeHash, usedAt: null }, data: { usedAt: now } });
    return r.count === 1;
  }
  countUnused(userId: string): Promise<number> {
    return this.db.userRecoveryCode.count({ where: { userId, usedAt: null } });
  }
}

/** Transacción READ COMMITTED; la rotación del refresh bloquea la fila (FOR UPDATE). */
export class PrismaIdentityStore implements IdentityStore {
  private readonly context = new AsyncLocalStorage<IdentityRepositories>();
  constructor(private readonly client: PrismaClient) {}

  async run<T>(work: (repos: IdentityRepositories) => Promise<T>): Promise<T> {
    const current = this.context.getStore();
    if (current) return work(current);
    try {
      return await this.client.$transaction(
        (tx) => {
          const repos: IdentityRepositories = {
            users: new PrismaStaffUserRepository(tx),
            sessions: new PrismaAuthSessionRepository(tx),
            recoveryCodes: new PrismaRecoveryCodeRepository(tx),
            throttle: new PrismaLoginThrottleRepository(tx),
            audit: new PrismaAuditTrail(tx),
          };
          return this.context.run(repos, () => work(repos));
        },
        { isolationLevel: 'ReadCommitted', timeout: 15_000, maxWait: 5_000 },
      );
    } catch (error) {
      throw mapPrismaError(error);
    }
  }
}

// -----------------------------------------------------------------------------
// Memoria (modo seed/memory y pruebas unitarias). Serializa y revierte como el UoW en memoria.
// -----------------------------------------------------------------------------
export interface InMemoryIdentityState {
  users: Map<string, StaffUser>;
  sessions: Map<string, AuthSessionRecord>;
  recoveryCodes: Array<{ userId: string; codeHash: string; usedAt: Date | null }>;
  throttle: Map<string, { accountKey: string; failures: number; lastFailureAt: Date; blockedUntil: Date | null }>;
}

export class InMemoryIdentityStore implements IdentityStore {
  state: InMemoryIdentityState = { users: new Map(), sessions: new Map(), recoveryCodes: [], throttle: new Map() };
  readonly audit = new InMemoryAuditTrail();
  private queue: Promise<unknown> = Promise.resolve();
  private readonly context = new AsyncLocalStorage<boolean>();
  private readonly repos: IdentityRepositories;

  constructor() {
    const clone = <T>(v: T): T => structuredClone(v);
    this.repos = {
      users: {
        findByEmail: (email) => Promise.resolve(clone([...this.state.users.values()].find((u) => u.email === email && !u.deletedAt) ?? null)),
        findById: (id) => Promise.resolve(clone(this.state.users.get(id) ?? null)),
        insert: (u) => {
          if ([...this.state.users.values()].some((x) => x.email === u.email)) return Promise.reject(new Error('unique email'));
          this.state.users.set(u.id, clone(u));
          return Promise.resolve();
        },
        updateFields: (id, fields, options = {}) => {
          const u = this.state.users.get(id);
          if (!u || (options.expectedVersion !== undefined && u.version !== options.expectedVersion)) return Promise.resolve(false);
          for (const [k, v] of Object.entries(fields)) if (v !== undefined) (u as unknown as Record<string, unknown>)[k] = clone(v);
          if (options.bumpVersion) u.version += 1;
          return Promise.resolve(true);
        },
        incrementFailedLogins: (id, now) => {
          const u = this.state.users.get(id);
          if (u) {
            u.failedLoginCount += 1;
            u.lastFailedLoginAt = now;
          }
          return Promise.resolve();
        },
        list: () => Promise.resolve([...this.state.users.values()].map(clone)),
      },
      sessions: {
        insert: (s) => {
          this.state.sessions.set(s.id, clone(s));
          return Promise.resolve();
        },
        findByTokenHashForUpdate: (hash) =>
          Promise.resolve(clone([...this.state.sessions.values()].find((s) => Buffer.from(s.tokenHash).equals(Buffer.from(hash))) ?? null)),
        findActiveInFamily: (familyId, now) =>
          Promise.resolve(
            clone(
              [...this.state.sessions.values()]
                .filter((s) => s.familyId === familyId && !s.revokedAt && s.expiresAt > now && s.absoluteExpiresAt > now)
                .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())[0] ?? null,
            ),
          ),
        revoke: (id, reason, now, replacedById = null) => {
          const s = this.state.sessions.get(id);
          if (s && !s.revokedAt) Object.assign(s, { revokedAt: now, revokedReason: reason, replacedById });
          return Promise.resolve();
        },
        revokeFamily: (familyId, reason, now) => Promise.resolve(this.revokeWhere((s) => s.familyId === familyId, reason, now)),
        revokeAllForUser: (userId, reason, now) => Promise.resolve(this.revokeWhere((s) => s.userId === userId, reason, now)),
        listActiveForUser: (userId, now) => {
          const seen = new Set<string>();
          return Promise.resolve(
            [...this.state.sessions.values()]
              .filter((s) => s.userId === userId && !s.revokedAt && s.expiresAt > now && s.absoluteExpiresAt > now)
              .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
              .filter((s) => (seen.has(s.familyId) ? false : (seen.add(s.familyId), true)))
              .map(clone),
          );
        },
      },
      recoveryCodes: {
        replaceAll: (userId, hashes) => {
          this.state.recoveryCodes = [...this.state.recoveryCodes.filter((c) => c.userId !== userId), ...hashes.map((codeHash) => ({ userId, codeHash, usedAt: null }))];
          return Promise.resolve();
        },
        consume: (userId, codeHash, now) => {
          const c = this.state.recoveryCodes.find((x) => x.userId === userId && x.codeHash === codeHash && !x.usedAt);
          if (c) c.usedAt = now;
          return Promise.resolve(Boolean(c));
        },
        countUnused: (userId) => Promise.resolve(this.state.recoveryCodes.filter((c) => c.userId === userId && !c.usedAt).length),
      },
      throttle: {
        retryAfterSeconds: (keys, now) =>
          Promise.resolve(
            Math.max(0, ...keys.map((k) => this.state.throttle.get(k.key)?.blockedUntil).filter((d): d is Date => !!d && d > now).map((d) => Math.ceil((d.getTime() - now.getTime()) / 1000))),
          ),
        registerFailure: (keys, now) => {
          let wait = 0;
          for (const k of keys) {
            const prev = this.state.throttle.get(k.key);
            const failures = prev && now.getTime() - prev.lastFailureAt.getTime() <= 24 * 3600_000 ? prev.failures + 1 : 1;
            let blockedUntil = prev?.blockedUntil ?? null;
            if (failures >= k.policy.threshold) {
              const secs = Math.min(k.policy.maxSeconds, k.policy.baseSeconds * 2 ** Math.min(failures - k.policy.threshold, 20));
              blockedUntil = new Date(now.getTime() + secs * 1000);
              wait = Math.max(wait, secs);
            }
            this.state.throttle.set(k.key, { accountKey: k.accountKey, failures, lastFailureAt: now, blockedUntil });
          }
          return Promise.resolve(wait);
        },
        reset: (keys) => {
          for (const k of keys) this.state.throttle.delete(k.key);
          return Promise.resolve();
        },
        resetAccount: (accountKey) => {
          for (const [key, v] of this.state.throttle) if (v.accountKey === accountKey) this.state.throttle.delete(key);
          return Promise.resolve();
        },
      },
      audit: this.audit,
    };
  }

  run<T>(work: (repos: IdentityRepositories) => Promise<T>): Promise<T> {
    if (this.context.getStore()) return work(this.repos);
    const next = this.queue.then(() =>
      this.context.run(true, async () => {
        const snapshot = structuredClone(this.state);
        const auditLength = this.audit.entries.length;
        try {
          return await work(this.repos);
        } catch (error) {
          this.state = snapshot;
          this.audit.entries.length = auditLength;
          throw error;
        }
      }),
    );
    this.queue = next.catch(() => undefined);
    return next;
  }

  private revokeWhere(predicate: (s: AuthSessionRecord) => boolean, reason: RevocationReason, now: Date): number {
    let count = 0;
    for (const s of this.state.sessions.values()) {
      if (!s.revokedAt && predicate(s)) {
        s.revokedAt = now;
        s.revokedReason = reason;
        count += 1;
      }
    }
    return count;
  }
}
