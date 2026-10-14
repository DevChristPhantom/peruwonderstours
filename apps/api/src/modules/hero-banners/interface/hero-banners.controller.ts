import { Body, Controller, Get, Header, HttpCode, Inject, Param, Patch, Post, Res, UploadedFile, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { IsBoolean, IsInt, IsOptional, IsString, Max, MaxLength, Min, MinLength } from 'class-validator';
import type { Response } from 'express';
import { StaffAuth } from '../../identity/interface/staff-auth.guard.js';
import { ValidationError } from '../../../shared/domain/domain-error.js';
import { HERO_BANNER_MAX_BYTES, HeroBannersService } from '../application/hero-banners.service.js';

export const HERO_DOCUMENT_CSP = "sandbox allow-scripts; default-src 'none'; img-src data: blob:; style-src 'unsafe-inline'; script-src 'unsafe-inline'; connect-src 'none'; frame-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'";
export class UploadHeroBannerDto {
  @IsString() @MinLength(1) @MaxLength(120) title!: string;
}
export class PatchHeroBannerDto {
  @IsInt() @Min(1) revision!: number;
  @IsOptional() @IsString() @MinLength(1) @MaxLength(120) title?: string;
  @IsOptional() @IsBoolean() enabled?: boolean;
  @IsOptional() @IsInt() @Min(0) @Max(999) sortOrder?: number;
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
  @Post()
  @HttpCode(201)
  @StaffAuth('media:upload', 'tours:write')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: HERO_BANNER_MAX_BYTES, files: 1, fields: 1, parts: 2 } }))
  async upload(@UploadedFile() file: HtmlFile | undefined, @Body() body: UploadHeroBannerDto) {
    if (!file?.buffer) throw new ValidationError('file-required', 'Adjunta el archivo HTML en el campo file.');
    return { data: await this.banners.upload(file.buffer, file.originalname, body.title) };
  }
  @Patch(':id')
  @StaffAuth('tours:write')
  async patch(@Param('id') id: string, @Body() body: PatchHeroBannerDto) {
    return { data: await this.banners.patch(id, body) };
  }
}
