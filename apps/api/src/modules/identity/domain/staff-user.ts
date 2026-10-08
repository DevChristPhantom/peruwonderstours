import { createHash, randomInt } from 'node:crypto';
import { ValidationError } from '../../../shared/domain/domain-error.js';
import type { StaffRole } from './permissions.js';

export type AccountStatus = 'active' | 'suspended' | 'disabled';

/** Usuario del staff tal como lo necesita la autenticación (secretos ya cifrados/hasheados). */
export interface StaffUser {
  id: string;
  email: string;
  fullName: string;
  role: StaffRole;
  status: AccountStatus;
  passwordHash: string;
  mfaSecretEnc: Uint8Array | null;
  mfaEnabledAt: Date | null;
  mfaLastTimeStep: number | null;
  failedLoginCount: number;
  lockedUntil: Date | null;
  lastFailedLoginAt: Date | null;
  passwordChangedAt: Date | null;
  lastLoginAt: Date | null;
  version: number;
  createdAt: Date;
  deletedAt: Date | null;
}

// -----------------------------------------------------------------------------
// Bloqueo progresivo
// -----------------------------------------------------------------------------
export interface LockoutPolicy {
  /** Fallos consecutivos antes del primer bloqueo. */
  threshold: number;
  baseSeconds: number;
  maxSeconds: number;
}

export const DEFAULT_LOCKOUT_POLICY: LockoutPolicy = { threshold: 5, baseSeconds: 60, maxSeconds: 3600 };

export function lockRemainingSeconds(user: Pick<StaffUser, 'lockedUntil'>, now: Date): number {
  if (!user.lockedUntil) return 0;
  const ms = user.lockedUntil.getTime() - now.getTime();
  return ms > 0 ? Math.ceil(ms / 1000) : 0;
}

/**
 * Registra un fallo (contraseña o segundo factor). Desde el fallo número `threshold` se
 * bloquea `base × 2^(n − threshold)` segundos, con tope `maxSeconds` (1 min, 2, 4, 8... hasta 1 h).
 */
export function registerFailedAttempt(
  user: Pick<StaffUser, 'failedLoginCount'>,
  now: Date,
  policy: LockoutPolicy,
): { failedLoginCount: number; lockedUntil: Date | null; lastFailedLoginAt: Date } {
  const failedLoginCount = user.failedLoginCount + 1;
  let lockedUntil: Date | null = null;
  if (failedLoginCount >= policy.threshold) {
    const exponent = Math.min(failedLoginCount - policy.threshold, 20);
    const seconds = Math.min(policy.baseSeconds * 2 ** exponent, policy.maxSeconds);
    lockedUntil = new Date(now.getTime() + seconds * 1000);
  }
  return { failedLoginCount, lockedUntil, lastFailedLoginAt: now };
}

// -----------------------------------------------------------------------------
// Política de contraseñas (NIST SP 800-63B: longitud + lista de prohibidas, sin reglas de composición)
// -----------------------------------------------------------------------------
export const PASSWORD_MIN_LENGTH = 12;
export const PASSWORD_MAX_LENGTH = 128;

const COMMON_PASSWORDS = new Set([
  'password1234', 'contraseña123', 'contrasena123', '123456789012', 'qwertyuiopas', 'peruwonders1', 'peruwonderstours',
  'administrador', 'admin1234567', 'machupicchu1', 'cusco1234567', 'iloveyou1234', 'passw0rd1234', '111111111111',
]);

export function assertPasswordPolicy(password: string, context: { email?: string; fullName?: string } = {}): void {
  const problems: string[] = [];
  if (password.length < PASSWORD_MIN_LENGTH) problems.push(`Debe tener al menos ${PASSWORD_MIN_LENGTH} caracteres.`);
  if (password.length > PASSWORD_MAX_LENGTH) problems.push(`Debe tener como máximo ${PASSWORD_MAX_LENGTH} caracteres.`);
  const lower = password.toLowerCase();
  if (COMMON_PASSWORDS.has(lower)) problems.push('Es una contraseña demasiado común.');
  if (/^(.)\1+$/.test(password)) problems.push('No puede repetir un solo carácter.');
  const local = context.email?.split('@')[0]?.toLowerCase();
  if (local && local.length >= 4 && lower.includes(local)) problems.push('No puede contener tu correo.');
  for (const part of (context.fullName ?? '').toLowerCase().split(/\s+/)) {
    if (part.length >= 4 && lower.includes(part)) {
      problems.push('No puede contener tu nombre.');
      break;
    }
  }
  if (problems.length > 0) {
    throw new ValidationError('weak-password', 'La contraseña no cumple la política.', { errors: [{ field: 'password', messages: problems }] });
  }
}

/** Contraseña aleatoria de 20 caracteres (alfabeto sin caracteres ambiguos). */
export function generatePassword(length = 20): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789-_!@#%+=';
  let out = '';
  for (let i = 0; i < length; i += 1) out += alphabet[randomInt(alphabet.length)];
  return out;
}

// -----------------------------------------------------------------------------
// Códigos de recuperación
// -----------------------------------------------------------------------------
export const RECOVERY_CODE_COUNT = 10;
const RECOVERY_ALPHABET = 'ABCDEFGHJKMNPQRSTVWXYZ23456789';

/** `XXXXX-XXXXX` (10 símbolos de 30 => ~49 bits). Se muestran una sola vez. */
export function generateRecoveryCodes(count = RECOVERY_CODE_COUNT): string[] {
  return Array.from({ length: count }, () => {
    const chars = Array.from({ length: 10 }, () => RECOVERY_ALPHABET[randomInt(RECOVERY_ALPHABET.length)]).join('');
    return `${chars.slice(0, 5)}-${chars.slice(5)}`;
  });
}

export function normalizeRecoveryCode(code: string): string {
  return code.toUpperCase().replace(/[\s-]/g, '');
}

export function isRecoveryCodeFormat(code: string): boolean {
  return /^[A-Z0-9]{10}$/.test(normalizeRecoveryCode(code));
}

/** SHA-256 hex del código normalizado (alta entropía: no requiere hash lento). */
export function hashRecoveryCode(code: string): string {
  return createHash('sha256').update(normalizeRecoveryCode(code), 'utf8').digest('hex');
}

export function isTotpFormat(code: string): boolean {
  return /^\d{6}$/.test(code.replace(/\s/g, ''));
}

export function normalizeStaffEmail(email: string): string {
  const normalized = email.trim().toLowerCase();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(normalized) || normalized.length > 254) {
    throw new ValidationError('invalid-email', 'Correo electrónico inválido.');
  }
  return normalized;
}
