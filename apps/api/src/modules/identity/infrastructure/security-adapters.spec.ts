import { generate } from 'otplib';
import { Argon2PasswordHasher, JwtTokenService, OtplibTotpService } from './security-adapters.js';

describe('Argon2PasswordHasher (Argon2id real)', () => {
  it('genera hashes Argon2id con sal aleatoria y verifica', async () => {
    const hasher = new Argon2PasswordHasher();
    const a = await hasher.hash('Lago-Titicaca#Uros-77');
    const b = await hasher.hash('Lago-Titicaca#Uros-77');
    expect(a).toMatch(/^\$argon2id\$v=19\$m=19456,p=1,t=2\$/);
    expect(a).not.toBe(b);
    await expect(hasher.verify(a, 'Lago-Titicaca#Uros-77')).resolves.toBe(true);
    await expect(hasher.verify(a, 'otra')).resolves.toBe(false);
    await expect(hasher.verify('no-es-hash', 'x')).resolves.toBe(false);
    expect(hasher.needsRehash(a)).toBe(false);
    expect(new Argon2PasswordHasher({ memoryCost: 65_536, timeCost: 3, parallelism: 1 }).needsRehash(a)).toBe(true);
  });
});

describe('OtplibTotpService', () => {
  const totp = new OtplibTotpService();
  const now = new Date('2026-10-08T15:00:10Z');
  const epoch = Math.floor(now.getTime() / 1000);

  it('acepta el paso actual y ±1 (30 s); rechaza pasos ya usados', async () => {
    const secret = totp.generateSecret();
    const current = await generate({ secret, epoch });
    const step = await totp.verify({ secret, code: current, afterTimeStep: null, now });
    expect(step).toBe(Math.floor(epoch / 30));
    await expect(totp.verify({ secret, code: await generate({ secret, epoch: epoch - 30 }), afterTimeStep: null, now })).resolves.not.toBeNull();
    await expect(totp.verify({ secret, code: await generate({ secret, epoch: epoch - 120 }), afterTimeStep: null, now })).resolves.toBeNull();
    await expect(totp.verify({ secret, code: current, afterTimeStep: step, now })).resolves.toBeNull();
    await expect(totp.verify({ secret, code: 'abc', afterTimeStep: null, now })).resolves.toBeNull();
  });

  it('URI otpauth compatible con apps autenticadoras', () => {
    expect(totp.buildUri({ issuer: 'peruwonderstours', label: 'ana@pwt.pe', secret: 'JBSWY3DPEHPK3PXP' })).toContain('secret=JBSWY3DPEHPK3PXP');
  });
});

describe('JwtTokenService', () => {
  const now = new Date('2026-10-08T15:00:00Z');
  const service = new JwtTokenService('unit-test-secret-0123456789-abcdefghij', 'pwt-test', 600);

  it('el access token no sirve como desafío ni con otro secreto', () => {
    const access = service.signAccess({ sub: 'u1', sid: 's1', role: 'admin' }, now);
    expect(service.verifyAccess(access.token, now)).toEqual({ sub: 'u1', sid: 's1', role: 'admin' });
    expect(access.expiresAt.getTime() - now.getTime()).toBe(600_000);
    expect(() => service.verifyChallenge(access.token, 'mfa', now)).toThrow(/desafío/);
    const other = new JwtTokenService('otro-secreto-0123456789-abcdefghijklm', 'pwt-test', 600);
    expect(() => other.verifyAccess(access.token, now)).toThrow();
  });

  it('el desafío de enrolamiento no sirve como desafío MFA ni como access', () => {
    const enroll = service.signChallenge({ sub: 'u1', kind: 'enroll', ver: 3 }, now);
    expect(service.verifyChallenge(enroll.token, 'enroll', now)).toEqual({ sub: 'u1', ver: 3 });
    expect(() => service.verifyChallenge(enroll.token, 'mfa', now)).toThrow();
    expect(() => service.verifyAccess(enroll.token, now)).toThrow();
    expect(() => service.verifyChallenge(enroll.token, 'enroll', new Date(now.getTime() + 301_000))).toThrow();
  });

  it('rechaza alg "none"', () => {
    const header = Buffer.from(JSON.stringify({ alg: 'none', typ: 'JWT' })).toString('base64url');
    const payload = Buffer.from(JSON.stringify({ sub: 'u1', sid: 's1', role: 'admin', typ: 'access', iss: 'pwt-test', aud: 'pwt-backoffice', exp: 9_999_999_999 })).toString('base64url');
    expect(() => service.verifyAccess(`${header}.${payload}.`, now)).toThrow();
  });
});
