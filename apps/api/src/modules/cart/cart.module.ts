import { Module } from '@nestjs/common';
import { APP_SETTINGS, type AppSettings } from '../../config/app-settings.js';
import { CLOCK, ID_GENERATOR, UNIT_OF_WORK } from '../../shared/application/tokens.js';
import type { UnitOfWork } from '../../shared/application/unit-of-work.js';
import type { Clock, IdGenerator } from '../../shared/domain/ports.js';
import { CartUseCases } from './application/cart.use-cases.js';
import { CartsController } from './interface/carts.controller.js';

@Module({
  controllers: [CartsController],
  providers: [
    {
      provide: CartUseCases,
      inject: [UNIT_OF_WORK, CLOCK, ID_GENERATOR, APP_SETTINGS],
      useFactory: (uow: UnitOfWork, clock: Clock, ids: IdGenerator, settings: AppSettings) => new CartUseCases(uow, clock, ids, settings.cart),
    },
  ],
  exports: [CartUseCases],
})
export class CartModule {}
