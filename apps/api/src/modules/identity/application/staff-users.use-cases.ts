import { auditIp, type RequestMeta } from '../../../shared/application/audit.js';
import { ConcurrencyError, ConflictError, ForbiddenError, NotFoundError } from '../../../shared/domain/domain-error.js';
import type { Clock, IdGenerator } from '../../../shared/domain/ports.js';
import type { StaffRole } from '../domain/permissions.js';
import { assertPasswordPolicy, generatePassword, normalizeStaffEmail, type AccountStatus, type StaffUser } from '../domain/staff-user.js';
import type { IdentityRepositories, IdentityStore, PasswordHasher } from './ports.js';
import { toProfile, type StaffActor, type StaffProfile } from './staff-auth.use-cases.js';

export interface StaffUserSummary extends StaffProfile {
  status: AccountStatus;
  lockedUntil: Date | null;
  failedLoginCount: number;
  version: number;
  createdAt: Date;
}

export class StaffUserNotFoundError extends NotFoundError {
  constructor() {
    super('staff-user-not-found', 'Usuario del staff no encontrado.');
  }
}

function summary(user: StaffUser): StaffUserSummary {
  return {
    ...toProfile(user),
    status: user.status,
    lockedUntil: user.lockedUntil,
    failedLoginCount: user.failedLoginCount,
    version: user.version,
    createdAt: user.createdAt,
  };
}

/**
 * Gestión de usuarios del staff (permiso `users:manage`). Las contraseñas temporales se
 * devuelven UNA sola vez; el usuario enrola su TOTP en el primer ingreso.
 */
export class StaffUsersUseCases {
  constructor(
    private readonly store: IdentityStore,
    private readonly clock: Clock,
    private readonly ids: IdGenerator,
    private readonly hasher: PasswordHasher,
  ) {}

  list(): Promise<StaffUserSummary[]> {
    return this.store.run(async (r) => (await r.users.list()).filter((u) => !u.deletedAt).map(summary));
  }

  get(id: string): Promise<StaffUserSummary> {
    return this.store.run(async (r) => summary(await this.load(r, id)));
  }

  /**
   * Alta de usuario. Si no se envía contraseña se genera una aleatoria y se devuelve una vez.
   * También la usa `pnpm admin:create` (actor null = CLI).
   */
  async create(
    input: { email: string; fullName: string; role: StaffRole; password?: string },
    actor: StaffActor | null,
    meta: RequestMeta,
  ): Promise<{ user: StaffUserSummary; temporaryPassword: string | null }> {
    const email = normalizeStaffEmail(input.email);
    const fullName = input.fullName.trim().replace(/\s+/g, ' ');
    const password = input.password ?? generatePassword();
    assertPasswordPolicy(password, { email, fullName });
    const passwordHash = await this.hasher.hash(password);
    const now = this.clock.now();
    const user = await this.store.run(async (r) => {
      if (await r.users.findByEmail(email)) throw new ConflictError('staff-email-taken', 'Ya existe un usuario del staff con ese correo.');
      const created: StaffUser = {
        id: this.ids.next(),
        email,
        fullName,
        role: input.role,
        status: 'active',
        passwordHash,
        mfaSecretEnc: null,
        mfaEnabledAt: null,
        mfaLastTimeStep: null,
        failedLoginCount: 0,
        lockedUntil: null,
        lastFailedLoginAt: null,
        passwordChangedAt: now,
        lastLoginAt: null,
        version: 0,
        createdAt: now,
        deletedAt: null,
      };
      await r.users.insert(created);
      await r.audit.record({
        actorType: actor ? 'user' : 'system',
        actorId: actor?.userId ?? null,
        entityType: 'users',
        entityId: created.id,
        action: 'STAFF_USER_CREATED',
        after: { role: created.role, source: actor ? 'backoffice' : 'cli' },
        ip: auditIp(meta.ip),
        requestId: meta.requestId,
        occurredAt: now,
      });
      return created;
    });
    return { user: summary(user), temporaryPassword: input.password ? null : password };
  }

  async update(
    actor: StaffActor,
    id: string,
    input: { version: number; role?: StaffRole; status?: AccountStatus; fullName?: string },
    meta: RequestMeta,
  ): Promise<StaffUserSummary> {
    const now = this.clock.now();
    return this.store.run(async (r) => {
      const user = await this.load(r, id);
      if (user.version !== input.version) throw new ConcurrencyError('El usuario fue modificado por otra operación. Recarga e intenta de nuevo.');
      const changingSelf = user.id === actor.userId;
      if (changingSelf && ((input.role && input.role !== user.role) || (input.status && input.status !== 'active'))) {
        throw new ForbiddenError('cannot-modify-own-access', 'No puedes cambiar tu propio rol ni desactivar tu propia cuenta.');
      }
      const before = { role: user.role, status: user.status, fullName: user.fullName };
      const losesAdmin = user.role === 'admin' && user.status === 'active' && ((input.role && input.role !== 'admin') || (input.status && input.status !== 'active'));
      if (losesAdmin) {
        const admins = (await r.users.list()).filter((u) => !u.deletedAt && u.role === 'admin' && u.status === 'active');
        if (admins.length <= 1) throw new ConflictError('last-admin', 'Debe quedar al menos un administrador activo.');
      }
      if (input.role) user.role = input.role;
      if (input.status) user.status = input.status;
      if (input.fullName) user.fullName = input.fullName.trim().replace(/\s+/g, ' ');
      user.version += 1;
      await r.users.update(user);
      if (input.status && input.status !== 'active') await r.sessions.revokeAllForUser(user.id, 'user_disabled', now);
      await r.audit.record({
        actorType: 'user', actorId: actor.userId, entityType: 'users', entityId: user.id, action: 'STAFF_USER_UPDATED',
        changedFields: Object.keys(input).filter((k) => k !== 'version'), before, after: { role: user.role, status: user.status, fullName: user.fullName },
        ip: auditIp(meta.ip), requestId: meta.requestId, occurredAt: now,
      });
      return summary(user);
    });
  }

  /** Reinicia el segundo factor: el usuario debe volver a enrolarlo; se cierran sus sesiones. */
  resetMfa(actor: StaffActor, id: string, meta: RequestMeta): Promise<StaffUserSummary> {
    return this.mutate(actor, id, meta, 'STAFF_MFA_RESET', async (r, user, now) => {
      user.mfaSecretEnc = null;
      user.mfaEnabledAt = null;
      user.mfaLastTimeStep = null;
      await r.recoveryCodes.replaceAll(user.id, [], now);
      await r.sessions.revokeAllForUser(user.id, 'mfa_reset', now);
    });
  }

  unlock(actor: StaffActor, id: string, meta: RequestMeta): Promise<StaffUserSummary> {
    return this.mutate(actor, id, meta, 'STAFF_USER_UNLOCKED', (_r, user) => {
      user.failedLoginCount = 0;
      user.lockedUntil = null;
      return Promise.resolve();
    });
  }

  revokeSessions(actor: StaffActor, id: string, meta: RequestMeta): Promise<StaffUserSummary> {
    return this.mutate(actor, id, meta, 'STAFF_SESSIONS_REVOKED', async (r, user, now) => {
      await r.sessions.revokeAllForUser(user.id, 'admin', now);
    });
  }

  /** Nueva contraseña temporal (se devuelve una vez) y cierre de sesiones. */
  async resetPassword(actor: StaffActor, id: string, meta: RequestMeta): Promise<{ user: StaffUserSummary; temporaryPassword: string }> {
    const password = generatePassword();
    const hash = await this.hasher.hash(password);
    const user = await this.mutate(actor, id, meta, 'STAFF_PASSWORD_RESET', async (r, u, now) => {
      u.passwordHash = hash;
      u.passwordChangedAt = now;
      await r.sessions.revokeAllForUser(u.id, 'password_changed', now);
    });
    return { user, temporaryPassword: password };
  }

  private mutate(
    actor: StaffActor,
    id: string,
    meta: RequestMeta,
    action: string,
    change: (r: IdentityRepositories, user: StaffUser, now: Date) => Promise<void>,
  ): Promise<StaffUserSummary> {
    const now = this.clock.now();
    return this.store.run(async (r) => {
      const user = await this.load(r, id);
      await change(r, user, now);
      user.version += 1;
      await r.users.update(user);
      await r.audit.record({
        actorType: 'user', actorId: actor.userId, entityType: 'users', entityId: user.id, action,
        ip: auditIp(meta.ip), requestId: meta.requestId, occurredAt: now,
      });
      return summary(user);
    });
  }

  private async load(r: IdentityRepositories, id: string): Promise<StaffUser> {
    const user = /^[0-9a-f-]{36}$/i.test(id) ? await r.users.findById(id) : null;
    if (!user || user.deletedAt) throw new StaffUserNotFoundError();
    return user;
  }
}
