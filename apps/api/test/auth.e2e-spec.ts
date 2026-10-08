import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { generate } from 'otplib';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import type { StaffUsersUseCases as StaffUsersType } from '../src/modules/identity/application/staff-users.use-cases.js';

const PASSWORD = 'Lago-Titicaca#Uros-77';
const META = { ip: '127.0.0.1', userAgent: 'e2e', requestId: null };

/**
 * Auth del staff por HTTP en modo memoria (sin PostgreSQL): login, enrolamiento TOTP, MFA,
 * refresh rotativo con detección de reutilización, logout y RBAC. El backoffice responde 503
 * en este modo (requiere base de datos), pero la autenticación y los permisos se evalúan antes.
 */
describe('Auth del staff (e2e, modo memoria)', () => {
  let app: INestApplication<App>;
  let http: ReturnType<typeof request>;
  let users: StaffUsersType;

  beforeAll(async () => {
    Object.assign(process.env, {
      NODE_ENV: 'test',
      DATA_SOURCE: 'memory',
      SANDBOX_WEBHOOK_SECRET: 'e2e-only-webhook-secret-0123456789',
      THROTTLE_STRICT_LIMIT: '1000',
      THROTTLE_LIMIT: '5000',
      JWT_ACCESS_SECRET: 'e2e-only-jwt-secret-0123456789-abcdefghijkl',
      OUTBOX_RELAY_ENABLED: 'false',
      MAIL_TRANSPORT: 'memory',
      LOGIN_LOCK_THRESHOLD: '3',
    });
    const { AppModule } = await import('../src/app.module.js');
    const { configureApp } = await import('../src/app.setup.js');
    const { StaffUsersUseCases } = await import('../src/modules/identity/application/staff-users.use-cases.js');
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication({ rawBody: true });
    configureApp(app);
    await app.init();
    http = request(app.getHttpServer());
    users = app.get(StaffUsersUseCases);
    await users.create({ email: 'admin@pwt.test', fullName: 'Admin Uno', role: 'admin', password: PASSWORD }, null, META);
    await users.create({ email: 'agente@pwt.test', fullName: 'Agente Dos', role: 'agent', password: PASSWORD }, null, META);
    await users.create({ email: 'bloqueo@pwt.test', fullName: 'Usuario Bloqueo', role: 'agent', password: PASSWORD }, null, META);
  });

  afterAll(async () => {
    await app?.close();
  });

  const totp = (secret: string, offset = 0) => generate({ secret, epoch: Math.floor(Date.now() / 1000) + offset });

  async function enroll(email: string) {
    const login = await http.post('/api/v1/auth/staff/login').send({ email, password: PASSWORD }).expect(200);
    expect(login.headers['cache-control']).toBe('no-store');
    expect(login.body.data.status).toBe('mfa_enrollment_required');
    expect(login.body.data).not.toHaveProperty('accessToken');
    const enrollmentToken = login.body.data.enrollmentToken as string;
    const start = await http.post('/api/v1/auth/staff/mfa/enrollment').send({ enrollmentToken }).expect(200);
    expect(start.body.data.otpauthUri).toMatch(/^otpauth:\/\/totp\//);
    const secret = start.body.data.secret as string;
    const confirm = await http.post('/api/v1/auth/staff/mfa/enrollment/confirm').send({ enrollmentToken, code: await totp(secret) }).expect(200);
    expect(confirm.body.data.recoveryCodes).toHaveLength(10);
    return { secret, session: confirm.body.data as { accessToken: string; refreshToken: string; sessionId: string; recoveryCodes: string[] } };
  }

  let admin: Awaited<ReturnType<typeof enroll>>;
  let agent: Awaited<ReturnType<typeof enroll>>;

  it('login + enrolamiento TOTP obligatorio + /me con permisos', async () => {
    admin = await enroll('admin@pwt.test');
    const me = await http.get('/api/v1/auth/staff/me').set('Authorization', `Bearer ${admin.session.accessToken}`).expect(200);
    expect(me.body.data).toMatchObject({ email: 'admin@pwt.test', role: 'admin', mfaEnabled: true });
    expect(me.body.data.permissions).toContain('users:manage');
    agent = await enroll('agente@pwt.test');
  });

  it('sin token o con token inválido: 401 problem+json con WWW-Authenticate', async () => {
    const none = await http.get('/api/v1/auth/staff/me').expect(401);
    expect(none.headers['content-type']).toContain('application/problem+json');
    expect(none.headers['www-authenticate']).toBe('Bearer');
    expect(none.body.code).toBe('access-token-required');
    const bad = await http.get('/api/v1/admin/dashboard').set('Authorization', 'Bearer abc.def.ghi').expect(401);
    expect(bad.body.code).toBe('invalid-access-token');
  });

  it('RBAC: el asesor no gestiona usuarios (403) y el admin sí; el backoffice sin BD responde 503', async () => {
    const forbidden = await http.get('/api/v1/admin/users').set('Authorization', `Bearer ${agent.session.accessToken}`).expect(403);
    expect(forbidden.body).toMatchObject({ code: 'insufficient-permissions', details: { required: ['users:manage'] } });
    const list = await http.get('/api/v1/admin/users').set('Authorization', `Bearer ${admin.session.accessToken}`).expect(200);
    expect(list.body.data.map((u: { email: string }) => u.email)).toEqual(expect.arrayContaining(['admin@pwt.test', 'agente@pwt.test']));
    expect(list.body.data[0]).not.toHaveProperty('passwordHash');
    await http.post('/api/v1/admin/tours').set('Authorization', `Bearer ${agent.session.accessToken}`).send({ code: 'X-1', slug: 'x', type: 'tour' }).expect(403);
    const unavailable = await http.get('/api/v1/admin/dashboard').set('Authorization', `Bearer ${agent.session.accessToken}`).expect(503);
    expect(unavailable.body.code).toBe('backoffice-requires-database');
  });

  it('MFA en el login siguiente; un código de recuperación sirve una sola vez', async () => {
    const login = await http.post('/api/v1/auth/staff/login').send({ email: 'agente@pwt.test', password: PASSWORD }).expect(200);
    expect(login.body.data.status).toBe('mfa_required');
    const wrong = await http.post('/api/v1/auth/staff/mfa/verify').send({ mfaToken: login.body.data.mfaToken, code: '000000' }).expect(401);
    expect(wrong.body.code).toBe('invalid-mfa-code');
    const ok = await http.post('/api/v1/auth/staff/mfa/verify').send({ mfaToken: login.body.data.mfaToken, code: agent.session.recoveryCodes[0] }).expect(200);
    expect(ok.body.data).toMatchObject({ usedRecoveryCode: true, recoveryCodesRemaining: 9, tokenType: 'Bearer' });
    const again = await http.post('/api/v1/auth/staff/login').send({ email: 'agente@pwt.test', password: PASSWORD }).expect(200);
    const reused = await http.post('/api/v1/auth/staff/mfa/verify').send({ mfaToken: again.body.data.mfaToken, code: agent.session.recoveryCodes[0] }).expect(401);
    expect(reused.body.code).toBe('invalid-mfa-code');
  });

  it('refresh rotativo; reusar el refresh anterior revoca la sesión entera', async () => {
    const first = await http.post('/api/v1/auth/staff/refresh').send({ refreshToken: admin.session.refreshToken }).expect(200);
    const rotated = first.body.data as { accessToken: string; refreshToken: string };
    expect(rotated.refreshToken).not.toBe(admin.session.refreshToken);
    await http.get('/api/v1/auth/staff/me').set('Authorization', `Bearer ${rotated.accessToken}`).expect(200);
    const reuse = await http.post('/api/v1/auth/staff/refresh').send({ refreshToken: admin.session.refreshToken }).expect(401);
    expect(reuse.body.code).toBe('refresh-token-reused');
    const after = await http.get('/api/v1/auth/staff/me').set('Authorization', `Bearer ${rotated.accessToken}`).expect(401);
    expect(after.body.code).toBe('session-revoked');
    await http.post('/api/v1/auth/staff/refresh').send({ refreshToken: 'corto' }).expect(400);
  });

  it('IDOR: no se puede cerrar la sesión de otro usuario; logout-all cierra todas', async () => {
    const adminAgain = await http.post('/api/v1/auth/staff/login').send({ email: 'admin@pwt.test', password: PASSWORD }).expect(200);
    const verified = await http
      .post('/api/v1/auth/staff/mfa/verify')
      .send({ mfaToken: adminAgain.body.data.mfaToken, code: admin.session.recoveryCodes[0] })
      .expect(200);
    const adminToken = verified.body.data.accessToken as string;
    const adminSessionId = verified.body.data.sessionId as string;
    const idor = await http.delete(`/api/v1/auth/staff/sessions/${adminSessionId}`).set('Authorization', `Bearer ${agent.session.accessToken}`).expect(404);
    expect(idor.body.code).toBe('session-not-found');
    await http.get('/api/v1/auth/staff/me').set('Authorization', `Bearer ${adminToken}`).expect(200);
    const sessions = await http.get('/api/v1/auth/staff/sessions').set('Authorization', `Bearer ${adminToken}`).expect(200);
    expect(sessions.body.data.some((s: { current: boolean }) => s.current)).toBe(true);
    await http.post('/api/v1/auth/staff/logout-all').set('Authorization', `Bearer ${adminToken}`).expect(200);
    await http.get('/api/v1/auth/staff/me').set('Authorization', `Bearer ${adminToken}`).expect(401);
  });

  it('bloqueo progresivo: 429 account-locked con Retry-After', async () => {
    for (let i = 0; i < 3; i += 1) {
      const res = await http.post('/api/v1/auth/staff/login').send({ email: 'bloqueo@pwt.test', password: 'mala-clave-12345' }).expect(401);
      expect(res.body.code).toBe('invalid-credentials');
    }
    const locked = await http.post('/api/v1/auth/staff/login').send({ email: 'bloqueo@pwt.test', password: PASSWORD }).expect(429);
    expect(locked.body.code).toBe('account-locked');
    expect(Number(locked.headers['retry-after'])).toBeGreaterThan(0);
  });

  it('logout revoca el access token de inmediato', async () => {
    await http.post('/api/v1/auth/staff/logout').set('Authorization', `Bearer ${agent.session.accessToken}`).expect(204);
    const res = await http.get('/api/v1/auth/staff/me').set('Authorization', `Bearer ${agent.session.accessToken}`).expect(401);
    expect(res.body.code).toBe('session-revoked');
  });

  it('baja de marketing: enlace inválido => 401 sin revelar nada', async () => {
    const res = await http.post('/api/v1/privacy/unsubscribe').send({ token: 'x'.repeat(40) }).expect(401);
    expect(res.body.code).toBe('invalid-unsubscribe-link');
  });

  it('OpenAPI documenta /auth/staff, /admin y el esquema bearer', async () => {
    const doc = await http.get('/api/docs/openapi.json').expect(200);
    expect(Object.keys(doc.body.paths)).toEqual(
      expect.arrayContaining(['/api/v1/auth/staff/login', '/api/v1/auth/staff/refresh', '/api/v1/admin/bookings/{code}/cancel', '/api/v1/admin/complaints', '/api/v1/privacy/unsubscribe']),
    );
    expect(doc.body.components.securitySchemes.bearer).toMatchObject({ type: 'http', scheme: 'bearer' });
  });
});
