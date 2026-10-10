import { Module } from '@nestjs/common';
import { APP_SETTINGS, type AppSettings } from '../../config/app-settings.js';
import type { PersistenceBackend } from '../../persistence/persistence-backend.js';
import type { PiiCipher } from '../../shared/application/pii-cipher.js';
import { CLOCK, ID_GENERATOR, PERSISTENCE_BACKEND, PII_CIPHER } from '../../shared/application/tokens.js';
import type { Clock, IdGenerator } from '../../shared/domain/ports.js';
import { AuditQueryService } from './application/audit-query.service.js';
import { BookingsAdminService } from './application/bookings-admin.service.js';
import { ComplaintsAdminService } from './application/complaints-admin.service.js';
import { DashboardService } from './application/dashboard.service.js';
import { DeparturesAdminService } from './application/departures-admin.service.js';
import { PricingAdminService } from './application/pricing-admin.service.js';
import { PrivacyAdminService } from './application/privacy-admin.service.js';
import { ToursAdminService } from './application/tours-admin.service.js';
import { ContentAdminService } from './application/content-admin.service.js';
import { PaymentsAdminService } from './application/payments-admin.service.js';
import {
  BlogAdminController,
  CategoriesAdminController,
  ContactAdminController,
  DestinationsAdminController,
  PaymentsAdminController,
  TestimonialsAdminController,
} from './interface/content-admin.controllers.js';
import { AdminDatabase } from './infrastructure/admin-database.js';
import {
  AuditAdminController,
  BookingsAdminController,
  ComplaintsAdminController,
  DashboardController,
  DeparturesAdminController,
  PricingAdminController,
  PrivacyAdminController,
  ToursAdminController,
} from './interface/backoffice.controllers.js';

/**
 * API de backoffice `/api/v1/admin/*` (E7). Requiere PostgreSQL: en modo seed/memory los
 * endpoints autentican igual pero responden 503 `backoffice-requires-database`.
 */
@Module({
  controllers: [
    DashboardController,
    ToursAdminController,
    PricingAdminController,
    DeparturesAdminController,
    BookingsAdminController,
    ComplaintsAdminController,
    PrivacyAdminController,
    AuditAdminController,
    BlogAdminController,
    TestimonialsAdminController,
    ContactAdminController,
    DestinationsAdminController,
    CategoriesAdminController,
    PaymentsAdminController,
  ],
  providers: [
    { provide: AdminDatabase, inject: [PERSISTENCE_BACKEND, CLOCK], useFactory: (b: PersistenceBackend, clock: Clock) => new AdminDatabase(b.prisma, clock) },
    { provide: ToursAdminService, inject: [AdminDatabase, ID_GENERATOR], useFactory: (db: AdminDatabase, ids: IdGenerator) => new ToursAdminService(db, ids) },
    { provide: PricingAdminService, inject: [AdminDatabase, ID_GENERATOR], useFactory: (db: AdminDatabase, ids: IdGenerator) => new PricingAdminService(db, ids) },
    { provide: DeparturesAdminService, inject: [AdminDatabase, ID_GENERATOR], useFactory: (db: AdminDatabase, ids: IdGenerator) => new DeparturesAdminService(db, ids) },
    {
      provide: BookingsAdminService,
      inject: [AdminDatabase, ID_GENERATOR, APP_SETTINGS],
      useFactory: (db: AdminDatabase, ids: IdGenerator, s: AppSettings) => new BookingsAdminService(db, ids, s.backoffice.refundTiers),
    },
    {
      provide: ComplaintsAdminService,
      inject: [AdminDatabase, ID_GENERATOR, PII_CIPHER, APP_SETTINGS],
      useFactory: (db: AdminDatabase, ids: IdGenerator, cipher: PiiCipher, s: AppSettings) => new ComplaintsAdminService(db, ids, cipher, s.complaints),
    },
    {
      provide: PrivacyAdminService,
      inject: [AdminDatabase, ID_GENERATOR, PII_CIPHER],
      useFactory: (db: AdminDatabase, ids: IdGenerator, cipher: PiiCipher) => new PrivacyAdminService(db, ids, cipher),
    },
    { provide: DashboardService, inject: [AdminDatabase, APP_SETTINGS], useFactory: (db: AdminDatabase, s: AppSettings) => new DashboardService(db, s.outbox.maxAttempts) },
    {
      provide: ContentAdminService,
      inject: [AdminDatabase, ID_GENERATOR, PII_CIPHER],
      useFactory: (db: AdminDatabase, ids: IdGenerator, cipher: PiiCipher) => new ContentAdminService(db, ids, cipher),
    },
    { provide: PaymentsAdminService, inject: [AdminDatabase, ID_GENERATOR], useFactory: (db: AdminDatabase, ids: IdGenerator) => new PaymentsAdminService(db, ids) },
    { provide: AuditQueryService, inject: [AdminDatabase], useFactory: (db: AdminDatabase) => new AuditQueryService(db) },
  ],
})
export class BackofficeModule {}
