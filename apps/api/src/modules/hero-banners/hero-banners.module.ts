import { Module } from '@nestjs/common';
import { APP_SETTINGS, type AppSettings } from '../../config/app-settings.js';
import { HeroBannersService } from './application/hero-banners.service.js';
import { HeroBannersAdminController, HeroBannersPublicController } from './interface/hero-banners.controller.js';

@Module({
  controllers: [HeroBannersAdminController, HeroBannersPublicController],
  providers: [{ provide: HeroBannersService, inject: [APP_SETTINGS], useFactory: (settings: AppSettings) => new HeroBannersService(settings.media.localDir) }],
})
export class HeroBannersModule {}
