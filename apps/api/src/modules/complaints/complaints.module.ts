import { Logger, Module } from '@nestjs/common';
import { APP_SETTINGS, type AppSettings } from '../../config/app-settings.js';
import { CLOCK, ID_GENERATOR, UNIT_OF_WORK } from '../../shared/application/tokens.js';
import type { UnitOfWork } from '../../shared/application/unit-of-work.js';
import type { Clock, IdGenerator } from '../../shared/domain/ports.js';
import { AesGcmPiiCipher, DEVELOPMENT_PII_KEY_BASE64 } from '../../shared/infrastructure/aes-gcm-pii-cipher.js';
import { ComplaintUseCases } from './application/complaint.use-cases.js';
import { ComplaintsController } from './interface/complaints.controller.js';

/** Libro de Reclamaciones virtual (E8). */
@Module({
  controllers: [ComplaintsController],
  providers: [
    {
      provide: ComplaintUseCases,
      inject: [UNIT_OF_WORK, CLOCK, ID_GENERATOR, APP_SETTINGS],
      useFactory: (uow: UnitOfWork, clock: Clock, ids: IdGenerator, settings: AppSettings) => {
        if (!settings.piiEncryptionKey) {
          new Logger('Complaints').warn('PII_ENCRYPTION_KEY no definida: se usa la clave de DESARROLLO (prohibida en producción).');
        }
        const cipher = AesGcmPiiCipher.fromBase64(settings.piiEncryptionKey ?? DEVELOPMENT_PII_KEY_BASE64);
        return new ComplaintUseCases(uow, clock, ids, cipher, settings.complaints);
      },
    },
  ],
})
export class ComplaintsModule {}
