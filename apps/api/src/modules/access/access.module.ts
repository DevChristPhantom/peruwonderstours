import { Module } from '@nestjs/common';
import { APP_SETTINGS, type AppSettings } from '../../config/app-settings.js';
import { CLOCK, ID_GENERATOR, UNIT_OF_WORK } from '../../shared/application/tokens.js';
import type { UnitOfWork } from '../../shared/application/unit-of-work.js';
import type { Clock, IdGenerator } from '../../shared/domain/ports.js';
import { PasswordlessAccessUseCases } from './application/passwordless-access.use-cases.js';
import { GoogleIdentityVerifier } from './infrastructure/google-identity.js';
import { BookingAccessLinkController, ComplaintAccessLinkController, CustomerGoogleSignInController, CustomerLoginLinkController, GOOGLE_IDENTITY, MeController } from './interface/access.controllers.js';

/** Acceso sin contraseña (Sprint 3): enlaces mágicos de reserva/reclamo y cuenta de cliente. */
@Module({
  controllers: [BookingAccessLinkController, ComplaintAccessLinkController, CustomerLoginLinkController, CustomerGoogleSignInController, MeController],
  providers: [
    {
      provide: GOOGLE_IDENTITY,
      inject: [APP_SETTINGS],
      // Sin GOOGLE_OAUTH_CLIENT_ID/SECRET el endpoint responde 404 `google-sign-in-disabled`.
      useFactory: (s: AppSettings) => (s.googleOAuth ? new GoogleIdentityVerifier(s.googleOAuth) : null),
    },
    {
      provide: PasswordlessAccessUseCases,
      inject: [UNIT_OF_WORK, CLOCK, ID_GENERATOR, APP_SETTINGS],
      useFactory: (uow: UnitOfWork, clock: Clock, ids: IdGenerator, s: AppSettings) => new PasswordlessAccessUseCases(uow, clock, ids, s.access),
    },
  ],
  exports: [PasswordlessAccessUseCases],
})
export class AccessModule {}
