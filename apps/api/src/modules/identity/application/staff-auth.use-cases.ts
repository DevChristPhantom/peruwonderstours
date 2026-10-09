import { createHash, randomBytes } from 'node:crypto';
import { auditIp, type AuditEntry, type RequestMeta } from '../../../shared/application/audit.js';
import type { PiiCipher } from '../../../shared/application/pii-cipher.js';
import {
  ConcurrencyError,
  ConflictError,
  ForbiddenError,
  NotFoundError,
  RateLimitedError,
  UnauthorizedError,
  ValidationError,
} from '../../../shared/domain/domain-error.js';
import type { Clock, IdGenerator } from '../../../shared/domain/ports.js';
import { permissionsFor, type Permission, type StaffRole } from '../domain/permissions.js';
import {
  assertPasswordPolicy,
  generateRecoveryCodes,
  hashRecoveryCode,
  isRecoveryCodeFormat,
  isTotpFormat,
  normalizeStaffEmail,
  type LockoutPolicy,
  type StaffUser,
} from '../domain/staff-user.js';
import type {
  AuthSessionRecord,
  IdentityRepositories,
  IdentityStore,
  PasswordHasher,
  RevocationReason,
  StaffUserFields,
  ThrottleKey,
  TokenService,
  TotpService,
} from './ports.js';

export interface StaffAuthConfig {
  accessTokenTtlSeconds: number;
  refreshIdleTtlSeconds: number;
  refreshAbsoluteTtlSeconds: number;
  lockout: LockoutPolicy;
  mfaIssuer: string;
  /** H-13: límite de la cuenta desde cualquier IP (tope corto: nadie deja fuera a un admin por horas). */
  accountLockout?: LockoutPolicy;
}

/** Usuario autenticado del backoffice (lo adjunta el guard a la petición). */
export interface StaffActor {
  userId: string;
  /** Familia de sesión (id público de la sesión). */
  sessionId: string;
  email: string;
  fullName: string;
  role: StaffRole;
  permissions: ReadonlySet<Permission>;
}

export interface StaffProfile {
  id: string;
  email: string;
  fullName: string;
  role: StaffRole;
  permissions: Permission[];
  mfaEnabled: boolean;
  lastLoginAt: Date | null;
}

export type LoginResult =
  | { status: 'mfa_required'; mfaToken: string; expiresAt: Date }
  | { status: 'mfa_enrollment_required'; enrollmentToken: string; expiresAt: Date }
  /** H-14: contraseña temporal; hay que cambiarla (POST /auth/staff/password/initial) antes de seguir. */
  | { status: 'password_change_required'; passwordChangeToken: string; expiresAt: Date };

export interface SessionTokens {
  tokenType: 'Bearer';
  accessToken: string;
  accessTokenExpiresAt: Date;
  refreshToken: string;
  refreshTokenExpiresAt: Date;
  sessionId: string;
  user: StaffProfile;
}

export interface MfaEnrollment {
  otpauthUri: string;
  /** Secreto base32 para ingreso manual en la app autenticadora. Solo se muestra aquí. */
  secret: string;
  issuer: string;
  label: string;
}

export interface SessionView {
  sessionId: string;
  createdAt: Date;
  lastRotatedAt: Date;
  expiresAt: Date;
  absoluteExpiresAt: Date;
  ip: string | null;
  userAgent: string | null;
  current: boolean;
}

// Errores (códigos estables para el BFF)
export class InvalidCredentialsError extends UnauthorizedError {
  constructor() {
    super('invalid-credentials', 'Correo o contraseña incorrectos.');
  }
}
export class AccountLockedError extends RateLimitedError {
  constructor(retryAfterSeconds: number) {
    // H-13: mismo mensaje y código para correos existentes e inexistentes.
    super('account-locked', 'Demasiados intentos fallidos. Espera antes de volver a intentarlo.', retryAfterSeconds);
  }
}
export class AccountDisabledError extends ForbiddenError {
  constructor() {
    super('account-disabled', 'Tu cuenta está suspendida o deshabilitada. Contacta a un administrador.');
  }
}
export class InvalidMfaCodeError extends UnauthorizedError {
  constructor() {
    super('invalid-mfa-code', 'El código de verificación no es válido o ya fue usado.');
  }
}
export class InvalidRefreshTokenError extends UnauthorizedError {
  constructor(code: 'invalid-refresh-token' | 'refresh-token-expired' | 'refresh-token-reused' = 'invalid-refresh-token') {
    const messages = {
      'invalid-refresh-token': 'La sesión no es válida. Inicia sesión de nuevo.',
      'refresh-token-expired': 'La sesión expiró. Inicia sesión de nuevo.',
      'refresh-token-reused': 'Se detectó la reutilización de un token de sesión: se cerró la sesión por seguridad.',
    };
    super(code, messages[code]);
  }
}
export class SessionRevokedError extends UnauthorizedError {
  constructor() {
    super('session-revoked', 'La sesión fue cerrada. Inicia sesión de nuevo.');
  }
}

const REFRESH_TOKEN = /^[A-Za-z0-9_-]{43}$/;
/** Hash Argon2id de una contraseña aleatoria: iguala el tiempo de respuesta con correos inexistentes. */
const DUMMY_PASSWORD = 'pwt-timing-equalizer-not-a-password';

function hashRefreshToken(token: string): Uint8Array {
  return createHash('sha256').update(token, 'utf8').digest();
}

type Outcome<T> = { ok: true; value: T } | { ok: false; error: Error };

/**
 * Autenticación del staff: contraseña Argon2id + TOTP obligatorio, bloqueo progresivo,
 * access JWT corto y refresh opaco rotativo con detección de reutilización (familias en
 * `auth_sessions`). Los fallos que deben persistir (contador de intentos, revocación por
 * reutilización) se confirman ANTES de lanzar el error (de lo contrario la transacción
 * los revertiría).
 */
export class StaffAuthUseCases {
  private dummyHash: Promise<string> | null = null;

  constructor(
    private readonly store: IdentityStore,
    private readonly clock: Clock,
    private readonly ids: IdGenerator,
    private readonly hasher: PasswordHasher,
    private readonly totp: TotpService,
    private readonly tokens: TokenService,
    private readonly cipher: PiiCipher,
    private readonly config: StaffAuthConfig,
  ) {}

  // ---------------------------------------------------------------------------
  // Paso 1: contraseña
  // ---------------------------------------------------------------------------
  async login(input: { email: string; password: string }, meta: RequestMeta): Promise<LoginResult> {
    let email: string;
    let wellFormed = true;
    try {
      email = normalizeStaffEmail(input.email);
    } catch {
      wellFormed = false;
      email = String(input.email ?? '').trim().toLowerCase().slice(0, 254);
    }
    const now = this.clock.now();
    // H-03/H-13: limitador por cuenta+IP y por cuenta, igual exista o no el correo.
    const keys = this.throttleKeys(email, meta.ip);
    const wait = await this.store.run((r) => r.throttle.retryAfterSeconds(keys, now));
    if (wait > 0) throw new AccountLockedError(wait);
    const user = wellFormed ? await this.store.run((r) => r.users.findByEmail(email)) : null;
    let valid = false;
    if (user) valid = await this.hasher.verify(user.passwordHash, input.password);
    else await this.hasher.verify(await this.getDummyHash(), input.password);

    if (!user || !valid) {
      await this.recordFailure(user, keys, 'LOGIN_FAILED', meta);
      throw new InvalidCredentialsError();
    }
    if (user.status !== 'active') {
      await this.audit({ action: 'LOGIN_REJECTED_DISABLED', user, meta });
      throw new AccountDisabledError();
    }

    await this.store.run(async (r) => {
      // H-04: solo se escribe la columna que cambia (sin pisar estado/rol/secretos).
      if (this.hasher.needsRehash(user.passwordHash)) await r.users.updateFields(user.id, { passwordHash: await this.hasher.hash(input.password) });
      await r.audit.record(this.entry({ action: 'LOGIN_PASSWORD_OK', user, meta, now }));
    });
    return this.nextStep(user, now);
  }

  /**
   * H-14: primer ingreso con contraseña temporal. Cambia la contraseña con el desafío
   * `passwordChangeToken` y devuelve el paso siguiente (MFA o enrolamiento).
   */
  async completeInitialPasswordChange(input: { passwordChangeToken: string; newPassword: string }, meta: RequestMeta): Promise<LoginResult> {
    const now = this.clock.now();
    const claims = this.tokens.verifyChallenge(input.passwordChangeToken, 'pwchange', now);
    const user = await this.store.run((r) => this.loadChallengeUser(r, claims));
    if (!user.mustChangePassword) throw new ConflictError('password-change-not-required', 'La contraseña ya fue cambiada. Inicia sesión.');
    assertPasswordPolicy(input.newPassword, { email: user.email, fullName: user.fullName });
    if (await this.hasher.verify(user.passwordHash, input.newPassword)) {
      throw new ValidationError('password-unchanged', 'La nueva contraseña debe ser distinta de la temporal.');
    }
    const passwordHash = await this.hasher.hash(input.newPassword);
    const updated = await this.store.run(async (r) => {
      const ok = await r.users.updateFields(
        user.id,
        { passwordHash, passwordChangedAt: now, mustChangePassword: false },
        { expectedVersion: user.version, bumpVersion: true },
      );
      if (!ok) throw new UnauthorizedError('invalid-mfa-token', 'El desafío de verificación expiró. Inicia sesión de nuevo.');
      await r.audit.record(this.entry({ action: 'PASSWORD_INITIAL_CHANGED', user, meta, now }));
      return (await r.users.findById(user.id))!;
    });
    return this.nextStep(updated, now);
  }

  // ---------------------------------------------------------------------------
  // Paso 2a: segundo factor (TOTP o código de recuperación)
  // ---------------------------------------------------------------------------
  async verifyMfa(input: { mfaToken: string; code: string }, meta: RequestMeta): Promise<SessionTokens & { recoveryCodesRemaining: number; usedRecoveryCode: boolean }> {
    const now = this.clock.now();
    const claims = this.tokens.verifyChallenge(input.mfaToken, 'mfa', now);
    const outcome = await this.store.run(async (r): Promise<Outcome<{ tokens: SessionTokens; remaining: number; recovery: boolean }>> => {
      const user = await this.loadChallengeUser(r, claims);
      if (!user.mfaEnabledAt || !user.mfaSecretEnc) return { ok: false, error: new UnauthorizedError('invalid-mfa-token', 'Debes enrolar el segundo factor.') };
      const keys = this.throttleKeys(user.email, meta.ip);
      const wait = await r.throttle.retryAfterSeconds(keys, now);
      if (wait > 0) return { ok: false, error: new AccountLockedError(wait) };

      const code = input.code.trim();
      let step: number | null = null;
      let usedRecovery = false;
      if (isTotpFormat(code)) {
        step = await this.totp.verify({ secret: this.decryptMfaSecret(user), code: code.replace(/\s/g, ''), afterTimeStep: user.mfaLastTimeStep, now });
      } else if (isRecoveryCodeFormat(code)) {
        usedRecovery = await r.recoveryCodes.consume(user.id, hashRecoveryCode(code), now);
      }
      if (step === null && !usedRecovery) {
        await this.applyFailure(r, user, keys, 'MFA_FAILED', meta, now);
        return { ok: false, error: new InvalidMfaCodeError() };
      }
      const tokens = await this.completeLogin(r, user, meta, now, usedRecovery ? 'LOGIN_RECOVERY_CODE' : 'LOGIN', step !== null ? { mfaLastTimeStep: step } : {});
      return { ok: true, value: { tokens, remaining: await r.recoveryCodes.countUnused(user.id), recovery: usedRecovery } };
    });
    if (!outcome.ok) throw outcome.error;
    return { ...outcome.value.tokens, recoveryCodesRemaining: outcome.value.remaining, usedRecoveryCode: outcome.value.recovery };
  }

  // ---------------------------------------------------------------------------
  // Paso 2b: enrolamiento obligatorio del TOTP (primer ingreso o tras reinicio de MFA)
  // ---------------------------------------------------------------------------
  async startEnrollment(input: { enrollmentToken: string }, meta: RequestMeta): Promise<MfaEnrollment> {
    const now = this.clock.now();
    const claims = this.tokens.verifyChallenge(input.enrollmentToken, 'enroll', now);
    return this.store.run(async (r) => {
      const user = await this.loadChallengeUser(r, claims);
      if (user.mfaEnabledAt) throw new ConflictError('mfa-already-enrolled', 'El segundo factor ya está activo.');
      const secret = this.totp.generateSecret();
      const ok = await r.users.updateFields(user.id, { mfaSecretEnc: this.encryptMfaSecret(user.id, secret), mfaLastTimeStep: null }, { expectedVersion: user.version });
      if (!ok) throw new UnauthorizedError('invalid-mfa-token', 'El desafío de verificación expiró. Inicia sesión de nuevo.');
      await r.audit.record(this.entry({ action: 'MFA_ENROLL_STARTED', user, meta, now }));
      const label = user.email;
      return { otpauthUri: this.totp.buildUri({ issuer: this.config.mfaIssuer, label, secret }), secret, issuer: this.config.mfaIssuer, label };
    });
  }

  async confirmEnrollment(input: { enrollmentToken: string; code: string }, meta: RequestMeta): Promise<SessionTokens & { recoveryCodes: string[] }> {
    const now = this.clock.now();
    const claims = this.tokens.verifyChallenge(input.enrollmentToken, 'enroll', now);
    const outcome = await this.store.run(async (r): Promise<Outcome<SessionTokens & { recoveryCodes: string[] }>> => {
      const user = await this.loadChallengeUser(r, claims);
      if (user.mfaEnabledAt) return { ok: false, error: new ConflictError('mfa-already-enrolled', 'El segundo factor ya está activo.') };
      if (!user.mfaSecretEnc) return { ok: false, error: new ConflictError('mfa-enrollment-not-started', 'Primero inicia el enrolamiento.') };
      const keys = this.throttleKeys(user.email, meta.ip);
      const wait = await r.throttle.retryAfterSeconds(keys, now);
      if (wait > 0) return { ok: false, error: new AccountLockedError(wait) };
      const code = input.code.replace(/\s/g, '');
      const step = isTotpFormat(code)
        ? await this.totp.verify({ secret: this.decryptMfaSecret(user), code, afterTimeStep: user.mfaLastTimeStep, now })
        : null;
      if (step === null) {
        await this.applyFailure(r, user, keys, 'MFA_ENROLL_FAILED', meta, now);
        return { ok: false, error: new InvalidMfaCodeError() };
      }
      const recoveryCodes = generateRecoveryCodes();
      await r.recoveryCodes.replaceAll(user.id, recoveryCodes.map(hashRecoveryCode), now);
      await r.audit.record(this.entry({ action: 'MFA_ENROLLED', user, meta, now }));
      const tokens = await this.completeLogin(r, user, meta, now, 'LOGIN', { mfaEnabledAt: now, mfaLastTimeStep: step });
      return { ok: true, value: { ...tokens, recoveryCodes } };
    });
    if (!outcome.ok) throw outcome.error;
    return outcome.value;
  }

  // ---------------------------------------------------------------------------
  // Refresh rotativo con detección de reutilización
  // ---------------------------------------------------------------------------
  async refresh(input: { refreshToken: string }, meta: RequestMeta): Promise<SessionTokens> {
    if (!REFRESH_TOKEN.test(input.refreshToken ?? '')) throw new InvalidRefreshTokenError();
    const now = this.clock.now();
    const outcome = await this.store.run(async (r): Promise<Outcome<SessionTokens>> => {
      const session = await r.sessions.findByTokenHashForUpdate(hashRefreshToken(input.refreshToken));
      if (!session) return { ok: false, error: new InvalidRefreshTokenError() };
      if (session.revokedAt) {
        if (session.revokedReason === 'rotated') {
          // Un token ya rotado se presentó otra vez: posible robo. Se revoca toda la familia.
          await r.sessions.revokeFamily(session.familyId, 'reuse_detected', now);
          await r.audit.record({
            actorType: 'user', actorId: session.userId, entityType: 'auth_sessions', entityId: session.familyId,
            action: 'REFRESH_TOKEN_REUSE', after: { familyId: session.familyId }, ip: auditIp(meta.ip), requestId: meta.requestId, occurredAt: now,
          });
          return { ok: false, error: new InvalidRefreshTokenError('refresh-token-reused') };
        }
        return { ok: false, error: new InvalidRefreshTokenError() };
      }
      if (session.expiresAt.getTime() <= now.getTime() || session.absoluteExpiresAt.getTime() <= now.getTime()) {
        return { ok: false, error: new InvalidRefreshTokenError('refresh-token-expired') };
      }
      const user = await r.users.findById(session.userId);
      if (!user || user.deletedAt || user.status !== 'active' || !user.mfaEnabledAt) {
        await r.sessions.revokeFamily(session.familyId, 'user_disabled', now);
        return { ok: false, error: new InvalidRefreshTokenError() };
      }
      const issued = await this.issueRefresh(r, user.id, session.familyId, session.absoluteExpiresAt, meta, now);
      await r.sessions.revoke(session.id, 'rotated', now, issued.record.id);
      return { ok: true, value: this.sessionTokens(user, issued.record, issued.token, now) };
    });
    if (!outcome.ok) throw outcome.error;
    return outcome.value;
  }

  // ---------------------------------------------------------------------------
  // Validación del access token (guard)
  // ---------------------------------------------------------------------------
  async authenticate(accessToken: string | undefined): Promise<StaffActor> {
    if (!accessToken) throw new UnauthorizedError('access-token-required', 'Falta la cabecera Authorization: Bearer <token>.');
    const now = this.clock.now();
    const claims = this.tokens.verifyAccess(accessToken, now);
    return this.store.run(async (r) => {
      const session = await r.sessions.findActiveInFamily(claims.sid, now);
      if (!session || session.userId !== claims.sub) throw new SessionRevokedError();
      const user = await r.users.findById(claims.sub);
      if (!user || user.deletedAt || user.status !== 'active' || !user.mfaEnabledAt) throw new SessionRevokedError();
      // El rol vigente es el de la base (un cambio de rol aplica de inmediato).
      return { userId: user.id, sessionId: claims.sid, email: user.email, fullName: user.fullName, role: user.role, permissions: permissionsFor(user.role) };
    });
  }

  /** Registra un intento de acceso sin permiso (detección de abuso / IDOR). */
  async recordAccessDenied(actor: StaffActor, required: readonly Permission[], target: string, meta: RequestMeta): Promise<void> {
    const now = this.clock.now();
    await this.store.run((r) => r.audit.record(this.actorEntry(actor, 'ACCESS_DENIED', meta, now, { required: [...required], target: target.slice(0, 200) })));
  }

  // ---------------------------------------------------------------------------
  // Sesiones
  // ---------------------------------------------------------------------------
  async logout(actor: StaffActor, meta: RequestMeta): Promise<void> {
    const now = this.clock.now();
    await this.store.run(async (r) => {
      await r.sessions.revokeFamily(actor.sessionId, 'logout', now);
      await r.audit.record(this.actorEntry(actor, 'LOGOUT', meta, now, { sessionId: actor.sessionId }));
    });
  }

  async logoutAll(actor: StaffActor, meta: RequestMeta): Promise<{ revokedSessions: number }> {
    const now = this.clock.now();
    return this.store.run(async (r) => {
      const families = await r.sessions.listActiveForUser(actor.userId, now);
      await r.sessions.revokeAllForUser(actor.userId, 'logout_all', now);
      await r.audit.record(this.actorEntry(actor, 'LOGOUT_ALL', meta, now, { sessions: families.length }));
      return { revokedSessions: families.length };
    });
  }

  listSessions(actor: StaffActor): Promise<SessionView[]> {
    const now = this.clock.now();
    return this.store.run(async (r) => {
      const active = await r.sessions.listActiveForUser(actor.userId, now);
      return active.map((s) => ({
        sessionId: s.familyId,
        createdAt: s.createdAt,
        lastRotatedAt: s.createdAt,
        expiresAt: s.expiresAt,
        absoluteExpiresAt: s.absoluteExpiresAt,
        ip: s.ip,
        userAgent: s.userAgent,
        current: s.familyId === actor.sessionId,
      }));
    });
  }

  /** Cierra una sesión propia. 404 si la sesión no existe o es de otro usuario (anti-IDOR). */
  async revokeSession(actor: StaffActor, sessionId: string, meta: RequestMeta): Promise<void> {
    const now = this.clock.now();
    await this.store.run(async (r) => {
      const session = await r.sessions.findActiveInFamily(sessionId, now);
      if (!session || session.userId !== actor.userId) throw new NotFoundError('session-not-found', 'Sesión no encontrada.');
      await r.sessions.revokeFamily(sessionId, 'logout', now);
      await r.audit.record(this.actorEntry(actor, 'SESSION_REVOKED', meta, now, { sessionId }));
    });
  }

  me(actor: StaffActor): Promise<StaffProfile> {
    return this.store.run(async (r) => {
      const user = await r.users.findById(actor.userId);
      if (!user) throw new SessionRevokedError();
      return toProfile(user);
    });
  }

  /** Regenera los códigos de recuperación (exige un TOTP vigente; H-12: respeta el limitador). */
  async regenerateRecoveryCodes(actor: StaffActor, code: string, meta: RequestMeta): Promise<{ recoveryCodes: string[] }> {
    const now = this.clock.now();
    const keys = this.throttleKeys(actor.email, meta.ip);
    const outcome = await this.store.run(async (r): Promise<Outcome<string[]>> => {
      const wait = await r.throttle.retryAfterSeconds(keys, now);
      if (wait > 0) return { ok: false, error: new AccountLockedError(wait) };
      const user = await r.users.findById(actor.userId);
      if (!user?.mfaSecretEnc) return { ok: false, error: new SessionRevokedError() };
      const step = isTotpFormat(code)
        ? await this.totp.verify({ secret: this.decryptMfaSecret(user), code: code.replace(/\s/g, ''), afterTimeStep: user.mfaLastTimeStep, now })
        : null;
      if (step === null) {
        const blocked = await this.applyFailure(r, user, keys, 'MFA_FAILED', meta, now);
        // Con un token de acceso posiblemente robado: al bloquearse se cierra la sesión.
        if (blocked > 0) await r.sessions.revokeFamily(actor.sessionId, 'logout', now);
        return { ok: false, error: new InvalidMfaCodeError() };
      }
      await r.users.updateFields(user.id, { mfaLastTimeStep: step });
      await r.throttle.reset(keys);
      const codes = generateRecoveryCodes();
      await r.recoveryCodes.replaceAll(user.id, codes.map(hashRecoveryCode), now);
      await r.audit.record(this.actorEntry(actor, 'MFA_RECOVERY_CODES_REGENERATED', meta, now));
      return { ok: true, value: codes };
    });
    if (!outcome.ok) throw outcome.error;
    return { recoveryCodes: outcome.value };
  }

  /** Cambio de contraseña: exige la actual (H-12: respeta el limitador); cierra las demás sesiones. */
  async changePassword(actor: StaffActor, input: { currentPassword: string; newPassword: string }, meta: RequestMeta): Promise<void> {
    const now = this.clock.now();
    const keys = this.throttleKeys(actor.email, meta.ip);
    const wait = await this.store.run((r) => r.throttle.retryAfterSeconds(keys, now));
    if (wait > 0) throw new AccountLockedError(wait);
    const user = await this.store.run((r) => r.users.findById(actor.userId));
    if (!user) throw new SessionRevokedError();
    if (!(await this.hasher.verify(user.passwordHash, input.currentPassword))) {
      const blocked = await this.recordFailure(user, keys, 'PASSWORD_CHANGE_FAILED', meta);
      if (blocked > 0) await this.store.run((r) => r.sessions.revokeFamily(actor.sessionId, 'logout', now));
      throw new InvalidCredentialsError();
    }
    assertPasswordPolicy(input.newPassword, { email: user.email, fullName: user.fullName });
    if (input.newPassword === input.currentPassword) {
      throw new ValidationError('password-unchanged', 'La nueva contraseña debe ser distinta de la actual.');
    }
    const newHash = await this.hasher.hash(input.newPassword);
    await this.store.run(async (r) => {
      const ok = await r.users.updateFields(
        user.id,
        { passwordHash: newHash, passwordChangedAt: now, mustChangePassword: false },
        { expectedVersion: user.version, bumpVersion: true },
      );
      if (!ok) throw new ConcurrencyError('Tu cuenta cambió mientras tanto. Vuelve a intentarlo.');
      await r.throttle.reset(keys);
      const sessions = await r.sessions.listActiveForUser(user.id, now);
      for (const s of sessions) if (s.familyId !== actor.sessionId) await r.sessions.revokeFamily(s.familyId, 'password_changed', now);
      await r.audit.record(this.actorEntry(actor, 'PASSWORD_CHANGED', meta, now));
    });
  }

  // ---------------------------------------------------------------------------
  // Internos
  // ---------------------------------------------------------------------------
  private async loadChallengeUser(r: IdentityRepositories, claims: { sub: string; ver: number }): Promise<StaffUser> {
    const user = await r.users.findById(claims.sub);
    // `ver` cambia con cada login completo, cambio de contraseña o reinicio de MFA: el
    // token de desafío queda inservible después de usarse o si cambió la credencial.
    if (!user || user.deletedAt || user.version !== claims.ver) throw new UnauthorizedError('invalid-mfa-token', 'El desafío de verificación expiró. Inicia sesión de nuevo.');
    if (user.status !== 'active') throw new AccountDisabledError();
    return user;
  }

  private async completeLogin(
    r: IdentityRepositories,
    user: StaffUser,
    meta: RequestMeta,
    now: Date,
    action: string,
    extra: StaffUserFields = {},
  ): Promise<SessionTokens> {
    // H-04: escritura condicionada a la versión del desafío; `bumpVersion` invalida el desafío usado.
    const fields: StaffUserFields = { failedLoginCount: 0, lockedUntil: null, lastLoginAt: now, ...extra };
    const ok = await r.users.updateFields(user.id, fields, { expectedVersion: user.version, bumpVersion: true });
    if (!ok) throw new UnauthorizedError('invalid-mfa-token', 'El desafío de verificación expiró. Inicia sesión de nuevo.');
    await r.throttle.reset(this.throttleKeys(user.email, meta.ip));
    const updated: StaffUser = { ...user, ...fields, version: user.version + 1 };
    const absolute = new Date(now.getTime() + this.config.refreshAbsoluteTtlSeconds * 1000);
    const issued = await this.issueRefresh(r, user.id, this.ids.next(), absolute, meta, now);
    await r.audit.record(this.entry({ action, user, meta, now, after: { sessionId: issued.record.familyId } }));
    return this.sessionTokens(updated, issued.record, issued.token, now);
  }

  /** Paso siguiente tras validar la contraseña (o tras cambiar la temporal). */
  private nextStep(user: StaffUser, now: Date): LoginResult {
    if (user.mustChangePassword) {
      const challenge = this.tokens.signChallenge({ sub: user.id, kind: 'pwchange', ver: user.version }, now);
      return { status: 'password_change_required', passwordChangeToken: challenge.token, expiresAt: challenge.expiresAt };
    }
    if (!user.mfaEnabledAt) {
      const challenge = this.tokens.signChallenge({ sub: user.id, kind: 'enroll', ver: user.version }, now);
      return { status: 'mfa_enrollment_required', enrollmentToken: challenge.token, expiresAt: challenge.expiresAt };
    }
    const challenge = this.tokens.signChallenge({ sub: user.id, kind: 'mfa', ver: user.version }, now);
    return { status: 'mfa_required', mfaToken: challenge.token, expiresAt: challenge.expiresAt };
  }

  /** Claves del limitador: par cuenta+IP (backoff largo) y cuenta (tope corto). */
  private throttleKeys(email: string, ip: string | null): ThrottleKey[] {
    const accountKey = createHash('sha256').update(`acct:${email}`).digest('hex');
    const pairKey = createHash('sha256').update(`pair:${email}|${ip ?? '-'}`).digest('hex');
    return [
      { key: pairKey, accountKey, policy: this.config.lockout },
      { key: accountKey, accountKey, policy: this.config.accountLockout ?? { threshold: 20, baseSeconds: 60, maxSeconds: 900 } },
    ];
  }

  /** Cifrado del secreto TOTP ligado al usuario (AAD, H-19); lee también el formato anterior. */
  private encryptMfaSecret(userId: string, secret: string): Uint8Array {
    return this.cipher.encrypt(secret, `users:mfa_secret_enc:${userId}`);
  }

  private decryptMfaSecret(user: StaffUser): string {
    return this.cipher.decrypt(user.mfaSecretEnc!, `users:mfa_secret_enc:${user.id}`);
  }

  private async issueRefresh(
    r: IdentityRepositories,
    userId: string,
    familyId: string,
    absoluteExpiresAt: Date,
    meta: RequestMeta,
    now: Date,
  ): Promise<{ token: string; record: AuthSessionRecord }> {
    const token = randomBytes(32).toString('base64url');
    const idle = new Date(now.getTime() + this.config.refreshIdleTtlSeconds * 1000);
    const record: AuthSessionRecord = {
      id: this.ids.next(),
      userId,
      familyId,
      tokenHash: hashRefreshToken(token),
      replacedById: null,
      ip: auditIp(meta.ip),
      userAgent: meta.userAgent?.slice(0, 400) ?? null,
      expiresAt: idle.getTime() < absoluteExpiresAt.getTime() ? idle : absoluteExpiresAt,
      absoluteExpiresAt,
      revokedAt: null,
      revokedReason: null,
      createdAt: now,
    };
    await r.sessions.insert(record);
    return { token, record };
  }

  private sessionTokens(user: StaffUser, session: AuthSessionRecord, refreshToken: string, now: Date): SessionTokens {
    const access = this.tokens.signAccess({ sub: user.id, sid: session.familyId, role: user.role }, now);
    return {
      tokenType: 'Bearer',
      accessToken: access.token,
      accessTokenExpiresAt: access.expiresAt,
      refreshToken,
      refreshTokenExpiresAt: session.expiresAt,
      sessionId: session.familyId,
      user: toProfile(user),
    };
  }

  /**
   * Suma un fallo y lo CONFIRMA (transacción propia) antes de que el llamador lance el error.
   * Devuelve los segundos de bloqueo resultantes (0 si aún no se bloquea).
   */
  private async recordFailure(user: StaffUser | null, keys: ThrottleKey[], action: string, meta: RequestMeta): Promise<number> {
    const now = this.clock.now();
    return this.store.run(async (r) => {
      if (user) return this.applyFailure(r, user, keys, action, meta, now);
      // Correo inexistente: mismo contador y misma respuesta (H-13), sin fila en users.
      return r.throttle.registerFailure(keys, now);
    });
  }

  /** H-03: contadores atómicos en SQL (limitador + users.failed_login_count). */
  private async applyFailure(r: IdentityRepositories, user: StaffUser, keys: ThrottleKey[], action: string, meta: RequestMeta, now: Date): Promise<number> {
    const wait = await r.throttle.registerFailure(keys, now);
    await r.users.incrementFailedLogins(user.id, now);
    await r.audit.record(this.entry({ action, user, meta, now, after: { blockedSeconds: wait } }));
    if (wait > 0) await r.audit.record(this.entry({ action: 'ACCOUNT_LOCKED', user, meta, now, after: { retryAfterSeconds: wait } }));
    return wait;
  }

  private async audit(params: { action: string; user: StaffUser; meta: RequestMeta }): Promise<void> {
    const now = this.clock.now();
    await this.store.run((r) => r.audit.record(this.entry({ ...params, now })));
  }

  private entry(params: { action: string; user: StaffUser; meta: RequestMeta; now: Date; after?: Record<string, unknown> }): AuditEntry {
    return {
      actorType: 'user',
      actorId: params.user.id,
      entityType: 'users',
      entityId: params.user.id,
      action: params.action,
      after: params.after ?? null,
      ip: auditIp(params.meta.ip),
      requestId: params.meta.requestId,
      occurredAt: params.now,
    };
  }

  private actorEntry(actor: StaffActor, action: string, meta: RequestMeta, now: Date, after?: Record<string, unknown>): AuditEntry {
    return {
      actorType: 'user',
      actorId: actor.userId,
      entityType: 'users',
      entityId: actor.userId,
      action,
      after: after ?? null,
      ip: auditIp(meta.ip),
      requestId: meta.requestId,
      occurredAt: now,
    };
  }

  private getDummyHash(): Promise<string> {
    this.dummyHash ??= this.hasher.hash(DUMMY_PASSWORD);
    return this.dummyHash;
  }
}

export function toProfile(user: StaffUser): StaffProfile {
  return {
    id: user.id,
    email: user.email,
    fullName: user.fullName,
    role: user.role,
    permissions: [...permissionsFor(user.role)],
    mfaEnabled: user.mfaEnabledAt !== null,
    lastLoginAt: user.lastLoginAt,
  };
}

export type { RevocationReason };
