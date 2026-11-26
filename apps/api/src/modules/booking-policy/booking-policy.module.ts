import { Global, Module } from '@nestjs/common';
import type { PersistenceBackend } from '../../persistence/persistence-backend.js';
import { CLOCK, PERSISTENCE_BACKEND } from '../../shared/application/tokens.js';
import type { Clock } from '../../shared/domain/ports.js';
import { AdminDatabase } from '../backoffice/infrastructure/admin-database.js';
import { BookingPolicyService } from './booking-policy.service.js';
import { BookingPolicyAdminController, BookingPolicyPublicController } from './booking-policy.controller.js';
@Global()
@Module({
  controllers: [BookingPolicyAdminController, BookingPolicyPublicController],
  providers: [{ provide: BookingPolicyService, inject: [PERSISTENCE_BACKEND, CLOCK], useFactory: (b: PersistenceBackend, clock: Clock) => new BookingPolicyService(new AdminDatabase(b.prisma, clock)) }],
  exports: [BookingPolicyService],
})
export class BookingPolicyModule {}
