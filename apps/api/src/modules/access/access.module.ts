import { Module } from '@nestjs/common';
import { APP_SETTINGS, type AppSettings } from '../../config/app-settings.js';
import { CLOCK, ID_GENERATOR, UNIT_OF_WORK } from '../../shared/application/tokens.js';
import type { UnitOfWork } from '../../shared/application/unit-of-work.js';
import type { Clock, IdGenerator } from '../../shared/domain/ports.js';
import { PasswordlessAccessUseCases } from './application/passwordless-access.use-cases.js';
import { BookingAccessLinkController, ComplaintAccessLinkController, CustomerLoginLinkController, MeController } from './interface/access.controllers.js';

/** Acceso sin contraseña (Sprint 3): enlaces mágicos de reserva/reclamo y cuenta de cliente. */
@Module({
  controllers: [BookingAccessLinkController, ComplaintAccessLinkController, CustomerLoginLinkController, MeController],
  providers: [
    {
      provide: PasswordlessAccessUseCases,
      inject: [UNIT_OF_WORK, CLOCK, ID_GENERATOR, APP_SETTINGS],
      useFactory: (uow: UnitOfWork, clock: Clock, ids: IdGenerator, s: AppSettings) => new PasswordlessAccessUseCases(uow, clock, ids, s.access),
    },
  ],
  exports: [PasswordlessAccessUseCases],
})
export class AccessModule {}
