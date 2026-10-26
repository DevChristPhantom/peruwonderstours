import { Module } from '@nestjs/common';
import type { PersistenceBackend } from '../../persistence/persistence-backend.js';
import { CLOCK, ID_GENERATOR, MEDIA_URL_RESOLVER, PERSISTENCE_BACKEND } from '../../shared/application/tokens.js';
import type { Clock, IdGenerator } from '../../shared/domain/ports.js';
import { AdminDatabase } from '../backoffice/infrastructure/admin-database.js';
import type { MediaUrlResolver } from '../media/domain/media.js';
import { PromotionsService } from './application/promotions.service.js';
import { PromotionsAdminController, PromotionsPublicController } from './interface/promotions.controllers.js';

/** Eventos y campañas destacadas: `/api/v1/promotions` (público) y `/api/v1/admin/promotions`. */
@Module({
  controllers: [PromotionsPublicController, PromotionsAdminController],
  providers: [
    {
      provide: PromotionsService,
      inject: [PERSISTENCE_BACKEND, CLOCK, ID_GENERATOR, MEDIA_URL_RESOLVER],
      useFactory: (b: PersistenceBackend, clock: Clock, ids: IdGenerator, urls: MediaUrlResolver) => new PromotionsService(new AdminDatabase(b.prisma, clock), ids, urls),
    },
  ],
})
export class PromotionsModule {}
