import { randomBytes } from 'node:crypto';
import { JwtService } from '@nestjs/jwt';
import * as argon2 from 'argon2';
import { generateSecret, generateURI, verify as verifyTotp } from 'otplib';
import { UnauthorizedError } from '../../../shared/domain/domain-error.js';
import { isStaffRole } from '../domain/permissions.js';
import type { AccessClaims, ChallengeKind, PasswordHasher, TokenService, TotpService } from '../application/ports.js';

/**
 * Argon2id con los parámetros mínimos recomendados por OWASP (m = 19 MiB, t = 2, p = 1).
 * `needsRehash` permite subirlos más adelante sin forzar cambios de contraseña.
 */
export const ARGON2_OPTIONS = { type: argon2.argon2id, memoryCost: 19_456, timeCost: 2, parallelism: 1 } as const;

export class Argon2PasswordHasher implements PasswordHasher {
  constructor(private readonly options: { memoryCost: number; timeCost: number; parallelism: number } = ARGON2_OPTIONS) {}

  hash(password: string): Promise<string> {
    return argon2.hash(password, { ...this.options, type: argon2.argon2id });
  }

  async verify(hash: string, password: string): Promise<boolean> {
    try {
      return await argon2.verify(hash, password);
    } catch {
      return false;
    }
  }

  needsRehash(hash: string): boolean {
    try {
      return argon2.needsRehash(hash, this.options);
    } catch {
      return false;
    }
  }
}

/** TOTP RFC 6238 (SHA-1, 6 dígitos, 30 s) compatible con Google Authenticator, Authy, 1Password. */
export class OtplibTotpService implements TotpService {
  /** Tolerancia de ±1 paso (30 s) por desfase de reloj del teléfono. */
  constructor(private readonly toleranceSeconds = 30) {}

  generateSecret(): string {
    return generateSecret({ length: 20 });
  }

  buildUri(params: { issuer: string; label: string; secret: string }): string {
    return generateURI({ issuer: params.issuer, label: params.label, secret: params.secret });
  }

  async verify(params: { secret: string; code: string; afterTimeStep: number | null; now: Date }): Promise<number | null> {
    try {
      const result = await verifyTotp({
        secret: params.secret,
        token: params.code,
        epoch: Math.floor(params.now.getTime() / 1000),
        epochTolerance: this.toleranceSeconds,
        ...(params.afterTimeStep !== null ? { afterTimeStep: params.afterTimeStep } : {}),
      });
      return result.valid && 'timeStep' in result ? result.timeStep : null;
    } catch {
      return null;
    }
  }
}

const AUDIENCE = 'pwt-backoffice';
const CHALLENGE_TTL_SECONDS = 300;

interface AccessPayload extends AccessClaims {
  typ: 'access';
}
interface ChallengePayload {
  sub: string;
  typ: ChallengeKind;
  ver: number;
}

/**
 * JWT HS256 (aud `pwt-backoffice`). Access: 10-15 min con `sid` = familia de sesión.
 * Desafíos de MFA/enrolamiento: 5 min, `ver` = versión del usuario (uso único práctico).
 * El reloj inyectado manda (`clockTimestamp`) para que las pruebas controlen la expiración.
 */
export class JwtTokenService implements TokenService {
  private readonly jwt: JwtService;

  constructor(
    secret: string,
    private readonly issuer: string,
    private readonly accessTtlSeconds: number,
  ) {
    this.jwt = new JwtService({ secret, signOptions: { algorithm: 'HS256' }, verifyOptions: { algorithms: ['HS256'] } });
  }

  /** Secreto aleatorio de proceso para desarrollo sin JWT_ACCESS_SECRET (las sesiones mueren al reiniciar). */
  static ephemeralSecret(): string {
    return randomBytes(48).toString('base64url');
  }

  signAccess(claims: AccessClaims, now: Date): { token: string; expiresAt: Date } {
    const iat = Math.floor(now.getTime() / 1000);
    const exp = iat + this.accessTtlSeconds;
    const payload = { sub: claims.sub, sid: claims.sid, role: claims.role, typ: 'access', iat, exp, iss: this.issuer, aud: AUDIENCE };
    return { token: this.jwt.sign(payload), expiresAt: new Date(exp * 1000) };
  }

  verifyAccess(token: string, now: Date): AccessClaims {
    let payload: Partial<AccessPayload>;
    try {
      payload = this.jwt.verify<AccessPayload>(token, { issuer: this.issuer, audience: AUDIENCE, clockTimestamp: Math.floor(now.getTime() / 1000) });
    } catch (error) {
      if ((error as { name?: string }).name === 'TokenExpiredError') {
        throw new UnauthorizedError('access-token-expired', 'El token de acceso expiró. Renuévalo con el refresh token.');
      }
      throw new UnauthorizedError('invalid-access-token', 'Token de acceso inválido.');
    }
    if (payload.typ !== 'access' || typeof payload.sub !== 'string' || typeof payload.sid !== 'string' || !isStaffRole(payload.role)) {
      throw new UnauthorizedError('invalid-access-token', 'Token de acceso inválido.');
    }
    return { sub: payload.sub, sid: payload.sid, role: payload.role };
  }

  signChallenge(params: { sub: string; kind: ChallengeKind; ver: number }, now: Date): { token: string; expiresAt: Date } {
    const iat = Math.floor(now.getTime() / 1000);
    const exp = iat + CHALLENGE_TTL_SECONDS;
    const token = this.jwt.sign({ sub: params.sub, typ: params.kind, ver: params.ver, iat, exp, iss: this.issuer, aud: `${AUDIENCE}:${params.kind}` });
    return { token, expiresAt: new Date(exp * 1000) };
  }

  verifyChallenge(token: string, kind: ChallengeKind, now: Date): { sub: string; ver: number } {
    try {
      const payload = this.jwt.verify<ChallengePayload>(token ?? '', {
        issuer: this.issuer,
        audience: `${AUDIENCE}:${kind}`,
        clockTimestamp: Math.floor(now.getTime() / 1000),
      });
      if (payload.typ !== kind || typeof payload.sub !== 'string' || typeof payload.ver !== 'number') throw new Error('typ');
      return { sub: payload.sub, ver: payload.ver };
    } catch {
      throw new UnauthorizedError('invalid-mfa-token', 'El desafío de verificación no es válido o expiró. Inicia sesión de nuevo.');
    }
  }
}
