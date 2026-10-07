import { Global, Inject, Injectable, Module, type OnApplicationShutdown } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { APP_SETTINGS, settingsFromConfigService, type AppSettings } from '../config/app-settings.js';
import { CATALOG_REPOSITORY, CLOCK, ID_GENERATOR, PERSISTENCE_BACKEND, UNIT_OF_WORK } from '../shared/application/tokens.js';
import type { Clock } from '../shared/domain/ports.js';
import { SystemClock, UuidV7Generator } from '../shared/infrastructure/system.js';
import { createPersistenceBackend, type PersistenceBackend } from './persistence-backend.js';

@Injectable()
class PersistenceLifecycle implements OnApplicationShutdown {
  constructor(@Inject(PERSISTENCE_BACKEND) private readonly backend: PersistenceBackend) {}
  async onApplicationShutdown(): Promise<void> {
    await this.backend.close();
  }
}

/** Configuración, reloj, ids y persistencia (Prisma o memoria) disponibles en toda la app. */
@Global()
@Module({
  providers: [
    { provide: APP_SETTINGS, inject: [ConfigService], useFactory: (config: ConfigService) => settingsFromConfigService(config) },
    { provide: CLOCK, useClass: SystemClock },
    { provide: ID_GENERATOR, useClass: UuidV7Generator },
    {
      provide: PERSISTENCE_BACKEND,
      inject: [APP_SETTINGS, CLOCK],
      useFactory: (settings: AppSettings, clock: Clock) => createPersistenceBackend(settings, clock),
    },
    { provide: UNIT_OF_WORK, inject: [PERSISTENCE_BACKEND], useFactory: (b: PersistenceBackend) => b.unitOfWork },
    { provide: CATALOG_REPOSITORY, inject: [PERSISTENCE_BACKEND], useFactory: (b: PersistenceBackend) => b.catalog },
    PersistenceLifecycle,
  ],
  exports: [APP_SETTINGS, CLOCK, ID_GENERATOR, PERSISTENCE_BACKEND, UNIT_OF_WORK, CATALOG_REPOSITORY],
})
export class PersistenceModule {}
