import { Module } from '@nestjs/common';
import { MulterModule } from '@nestjs/platform-express';
import { APP_SETTINGS, type AppSettings } from '../../config/app-settings.js';
import { MEDIA_STORAGE, MEDIA_URL_RESOLVER } from '../../shared/application/tokens.js';
import { MediaUploadService } from './application/media-upload.service.js';
import type { MediaStorage, MediaUrlResolver } from './domain/media.js';
import { MediaAdminController } from './interface/media.controller.js';

/** Subida de imágenes del backoffice (A5). El servido público es /media/* (ver app.setup.ts). */
@Module({
  imports: [
    MulterModule.registerAsync({
      inject: [APP_SETTINGS],
      // Sin `dest` ni `storage` multer usa memoria; límite duro: corta el stream al superar el tamaño (413).
      useFactory: (s: AppSettings) => ({ limits: { fileSize: s.media.maxUploadBytes, files: 1, fields: 5, parts: 10 } }),
    }),
  ],
  controllers: [MediaAdminController],
  providers: [
    {
      provide: MediaUploadService,
      inject: [MEDIA_STORAGE, MEDIA_URL_RESOLVER, APP_SETTINGS],
      useFactory: (storage: MediaStorage, urls: MediaUrlResolver, s: AppSettings) => new MediaUploadService(storage, urls, s.media.maxUploadBytes),
    },
  ],
  exports: [MediaUploadService],
})
export class MediaModule {}
