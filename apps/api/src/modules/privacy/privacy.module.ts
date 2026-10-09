import { createHmac } from 'node:crypto';
import { Global, Logger, Module } from '@nestjs/common';
import { APP_SETTINGS, type AppSettings } from '../../config/app-settings.js';
import type { PiiCipher } from '../../shared/application/pii-cipher.js';
import { CLOCK, ID_GENERATOR, PII_CIPHER, UNIT_OF_WORK } from '../../shared/application/tokens.js';
import type { UnitOfWork } from '../../shared/application/unit-of-work.js';
import type { Clock, IdGenerator } from '../../shared/domain/ports.js';
import { DEVELOPMENT_PII_KEY_BASE64 } from '../../shared/infrastructure/aes-gcm-pii-cipher.js';
import { PrivacyUseCases } from './application/privacy.use-cases.js';
import { PrivacyController } from './interface/privacy.controller.js';

/** Consentimientos v2 y baja de marketing por enlace firmado (Ley 29733). */
@Global()
@Module({
  controllers: [PrivacyController],
  providers: [
    {
      provide: PrivacyUseCases,
      inject: [UNIT_OF_WORK, CLOCK, ID_GENERATOR, PII_CIPHER, APP_SETTINGS],
      useFactory: (uow: UnitOfWork, clock: Clock, ids: IdGenerator, cipher: PiiCipher, settings: AppSettings) => {
        let secret = settings.privacy.marketingLinkSecret;
        if (!secret) {
          new Logger('Privacy').warn('MARKETING_LINK_SECRET no definida: secreto de DESARROLLO derivado (prohibido en producción).');
          secret = createHmac('sha256', settings.piiEncryptionKey ?? DEVELOPMENT_PII_KEY_BASE64).update('pwt:marketing-links:dev').digest('base64url');
        }
        return new PrivacyUseCases(uow, clock, ids, cipher, { ...settings.privacy, marketingLinkSecret: secret, publicWebBaseUrl: settings.mail.publicWebBaseUrl });
      },
    },
  ],
  exports: [PrivacyUseCases],
})
export class PrivacyModule {}
