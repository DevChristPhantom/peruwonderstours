import { Global, Logger, Module } from '@nestjs/common';
import { APP_SETTINGS, type AppSettings } from '../../config/app-settings.js';
import type { PersistenceBackend } from '../../persistence/persistence-backend.js';
import type { PiiCipher } from '../../shared/application/pii-cipher.js';
import { CLOCK, ID_GENERATOR, IDENTITY_STORE, PASSWORD_HASHER, PERSISTENCE_BACKEND, PII_CIPHER } from '../../shared/application/tokens.js';
import type { Clock, IdGenerator } from '../../shared/domain/ports.js';
import type { IdentityStore, PasswordHasher } from './application/ports.js';
import { StaffAuthUseCases } from './application/staff-auth.use-cases.js';
import { StaffUsersUseCases } from './application/staff-users.use-cases.js';
import { InMemoryIdentityStore, PrismaIdentityStore } from './infrastructure/identity-stores.js';
import { Argon2PasswordHasher, JwtTokenService, OtplibTotpService } from './infrastructure/security-adapters.js';
import { StaffAuthController, StaffUsersController } from './interface/staff-auth.controller.js';
import { StaffAuthGuard } from './interface/staff-auth.guard.js';

/**
 * Identidad del staff: login + MFA TOTP, sesiones con refresh rotativo y RBAC por permisos.
 * Global para que cualquier controlador use `@StaffAuth(...)`.
 */
@Global()
@Module({
  controllers: [StaffAuthController, StaffUsersController],
  providers: [
    {
      provide: IDENTITY_STORE,
      inject: [PERSISTENCE_BACKEND],
      useFactory: (backend: PersistenceBackend): IdentityStore => (backend.prisma ? new PrismaIdentityStore(backend.prisma) : new InMemoryIdentityStore()),
    },
    { provide: PASSWORD_HASHER, useFactory: () => new Argon2PasswordHasher() },
    {
      provide: StaffAuthUseCases,
      inject: [IDENTITY_STORE, CLOCK, ID_GENERATOR, PASSWORD_HASHER, PII_CIPHER, APP_SETTINGS],
      useFactory: (store: IdentityStore, clock: Clock, ids: IdGenerator, hasher: PasswordHasher, cipher: PiiCipher, settings: AppSettings) => {
        let secret = settings.auth.jwtSecret;
        if (!secret) {
          new Logger('Identity').warn('JWT_ACCESS_SECRET no definida: secreto EFÍMERO de desarrollo (las sesiones no sobreviven a un reinicio).');
          secret = JwtTokenService.ephemeralSecret();
        }
        const tokens = new JwtTokenService(secret, settings.auth.issuer, settings.auth.accessTokenTtlSeconds);
        return new StaffAuthUseCases(store, clock, ids, hasher, new OtplibTotpService(), tokens, cipher, {
          accessTokenTtlSeconds: settings.auth.accessTokenTtlSeconds,
          refreshIdleTtlSeconds: settings.auth.refreshIdleTtlSeconds,
          refreshAbsoluteTtlSeconds: settings.auth.refreshAbsoluteTtlSeconds,
          lockout: settings.auth.lockout,
          mfaIssuer: settings.auth.mfaIssuer,
        });
      },
    },
    {
      provide: StaffUsersUseCases,
      inject: [IDENTITY_STORE, CLOCK, ID_GENERATOR, PASSWORD_HASHER],
      useFactory: (store: IdentityStore, clock: Clock, ids: IdGenerator, hasher: PasswordHasher) => new StaffUsersUseCases(store, clock, ids, hasher),
    },
    StaffAuthGuard,
  ],
  exports: [StaffAuthUseCases, StaffUsersUseCases, StaffAuthGuard, IDENTITY_STORE],
})
export class IdentityModule {}
