import { Module } from '@nestjs/common';
import { CATALOG_REPOSITORY, CLOCK, UNIT_OF_WORK } from '../../shared/application/tokens.js';
import type { UnitOfWork } from '../../shared/application/unit-of-work.js';
import type { Clock } from '../../shared/domain/ports.js';
import { CatalogQueries } from './application/catalog-queries.js';
import type { CatalogRepository } from './domain/catalog.repository.js';
import { CatalogController } from './interface/catalog.controller.js';

@Module({
  controllers: [CatalogController],
  providers: [
    {
      provide: CatalogQueries,
      inject: [CATALOG_REPOSITORY, UNIT_OF_WORK, CLOCK],
      useFactory: (catalog: CatalogRepository, uow: UnitOfWork, clock: Clock) => new CatalogQueries(catalog, uow, clock),
    },
  ],
})
export class CatalogModule {}
