import { Module } from '@nestjs/common';
import { APP_SETTINGS, type AppSettings } from '../../config/app-settings.js';
import { CLOCK, ID_GENERATOR, PII_CIPHER, UNIT_OF_WORK } from '../../shared/application/tokens.js';
import type { PiiCipher } from '../../shared/application/pii-cipher.js';
import type { UnitOfWork } from '../../shared/application/unit-of-work.js';
import type { Clock, IdGenerator } from '../../shared/domain/ports.js';
import { CartModule } from '../cart/cart.module.js';
import { CartUseCases } from '../cart/application/cart.use-cases.js';
import { BookingUseCases } from './application/booking.use-cases.js';
import { BookingsController } from './interface/bookings.controller.js';
import { PrivacyUseCases } from '../privacy/application/privacy.use-cases.js';

@Module({
  imports: [CartModule],
  controllers: [BookingsController],
  providers: [
    {
      provide: BookingUseCases,
      inject: [UNIT_OF_WORK, CLOCK, ID_GENERATOR, CartUseCases, APP_SETTINGS, PrivacyUseCases, PII_CIPHER],
      useFactory: (uow: UnitOfWork, clock: Clock, ids: IdGenerator, carts: CartUseCases, settings: AppSettings, privacy: PrivacyUseCases, cipher: PiiCipher) =>
        new BookingUseCases(uow, clock, ids, carts, settings.booking, privacy, cipher),
    },
  ],
  exports: [BookingUseCases],
})
export class BookingModule {}
