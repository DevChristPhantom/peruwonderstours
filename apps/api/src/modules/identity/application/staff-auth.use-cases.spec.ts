import { generate } from 'otplib';
import { DomainError } from '../../../shared/domain/domain-error.js';
import { AesGcmPiiCipher, DEVELOPMENT_PII_KEY_BASE64 } from '../../../shared/infrastructure/aes-gcm-pii-cipher.js';
import { FixedClock, UuidV7Generator } from '../../../shared/infrastructure/system.js';
import { InMemoryIdentityStore } from '../infrastructure/identity-stores.js';
import { JwtTokenService, OtplibTotpService } from '../infrastructure/security-adapters.js';
import type { PasswordHasher } from './ports.js';
import { StaffAuthUseCases, type SessionTokens } from './staff-auth.use-cases.js';
import { StaffUsersUseCases } from './staff-users.use-cases.js';

const META = { ip: '127.0.0.1', userAgent: 'vitest', requestId: 'req-1' };
const PASSWORD = 'Lago-Titicaca#Uros-77';

/** Hasher rápido para pruebas unitarias (Argon2id real se prueba en security-adapters.spec). */
const fakeHasher: PasswordHasher = {
  hash: (p) => Promise.resolve(`h:${p}`),
  verify: (h, p) => Promise.resolve(h === `h:${p}`),
  needsRehash: () => false,
};

async function codeAt(secret: string, clock: FixedClock, offsetSeconds = 0): Promise<string> {
  return generate({ secret, epoch: Math.floor(clock.now().getTime() / 1000) + offsetSeconds });
}

async function expectCode(promise: Promise<unknown>, code: string): Promise<DomainError> {
  try {
    await promise;
  } catch (error) {
    expect(error).toBeInstanceOf(DomainError);
    expect((error as DomainError).code).toBe(code);
    return error as DomainError;
  }
  throw new Error(`Se esperaba el error ${code}`);
}

function setup() {
  const clock = new FixedClock(new Date('2026-10-08T15:00:00Z'));
  const store = new InMemoryIdentityStore();
  const ids = new UuidV7Generator();
  const cipher = AesGcmPiiCipher.fromBase64(DEVELOPMENT_PII_KEY_BASE64);
  const tokens = new JwtTokenService('unit-test-secret-0123456789-abcdefghij', 'pwt-test', 600);
  const auth = new StaffAuthUseCases(store, clock, ids, fakeHasher, new OtplibTotpService(), tokens, cipher, {
    accessTokenTtlSeconds: 600,
    refreshIdleTtlSeconds: 12 * 3600,
    refreshAbsoluteTtlSeconds: 72 * 3600,
    lockout: { threshold: 5, baseSeconds: 60, maxSeconds: 3600 },
    mfaIssuer: 'Peru Wonders Tours',
  });
  const users = new StaffUsersUseCases(store, clock, ids, fakeHasher);
  return { clock, store, auth, users };
}

/** Alta + enrolamiento completo; devuelve el secreto TOTP y la primera sesión. */
async function enrolledUser(ctx: ReturnType<typeof setup>, email = 'ana@pwt.pe', role: 'admin' | 'operator' | 'agent' = 'operator') {
  const { user } = await ctx.users.create({ email, fullName: 'Ana Quispe', role, password: PASSWORD }, null, META);
  const login = await ctx.auth.login({ email, password: PASSWORD }, META);
  if (login.status !== 'mfa_enrollment_required') throw new Error('se esperaba enrolamiento');
  const enrollment = await ctx.auth.startEnrollment({ enrollmentToken: login.enrollmentToken }, META);
  const session = await ctx.auth.confirmEnrollment({ enrollmentToken: login.enrollmentToken, code: await codeAt(enrollment.secret, ctx.clock) }, META);
  return { user, secret: enrollment.secret, session, recoveryCodes: session.recoveryCodes };
}

async function loginWithTotp(ctx: ReturnType<typeof setup>, email: string, secret: string): Promise<SessionTokens> {
  ctx.clock.advanceMinutes(1); // nuevo paso TOTP (anti-replay)
  const login = await ctx.auth.login({ email, password: PASSWORD }, META);
  if (login.status !== 'mfa_required') throw new Error('se esperaba MFA');
  return ctx.auth.verifyMfa({ mfaToken: login.mfaToken, code: await codeAt(secret, ctx.clock) }, META);
}

describe('StaffAuthUseCases: login, MFA y bloqueo', () => {
  it('correo inexistente y contraseña incorrecta dan el mismo error genérico', async () => {
    const ctx = setup();
    await ctx.users.create({ email: 'ana@pwt.pe', fullName: 'Ana Quispe', role: 'agent', password: PASSWORD }, null, META);
    await expectCode(ctx.auth.login({ email: 'nadie@pwt.pe', password: PASSWORD }, META), 'invalid-credentials');
    await expectCode(ctx.auth.login({ email: 'ana@pwt.pe', password: 'otra-clave-123456' }, META), 'invalid-credentials');
    await expectCode(ctx.auth.login({ email: 'no-es-correo', password: 'x' }, META), 'invalid-credentials');
  });

  it('primer ingreso exige enrolar TOTP; el QR usa otpauth:// y se entregan 10 códigos de recuperación', async () => {
    const ctx = setup();
    await ctx.users.create({ email: 'ana@pwt.pe', fullName: 'Ana Quispe', role: 'operator', password: PASSWORD }, null, META);
    const login = await ctx.auth.login({ email: 'ANA@pwt.pe ', password: PASSWORD }, META);
    expect(login.status).toBe('mfa_enrollment_required');
    if (login.status !== 'mfa_enrollment_required') return;
    const enrollment = await ctx.auth.startEnrollment({ enrollmentToken: login.enrollmentToken }, META);
    expect(enrollment.otpauthUri).toMatch(/^otpauth:\/\/totp\/Peru%20Wonders%20Tours:ana%40pwt\.pe\?/);
    await expectCode(ctx.auth.confirmEnrollment({ enrollmentToken: login.enrollmentToken, code: '000000' }, META), 'invalid-mfa-code');
    const session = await ctx.auth.confirmEnrollment({ enrollmentToken: login.enrollmentToken, code: await codeAt(enrollment.secret, ctx.clock) }, META);
    expect(session.recoveryCodes).toHaveLength(10);
    expect(session.user).toMatchObject({ email: 'ana@pwt.pe', role: 'operator', mfaEnabled: true });
    expect(session.user.permissions).toContain('pricing:write');
    // El token de enrolamiento ya no sirve (cambió la versión del usuario).
    await expectCode(ctx.auth.startEnrollment({ enrollmentToken: login.enrollmentToken }, META), 'invalid-mfa-token');
    // El secreto MFA queda cifrado (no en claro).
    const stored = [...ctx.store.state.users.values()][0]!;
    expect(Buffer.from(stored.mfaSecretEnc!).toString('utf8')).not.toContain(enrollment.secret);
  });

  it('TOTP válido inicia sesión; el mismo código no se acepta dos veces (anti-replay)', async () => {
    const ctx = setup();
    const { secret } = await enrolledUser(ctx);
    ctx.clock.advanceMinutes(1);
    const code = await codeAt(secret, ctx.clock);
    const first = await ctx.auth.login({ email: 'ana@pwt.pe', password: PASSWORD }, META);
    if (first.status !== 'mfa_required') throw new Error('mfa');
    await ctx.auth.verifyMfa({ mfaToken: first.mfaToken, code }, META);
    const second = await ctx.auth.login({ email: 'ana@pwt.pe', password: PASSWORD }, META);
    if (second.status !== 'mfa_required') throw new Error('mfa');
    await expectCode(ctx.auth.verifyMfa({ mfaToken: second.mfaToken, code }, META), 'invalid-mfa-code');
  });

  it('un mfaToken ya usado no sirve otra vez aunque el código sea nuevo', async () => {
    const ctx = setup();
    const { secret } = await enrolledUser(ctx);
    ctx.clock.advanceMinutes(1);
    const login = await ctx.auth.login({ email: 'ana@pwt.pe', password: PASSWORD }, META);
    if (login.status !== 'mfa_required') throw new Error('mfa');
    await ctx.auth.verifyMfa({ mfaToken: login.mfaToken, code: await codeAt(secret, ctx.clock) }, META);
    ctx.clock.advanceMinutes(1);
    await expectCode(ctx.auth.verifyMfa({ mfaToken: login.mfaToken, code: await codeAt(secret, ctx.clock) }, META), 'invalid-mfa-token');
  });

  it('código de recuperación: sirve una sola vez', async () => {
    const ctx = setup();
    const { recoveryCodes } = await enrolledUser(ctx);
    const login = await ctx.auth.login({ email: 'ana@pwt.pe', password: PASSWORD }, META);
    if (login.status !== 'mfa_required') throw new Error('mfa');
    const session = await ctx.auth.verifyMfa({ mfaToken: login.mfaToken, code: recoveryCodes[0]!.toLowerCase() }, META);
    expect(session).toMatchObject({ usedRecoveryCode: true, recoveryCodesRemaining: 9 });
    const again = await ctx.auth.login({ email: 'ana@pwt.pe', password: PASSWORD }, META);
    if (again.status !== 'mfa_required') throw new Error('mfa');
    await expectCode(ctx.auth.verifyMfa({ mfaToken: again.mfaToken, code: recoveryCodes[0]! }, META), 'invalid-mfa-code');
  });

  it('bloqueo progresivo por contraseña: 429 con Retry-After y desbloqueo al vencer', async () => {
    const ctx = setup();
    await enrolledUser(ctx);
    for (let i = 0; i < 5; i += 1) await expectCode(ctx.auth.login({ email: 'ana@pwt.pe', password: 'mala-clave-0000' }, META), 'invalid-credentials');
    const locked = await expectCode(ctx.auth.login({ email: 'ana@pwt.pe', password: PASSWORD }, META), 'account-locked');
    expect(locked.details['retryAfterSeconds']).toBe(60);
    expect(ctx.store.audit.entries.some((e) => e.action === 'ACCOUNT_LOCKED')).toBe(true);
    ctx.clock.advanceMinutes(2);
    const ok = await ctx.auth.login({ email: 'ana@pwt.pe', password: PASSWORD }, META);
    expect(ok.status).toBe('mfa_required');
  });

  it('los fallos del segundo factor también bloquean', async () => {
    const ctx = setup();
    await enrolledUser(ctx);
    const login = await ctx.auth.login({ email: 'ana@pwt.pe', password: PASSWORD }, META);
    if (login.status !== 'mfa_required') throw new Error('mfa');
    for (let i = 0; i < 5; i += 1) await expectCode(ctx.auth.verifyMfa({ mfaToken: login.mfaToken, code: '123456' }, META), 'invalid-mfa-code');
    await expectCode(ctx.auth.verifyMfa({ mfaToken: login.mfaToken, code: '123456' }, META), 'account-locked');
  });

  it('cuenta suspendida: contraseña correcta pero 403 account-disabled', async () => {
    const ctx = setup();
    const admin = await enrolledUser(ctx, 'admin@pwt.pe', 'admin');
    const agent = await enrolledUser(ctx, 'agente@pwt.pe', 'agent');
    const adminActor = await ctx.auth.authenticate(admin.session.accessToken);
    await ctx.users.update(adminActor, agent.user.id, { version: (await ctx.users.get(agent.user.id)).version, status: 'suspended' }, META);
    await expectCode(ctx.auth.login({ email: 'agente@pwt.pe', password: PASSWORD }, META), 'account-disabled');
    await expectCode(ctx.auth.authenticate(agent.session.accessToken), 'session-revoked');
  });
});

describe('StaffAuthUseCases: sesiones y refresh rotativo', () => {
  it('rota el refresh; reusar uno ya rotado revoca TODA la familia', async () => {
    const ctx = setup();
    const { session } = await enrolledUser(ctx);
    const rotated = await ctx.auth.refresh({ refreshToken: session.refreshToken }, META);
    expect(rotated.refreshToken).not.toBe(session.refreshToken);
    expect(rotated.sessionId).toBe(session.sessionId);
    await expect(ctx.auth.authenticate(rotated.accessToken)).resolves.toMatchObject({ email: 'ana@pwt.pe' });

    await expectCode(ctx.auth.refresh({ refreshToken: session.refreshToken }, META), 'refresh-token-reused');
    await expectCode(ctx.auth.refresh({ refreshToken: rotated.refreshToken }, META), 'invalid-refresh-token');
    await expectCode(ctx.auth.authenticate(rotated.accessToken), 'session-revoked');
    expect(ctx.store.audit.entries.some((e) => e.action === 'REFRESH_TOKEN_REUSE')).toBe(true);
  });

  it('refresh vencido por inactividad y por vida absoluta', async () => {
    const ctx = setup();
    const { session } = await enrolledUser(ctx);
    ctx.clock.advanceMinutes(13 * 60);
    await expectCode(ctx.auth.refresh({ refreshToken: session.refreshToken }, META), 'refresh-token-expired');

    const ctx2 = setup();
    const s2 = await enrolledUser(ctx2);
    let token = s2.session.refreshToken;
    for (let i = 0; i < 6; i += 1) {
      ctx2.clock.advanceMinutes(11 * 60);
      token = (await ctx2.auth.refresh({ refreshToken: token }, META)).refreshToken;
    }
    ctx2.clock.advanceMinutes(11 * 60); // 77 h > 72 h absolutas (aunque se rotó cada 11 h)
    await expectCode(ctx2.auth.refresh({ refreshToken: token }, META), 'refresh-token-expired');
  });

  it('access token: expira a los 10 min y rechaza manipulación', async () => {
    const ctx = setup();
    const { session } = await enrolledUser(ctx);
    await expectCode(ctx.auth.authenticate(undefined), 'access-token-required');
    await expectCode(ctx.auth.authenticate(`${session.accessToken.slice(0, -2)}xx`), 'invalid-access-token');
    ctx.clock.advanceMinutes(11);
    await expectCode(ctx.auth.authenticate(session.accessToken), 'access-token-expired');
  });

  it('logout cierra la sesión actual; logout-all cierra todas', async () => {
    const ctx = setup();
    const { session, secret } = await enrolledUser(ctx);
    const second = await loginWithTotp(ctx, 'ana@pwt.pe', secret);
    const actor = await ctx.auth.authenticate(session.accessToken);
    expect(await ctx.auth.listSessions(actor)).toHaveLength(2);
    await ctx.auth.logout(actor, META);
    await expectCode(ctx.auth.authenticate(session.accessToken), 'session-revoked');
    await expectCode(ctx.auth.refresh({ refreshToken: session.refreshToken }, META), 'invalid-refresh-token');
    const actor2 = await ctx.auth.authenticate(second.accessToken);
    await expect(ctx.auth.logoutAll(actor2, META)).resolves.toEqual({ revokedSessions: 1 });
    await expectCode(ctx.auth.authenticate(second.accessToken), 'session-revoked');
  });

  it('no se puede cerrar la sesión de otro usuario (IDOR => 404)', async () => {
    const ctx = setup();
    const a = await enrolledUser(ctx, 'a@pwt.pe');
    const b = await enrolledUser(ctx, 'b@pwt.pe');
    const actorA = await ctx.auth.authenticate(a.session.accessToken);
    await expectCode(ctx.auth.revokeSession(actorA, b.session.sessionId, META), 'session-not-found');
    await expect(ctx.auth.authenticate(b.session.accessToken)).resolves.toBeTruthy();
  });

  it('el rol vigente es el de la base: un cambio de rol aplica sin re-login', async () => {
    const ctx = setup();
    const admin = await enrolledUser(ctx, 'admin@pwt.pe', 'admin');
    const op = await enrolledUser(ctx, 'op@pwt.pe', 'operator');
    const adminActor = await ctx.auth.authenticate(admin.session.accessToken);
    await ctx.users.update(adminActor, op.user.id, { version: (await ctx.users.get(op.user.id)).version, role: 'agent' }, META);
    const opActor = await ctx.auth.authenticate(op.session.accessToken);
    expect(opActor.role).toBe('agent');
    expect(opActor.permissions.has('pricing:write')).toBe(false);
  });

  it('no se puede quitar el último admin ni modificar el propio acceso', async () => {
    const ctx = setup();
    const admin = await enrolledUser(ctx, 'admin@pwt.pe', 'admin');
    const actor = await ctx.auth.authenticate(admin.session.accessToken);
    await expectCode(ctx.users.update(actor, admin.user.id, { version: (await ctx.users.get(admin.user.id)).version, role: 'agent' }, META), 'cannot-modify-own-access');
  });

  it('cambio de contraseña: exige la actual y cierra las otras sesiones', async () => {
    const ctx = setup();
    const { session, secret } = await enrolledUser(ctx);
    const other = await loginWithTotp(ctx, 'ana@pwt.pe', secret);
    const actor = await ctx.auth.authenticate(session.accessToken);
    await expectCode(ctx.auth.changePassword(actor, { currentPassword: 'equivocada-123456', newPassword: 'Nueva-Clave#Segura-2027' }, META), 'invalid-credentials');
    await expectCode(ctx.auth.changePassword(actor, { currentPassword: PASSWORD, newPassword: 'corta' }, META), 'weak-password');
    await ctx.auth.changePassword(actor, { currentPassword: PASSWORD, newPassword: 'Nueva-Clave#Segura-2027' }, META);
    await expect(ctx.auth.authenticate(session.accessToken)).resolves.toBeTruthy();
    await expectCode(ctx.auth.authenticate(other.accessToken), 'session-revoked');
  });

  it('reinicio de MFA por un admin: el usuario debe re-enrolar', async () => {
    const ctx = setup();
    const admin = await enrolledUser(ctx, 'admin@pwt.pe', 'admin');
    const op = await enrolledUser(ctx, 'op@pwt.pe', 'operator');
    const adminActor = await ctx.auth.authenticate(admin.session.accessToken);
    await ctx.users.resetMfa(adminActor, op.user.id, META);
    await expectCode(ctx.auth.authenticate(op.session.accessToken), 'session-revoked');
    const login = await ctx.auth.login({ email: 'op@pwt.pe', password: PASSWORD }, META);
    expect(login.status).toBe('mfa_enrollment_required');
  });

  it('regenera códigos de recuperación con un TOTP vigente', async () => {
    const ctx = setup();
    const { session, secret, recoveryCodes } = await enrolledUser(ctx);
    const actor = await ctx.auth.authenticate(session.accessToken);
    ctx.clock.advanceMinutes(1);
    const { recoveryCodes: fresh } = await ctx.auth.regenerateRecoveryCodes(actor, await codeAt(secret, ctx.clock), META);
    expect(fresh).toHaveLength(10);
    const login = await ctx.auth.login({ email: 'ana@pwt.pe', password: PASSWORD }, META);
    if (login.status !== 'mfa_required') throw new Error('mfa');
    await expectCode(ctx.auth.verifyMfa({ mfaToken: login.mfaToken, code: recoveryCodes[1]! }, META), 'invalid-mfa-code');
  });
});
