import { ValidationError } from '../../../shared/domain/domain-error.js';
import { hasAllPermissions, permissionsFor, ROLE_PERMISSIONS } from './permissions.js';
import {
  assertPasswordPolicy,
  generatePassword,
  generateRecoveryCodes,
  hashRecoveryCode,
  isRecoveryCodeFormat,
  lockRemainingSeconds,
  normalizeRecoveryCode,
  registerFailedAttempt,
} from './staff-user.js';

const NOW = new Date('2026-10-08T15:00:00Z');
const POLICY = { threshold: 5, baseSeconds: 60, maxSeconds: 3600 };

describe('Bloqueo progresivo', () => {
  it('no bloquea antes del umbral y luego duplica el tiempo hasta el tope', () => {
    let state = { failedLoginCount: 0 };
    const locks: Array<number | null> = [];
    for (let i = 0; i < 12; i += 1) {
      const next = registerFailedAttempt(state, NOW, POLICY);
      locks.push(next.lockedUntil ? (next.lockedUntil.getTime() - NOW.getTime()) / 1000 : null);
      state = { failedLoginCount: next.failedLoginCount };
    }
    expect(locks).toEqual([null, null, null, null, 60, 120, 240, 480, 960, 1920, 3600, 3600]);
  });

  it('calcula el tiempo restante del bloqueo', () => {
    expect(lockRemainingSeconds({ lockedUntil: new Date(NOW.getTime() + 61_500) }, NOW)).toBe(62);
    expect(lockRemainingSeconds({ lockedUntil: new Date(NOW.getTime() - 1) }, NOW)).toBe(0);
    expect(lockRemainingSeconds({ lockedUntil: null }, NOW)).toBe(0);
  });
});

describe('Política de contraseñas', () => {
  it('exige longitud, rechaza comunes, correo y nombre', () => {
    expect(() => assertPasswordPolicy('corta')).toThrow(ValidationError);
    expect(() => assertPasswordPolicy('password1234')).toThrow(expect.objectContaining({ code: 'weak-password' }));
    expect(() => assertPasswordPolicy('xx-operaciones-2026-xx', { email: 'operaciones@pwt.pe' })).toThrow(ValidationError);
    expect(() => assertPasswordPolicy('MamaniViaje!2026', { fullName: 'Rosa Mamani' })).toThrow(ValidationError);
    expect(() => assertPasswordPolicy('aaaaaaaaaaaaaaaa')).toThrow(ValidationError);
    expect(() => assertPasswordPolicy('Lago-Titicaca#Uros-77', { email: 'ana@pwt.pe', fullName: 'Ana Quispe' })).not.toThrow();
  });

  it('genera contraseñas aleatorias que cumplen la política', () => {
    const a = generatePassword();
    expect(a).toHaveLength(20);
    expect(a).not.toBe(generatePassword());
    expect(() => assertPasswordPolicy(a)).not.toThrow();
  });
});

describe('Códigos de recuperación', () => {
  it('genera 10 códigos únicos XXXXX-XXXXX y los hashea normalizados', () => {
    const codes = generateRecoveryCodes();
    expect(codes).toHaveLength(10);
    expect(new Set(codes).size).toBe(10);
    for (const c of codes) expect(c).toMatch(/^[A-Z0-9]{5}-[A-Z0-9]{5}$/);
    const code = codes[0]!;
    expect(isRecoveryCodeFormat(code.toLowerCase().replace('-', ' '))).toBe(true);
    expect(hashRecoveryCode(code)).toBe(hashRecoveryCode(normalizeRecoveryCode(code.toLowerCase())));
    expect(hashRecoveryCode(code)).toMatch(/^[0-9a-f]{64}$/);
  });
});

describe('RBAC por permisos', () => {
  it('admin tiene todo; operador no gestiona usuarios; asesor solo lectura + pagos manuales', () => {
    expect(permissionsFor('admin').has('users:manage')).toBe(true);
    expect(permissionsFor('operator').has('users:manage')).toBe(false);
    expect(permissionsFor('operator').has('pricing:write')).toBe(true);
    const agent = permissionsFor('agent');
    expect(hasAllPermissions(agent, ['bookings:read', 'payments:record'])).toBe(true);
    expect(hasAllPermissions(agent, ['bookings:read', 'bookings:cancel'])).toBe(false);
    expect(agent.has('tours:write')).toBe(false);
    expect(agent.has('complaints:respond')).toBe(false);
    expect(ROLE_PERMISSIONS.agent.every((p) => permissionsFor('operator').has(p))).toBe(true);
  });
});
