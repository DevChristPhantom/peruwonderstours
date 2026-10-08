import type { AuditTrail } from '../../../shared/application/audit.js';
import type { StaffRole } from '../domain/permissions.js';
import type { StaffUser } from '../domain/staff-user.js';

/** Fila de `auth_sessions` de un usuario del staff. Una "sesión" = una familia de rotación. */
export interface AuthSessionRecord {
  id: string;
  userId: string;
  familyId: string;
  /** SHA-256 del refresh token (32 bytes). */
  tokenHash: Uint8Array;
  replacedById: string | null;
  ip: string | null;
  userAgent: string | null;
  expiresAt: Date;
  absoluteExpiresAt: Date;
  revokedAt: Date | null;
  revokedReason: string | null;
  createdAt: Date;
}

export type RevocationReason = 'rotated' | 'logout' | 'logout_all' | 'reuse_detected' | 'admin' | 'password_changed' | 'mfa_reset' | 'user_disabled';

export interface StaffUserRepository {
  findByEmail(email: string): Promise<StaffUser | null>;
  findById(id: string): Promise<StaffUser | null>;
  insert(user: StaffUser): Promise<void>;
  /** Actualiza los campos mutables (rol, estado, secretos, contadores, versión). */
  update(user: StaffUser): Promise<void>;
  list(): Promise<StaffUser[]>;
}

export interface AuthSessionRepository {
  insert(session: AuthSessionRecord): Promise<void>;
  /** Busca por hash y bloquea la fila hasta el fin de la transacción (rotación concurrente). */
  findByTokenHashForUpdate(tokenHash: Uint8Array): Promise<AuthSessionRecord | null>;
  /** Token vigente de la familia (no revocado y no vencido), o null. */
  findActiveInFamily(familyId: string, now: Date): Promise<AuthSessionRecord | null>;
  revoke(id: string, reason: RevocationReason, now: Date, replacedById?: string | null): Promise<void>;
  revokeFamily(familyId: string, reason: RevocationReason, now: Date): Promise<number>;
  revokeAllForUser(userId: string, reason: RevocationReason, now: Date): Promise<number>;
  /** Último token vigente de cada familia activa del usuario. */
  listActiveForUser(userId: string, now: Date): Promise<AuthSessionRecord[]>;
}

export interface RecoveryCodeRepository {
  replaceAll(userId: string, codeHashes: readonly string[], now: Date): Promise<void>;
  /** Marca como usado si existe y no se usó; devuelve true si se consumió. */
  consume(userId: string, codeHash: string, now: Date): Promise<boolean>;
  countUnused(userId: string): Promise<number>;
}

export interface IdentityRepositories {
  users: StaffUserRepository;
  sessions: AuthSessionRepository;
  recoveryCodes: RecoveryCodeRepository;
  audit: AuditTrail;
}

/** Transacción sobre el almacén de identidades (PostgreSQL o memoria). */
export interface IdentityStore {
  run<T>(work: (repos: IdentityRepositories) => Promise<T>): Promise<T>;
}

export interface PasswordHasher {
  hash(password: string): Promise<string>;
  verify(hash: string, password: string): Promise<boolean>;
  needsRehash(hash: string): boolean;
}

export interface TotpService {
  generateSecret(): string;
  buildUri(params: { issuer: string; label: string; secret: string }): string;
  /** Devuelve el time step aceptado o null. Rechaza steps <= afterTimeStep (anti-replay). */
  verify(params: { secret: string; code: string; afterTimeStep: number | null; now: Date }): Promise<number | null>;
}

export interface AccessClaims {
  /** user id */
  sub: string;
  /** familia de sesión (auth_sessions.family_id) */
  sid: string;
  role: StaffRole;
}

export type ChallengeKind = 'mfa' | 'enroll';

export interface TokenService {
  signAccess(claims: AccessClaims, now: Date): { token: string; expiresAt: Date };
  /** Lanza UnauthorizedError (invalid-access-token / access-token-expired). */
  verifyAccess(token: string, now: Date): AccessClaims;
  signChallenge(params: { sub: string; kind: ChallengeKind; ver: number }, now: Date): { token: string; expiresAt: Date };
  /** Lanza UnauthorizedError invalid-mfa-token. */
  verifyChallenge(token: string, kind: ChallengeKind, now: Date): { sub: string; ver: number };
}
