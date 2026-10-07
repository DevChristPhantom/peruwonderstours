import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { validateEnvironment } from './config/environment.js';
import { BookingModule } from './modules/booking/booking.module.js';
import { CartModule } from './modules/cart/cart.module.js';
import { CatalogModule } from './modules/catalog/catalog.module.js';
import { HealthModule } from './modules/health/health.module.js';
import { PaymentsModule } from './modules/payments/payments.module.js';
import { PersistenceModule } from './persistence/persistence.module.js';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, cache: true, validate: validateEnvironment }),
    PersistenceModule,
    HealthModule,
    CatalogModule,
    CartModule,
    BookingModule,
    PaymentsModule,
  ],
})
export class AppModule {}
