import { Module } from '@nestjs/common';
import { APP_SETTINGS, type AppSettings } from '../../config/app-settings.js';
import type { PiiCipher } from '../../shared/application/pii-cipher.js';
import { CLOCK, ID_GENERATOR, PII_CIPHER, UNIT_OF_WORK } from '../../shared/application/tokens.js';
import type { UnitOfWork } from '../../shared/application/unit-of-work.js';
import type { Clock, IdGenerator } from '../../shared/domain/ports.js';
import { ContentUseCases } from './application/content.use-cases.js';
import { SiteContentService } from './application/site-content.service.js';
import { ContentController } from './interface/content.controllers.js';

/** Contenido público (Sprint 3): blog, testimonios, contacto y contenido institucional. */
@Module({
  controllers: [ContentController],
  providers: [
    {
      provide: ContentUseCases,
      inject: [UNIT_OF_WORK, CLOCK, ID_GENERATOR, PII_CIPHER, APP_SETTINGS],
      useFactory: (uow: UnitOfWork, clock: Clock, ids: IdGenerator, cipher: PiiCipher, s: AppSettings) =>
        new ContentUseCases(uow, clock, ids, cipher, { privacyNoticeVersion: s.contact.privacyNoticeVersion }),
    },
    { provide: SiteContentService, inject: [APP_SETTINGS], useFactory: (s: AppSettings) => new SiteContentService(s.seedDataDir) },
  ],
})
export class ContentModule {}
