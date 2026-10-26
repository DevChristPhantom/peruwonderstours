import { Body, Controller, Delete, Get, Header, HttpCode, Inject, Param, ParseUUIDPipe, Patch, Post, Put, Query } from '@nestjs/common';
import { ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';
import type { RequestMeta } from '../../../shared/application/audit.js';
import { ValidationError } from '../../../shared/domain/domain-error.js';
import type { ContentLocale } from '../../../shared/domain/i18n.js';
import type { StaffActor } from '../../identity/application/staff-auth.use-cases.js';
import { CurrentStaff, ReqMeta, StaffAuth } from '../../identity/interface/staff-auth.guard.js';
import { PromotionsService } from '../application/promotions.service.js';
import { CreatePromotionDto, PromotionLocaleQueryDto, PromotionVersionDto, UpdatePromotionDto, VersionedPromotionTranslationDto } from './promotions.dto.js';

const uuid = () => new ParseUUIDPipe();

function locale(value: string): ContentLocale {
  if (value !== 'es' && value !== 'en' && value !== 'pt') throw new ValidationError('unsupported-locale', 'Idioma no soportado (es | en | pt).');
  return value;
}

/** Eventos vigentes para la home (sección «Lo más relevante» y anuncio emergente). */
@ApiTags('eventos')
@Controller('promotions')
export class PromotionsPublicController {
  constructor(@Inject(PromotionsService) private readonly promotions: PromotionsService) {}

  @Get()
  @Header('Cache-Control', 'public, max-age=60, stale-while-revalidate=300')
  @ApiOperation({ summary: 'Eventos publicados y dentro de su ventana de difusión, por orden.' })
  async list(@Query() q: PromotionLocaleQueryDto) {
    return { data: await this.promotions.listLive(q.locale) };
  }
}

@ApiTags('admin: eventos')
@Controller('admin/promotions')
export class PromotionsAdminController {
  constructor(@Inject(PromotionsService) private readonly promotions: PromotionsService) {}

  @Get()
  @StaffAuth('content:read')
  async list() {
    return { data: await this.promotions.list() };
  }

  @Get(':id')
  @StaffAuth('content:read')
  async get(@Param('id', uuid()) id: string) {
    return { data: await this.promotions.get(id) };
  }

  @Post()
  @StaffAuth('content:write')
  @ApiOperation({ summary: 'Crea un evento en borrador con su versión en español.' })
  async create(@CurrentStaff() a: StaffActor, @ReqMeta() m: RequestMeta, @Body() body: CreatePromotionDto) {
    return { data: await this.promotions.create(a, m, body) };
  }

  @Patch(':id')
  @StaffAuth('content:write')
  async update(@CurrentStaff() a: StaffActor, @ReqMeta() m: RequestMeta, @Param('id', uuid()) id: string, @Body() body: UpdatePromotionDto) {
    const { version, ...fields } = body;
    return { data: await this.promotions.update(a, m, id, { ...fields, version }) };
  }

  @Put(':id/translations/:locale')
  @StaffAuth('content:write')
  @ApiParam({ name: 'locale', enum: ['es', 'en', 'pt'] })
  async upsertTranslation(@CurrentStaff() a: StaffActor, @ReqMeta() m: RequestMeta, @Param('id', uuid()) id: string, @Param('locale') loc: string, @Body() body: VersionedPromotionTranslationDto) {
    return { data: await this.promotions.upsertTranslation(a, m, id, locale(loc), body) };
  }

  @Delete(':id/translations/:locale')
  @StaffAuth('content:write')
  @ApiParam({ name: 'locale', enum: ['en', 'pt'] })
  async deleteTranslation(@CurrentStaff() a: StaffActor, @ReqMeta() m: RequestMeta, @Param('id', uuid()) id: string, @Param('locale') loc: string, @Body() body: PromotionVersionDto) {
    return { data: await this.promotions.deleteTranslation(a, m, id, locale(loc), body.version) };
  }

  @Post(':id/publish')
  @HttpCode(200)
  @StaffAuth('content:publish')
  async publish(@CurrentStaff() a: StaffActor, @ReqMeta() m: RequestMeta, @Param('id', uuid()) id: string, @Body() body: PromotionVersionDto) {
    return { data: await this.promotions.publish(a, m, id, body.version) };
  }

  @Post(':id/unpublish')
  @HttpCode(200)
  @StaffAuth('content:publish')
  async unpublish(@CurrentStaff() a: StaffActor, @ReqMeta() m: RequestMeta, @Param('id', uuid()) id: string, @Body() body: PromotionVersionDto) {
    return { data: await this.promotions.unpublish(a, m, id, body.version) };
  }

  @Post(':id/archive')
  @HttpCode(204)
  @StaffAuth('content:publish')
  async archive(@CurrentStaff() a: StaffActor, @ReqMeta() m: RequestMeta, @Param('id', uuid()) id: string, @Body() body: PromotionVersionDto) {
    await this.promotions.archive(a, m, id, body.version);
  }
}
