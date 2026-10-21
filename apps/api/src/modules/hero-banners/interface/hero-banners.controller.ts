import { Body, Controller, Delete, Get, Header, HttpCode, Inject, Param, Patch, Post, Res, UploadedFile, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { IsBoolean, IsIn, IsInt, IsOptional, IsString, Max, MaxLength, Min, MinLength } from 'class-validator';
import type { Response } from 'express';
import { StaffAuth } from '../../identity/interface/staff-auth.guard.js';
import { ValidationError } from '../../../shared/domain/domain-error.js';
import { HERO_BANNER_EFFECTS, HERO_BANNER_MAX_BYTES, HeroBannersService, type HeroBannerEffect } from '../application/hero-banners.service.js';

export const HERO_DOCUMENT_CSP = "sandbox allow-scripts; default-src 'none'; img-src data: blob:; style-src 'unsafe-inline'; script-src 'unsafe-inline'; connect-src 'none'; frame-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'";
export class UploadHeroBannerDto {
  @IsString() @MinLength(1) @MaxLength(120) title!: string;
  @IsOptional() @IsIn(HERO_BANNER_EFFECTS) effect?: HeroBannerEffect;
  @IsOptional() @IsIn(['true', 'false']) titleEmbedded?: string;
}
export class PatchHeroBannerDto {
  @IsInt() @Min(1) revision!: number;
  @IsOptional() @IsString() @MinLength(1) @MaxLength(120) title?: string;
  @IsOptional() @IsBoolean() enabled?: boolean;
  @IsOptional() @IsInt() @Min(0) @Max(999) sortOrder?: number;
  @IsOptional() @IsIn(HERO_BANNER_EFFECTS) effect?: HeroBannerEffect;
  @IsOptional() @IsBoolean() titleEmbedded?: boolean;
}
export class DeleteHeroBannerDto {
  @IsInt() @Min(1) revision!: number;
}
interface HtmlFile { buffer: Buffer; originalname: string }

@Controller('hero-banners')
export class HeroBannersPublicController {
  constructor(@Inject(HeroBannersService) private readonly banners: HeroBannersService) {}
  @Get()
  @Header('Cache-Control', 'no-store')
  async list() { return { data: await this.banners.list(true) }; }

  @Get(':id/poster')
  @Header('X-Content-Type-Options', 'nosniff')
  @Header('Cache-Control', 'no-store')
  async poster(@Param('id') id: string, @Res() response: Response) {
    const poster = await this.banners.poster(id);
    response.type(poster.mime).send(poster.buffer);
  }

  @Get(':id/document')
  @Header('Content-Security-Policy', HERO_DOCUMENT_CSP)
  @Header('X-Content-Type-Options', 'nosniff')
  @Header('Cache-Control', 'no-store')
  @Header('Content-Type', 'text/html; charset=utf-8')
  async document(@Param('id') id: string, @Res() response: Response) {
    response.send(await this.banners.document(id));
  }
}

@Controller('admin/hero-banners')
export class HeroBannersAdminController {
  constructor(@Inject(HeroBannersService) private readonly banners: HeroBannersService) {}
  @Get()
  @StaffAuth('tours:read')
  async list() { return { data: await this.banners.list() }; }
  @Get(':id/poster')
  @StaffAuth('tours:read')
  @Header('X-Content-Type-Options', 'nosniff')
  @Header('Cache-Control', 'private, no-store')
  async poster(@Param('id') id: string, @Res() response: Response) {
    const poster = await this.banners.poster(id, true);
    response.type(poster.mime).send(poster.buffer);
  }
  @Post()
  @HttpCode(201)
  @StaffAuth('media:upload', 'tours:write')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: HERO_BANNER_MAX_BYTES, files: 1, fields: 3, parts: 4 } }))
  async upload(@UploadedFile() file: HtmlFile | undefined, @Body() body: UploadHeroBannerDto) {
    if (!file?.buffer) throw new ValidationError('file-required', 'Adjunta la imagen o el archivo HTML en el campo file.');
    return { data: await this.banners.upload(file.buffer, file.originalname, body.title, body.effect, body.titleEmbedded === undefined ? undefined : body.titleEmbedded === 'true') };
  }
  @Patch(':id')
  @StaffAuth('tours:write')
  async patch(@Param('id') id: string, @Body() body: PatchHeroBannerDto) {
    return { data: await this.banners.patch(id, body) };
  }
  @Delete(':id')
  @HttpCode(204)
  @StaffAuth('tours:write')
  async remove(@Param('id') id: string, @Body() body: DeleteHeroBannerDto): Promise<void> {
    await this.banners.remove(id, body.revision);
  }
}
