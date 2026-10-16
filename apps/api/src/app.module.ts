import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { settingsFromConfigService } from './config/app-settings.js';
import { validateEnvironment } from './config/environment.js';
import { AccessModule } from './modules/access/access.module.js';
import { ContentModule } from './modules/content/content.module.js';
import { MediaModule } from './modules/media/media.module.js';
import { BookingModule } from './modules/booking/booking.module.js';
import { CartModule } from './modules/cart/cart.module.js';
import { CatalogModule } from './modules/catalog/catalog.module.js';
import { ComplaintsModule } from './modules/complaints/complaints.module.js';
import { HealthModule } from './modules/health/health.module.js';
import { HeroBannersModule } from './modules/hero-banners/hero-banners.module.js';
import { PaymentsModule } from './modules/payments/payments.module.js';
import { BackofficeModule } from './modules/backoffice/backoffice.module.js';
import { IdentityModule } from './modules/identity/identity.module.js';
import { NotificationsModule } from './modules/notifications/notifications.module.js';
import { PrivacyModule } from './modules/privacy/privacy.module.js';
import { PersistenceModule } from './persistence/persistence.module.js';
import { throttlerOptions } from './shared/interface/throttling.js';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, cache: true, validate: validateEnvironment }),
    ThrottlerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => throttlerOptions(settingsFromConfigService(config).throttle),
    }),
    PersistenceModule,
    IdentityModule,
    PrivacyModule,
    HealthModule,
    HeroBannersModule,
    CatalogModule,
    CartModule,
    BookingModule,
    PaymentsModule,
    ComplaintsModule,
    NotificationsModule,
    BackofficeModule,
    AccessModule,
    MediaModule,
    ContentModule,
  ],
  // Rate limiting global (429 problem+json vía ProblemDetailsFilter).
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}
