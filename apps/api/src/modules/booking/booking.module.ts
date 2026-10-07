import { Module } from '@nestjs/common';
import { APP_SETTINGS, type AppSettings } from '../../config/app-settings.js';
import { CLOCK, ID_GENERATOR, UNIT_OF_WORK } from '../../shared/application/tokens.js';
import type { UnitOfWork } from '../../shared/application/unit-of-work.js';
import type { Clock, IdGenerator } from '../../shared/domain/ports.js';
import { CartModule } from '../cart/cart.module.js';
import { CartUseCases } from '../cart/application/cart.use-cases.js';
import { BookingUseCases } from './application/booking.use-cases.js';
import { BookingsController } from './interface/bookings.controller.js';

@Module({
  imports: [CartModule],
  controllers: [BookingsController],
  providers: [
    {
      provide: BookingUseCases,
      inject: [UNIT_OF_WORK, CLOCK, ID_GENERATOR, CartUseCases, APP_SETTINGS],
      useFactory: (uow: UnitOfWork, clock: Clock, ids: IdGenerator, carts: CartUseCases, settings: AppSettings) =>
        new BookingUseCases(uow, clock, ids, carts, settings.booking),
    },
  ],
  exports: [BookingUseCases],
})
export class BookingModule {}
