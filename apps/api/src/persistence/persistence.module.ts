import { Global, Inject, Injectable, Logger, Module, type OnApplicationShutdown } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { APP_SETTINGS, settingsFromConfigService, type AppSettings } from '../config/app-settings.js';
import { CATALOG_REPOSITORY, CLOCK, ID_GENERATOR, MEDIA_STORAGE, MEDIA_URL_RESOLVER, PERSISTENCE_BACKEND, PII_CIPHER, UNIT_OF_WORK } from '../shared/application/tokens.js';
import { MediaUrlResolver } from '../modules/media/domain/media.js';
import { LocalMediaStorage } from '../modules/media/infrastructure/local-media-storage.js';
import { AesGcmPiiCipher, DEVELOPMENT_PII_KEY_BASE64 } from '../shared/infrastructure/aes-gcm-pii-cipher.js';
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
    {
      provide: PII_CIPHER,
      inject: [APP_SETTINGS],
      useFactory: (settings: AppSettings) => {
        if (!settings.piiEncryptionKey) new Logger('Persistence').warn('PII_ENCRYPTION_KEY no definida: se usa la clave de DESARROLLO (prohibida en producción).');
        return AesGcmPiiCipher.fromBase64(settings.piiEncryptionKey ?? DEVELOPMENT_PII_KEY_BASE64);
      },
    },
    { provide: MEDIA_URL_RESOLVER, inject: [APP_SETTINGS], useFactory: (s: AppSettings) => new MediaUrlResolver(s.media.publicBaseUrl, s.mail.publicWebBaseUrl) },
    // Puerto MediaStorage: hoy solo `local`; un adaptador S3/R2 se elige aquí por MEDIA_STORAGE.
    { provide: MEDIA_STORAGE, inject: [APP_SETTINGS], useFactory: (s: AppSettings) => new LocalMediaStorage(s.media.localDir) },
    PersistenceLifecycle,
  ],
  exports: [APP_SETTINGS, CLOCK, ID_GENERATOR, PERSISTENCE_BACKEND, UNIT_OF_WORK, CATALOG_REPOSITORY, PII_CIPHER, MEDIA_URL_RESOLVER, MEDIA_STORAGE],
})
export class PersistenceModule {}
