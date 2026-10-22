import { Body, Controller, Delete, Get, Header, Headers, HttpCode, Inject, Param, Patch, Post, Res, StreamableFile, UploadedFiles, UseInterceptors } from '@nestjs/common';
import { FileFieldsInterceptor } from '@nestjs/platform-express';
import type { Readable } from 'node:stream';
import { IsBoolean, IsIn, IsInt, IsOptional, IsString, Max, MaxLength, Min, MinLength } from 'class-validator';
import type { Request, Response } from 'express';
import { StaffAuth } from '../../identity/interface/staff-auth.guard.js';
import { ValidationError } from '../../../shared/domain/domain-error.js';
import { HERO_BANNER_EFFECTS, HERO_BANNER_MAX_BYTES, HeroBannersService, type HeroBannerEffect } from '../application/hero-banners.service.js';
import { HERO_VIDEO_MAX_BYTES } from '../application/hero-video.js';

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
type BannerFiles = { file?: HtmlFile[]; poster?: HtmlFile[] };
const uploadStorage = {
  _handleFile(_request: Request, file: { fieldname: string; originalname: string; stream: Readable }, callback: (error: Error | null, info?: { buffer: Buffer; size: number }) => void): void {
    void (async () => {
      const chunks: Buffer[] = []; let size = 0;
      const limit = file.fieldname === 'file' && /\.mp4$/i.test(file.originalname) ? HERO_VIDEO_MAX_BYTES : HERO_BANNER_MAX_BYTES;
      for await (const chunk of file.stream) {
        const bytes = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk as Uint8Array);
        size += bytes.length;
        if (size > limit) throw new ValidationError('banner-file-too-large', 'El video admite hasta 50 MB y su portada hasta 16 MB.');
        chunks.push(bytes);
      }
      callback(null, { buffer: Buffer.concat(chunks), size });
    })().catch((error: Error) => callback(error));
  },
  _removeFile(_request: Request, file: { buffer: Buffer }, callback: (error: Error | null) => void): void {
    file.buffer = Buffer.alloc(0); callback(null);
  },
};

async function videoResponse(banners: HeroBannersService, id: string, range: string | undefined, response: Response, includeInactive: boolean): Promise<StreamableFile | undefined> {
  const video = await banners.video(id, range, includeInactive);
  response.setHeader('Accept-Ranges', 'bytes');
  response.status(video.status);
  if (video.status === 416) {
    response.setHeader('Content-Range', `bytes */${video.size}`);
    response.setHeader('Content-Length', '0');
    return;
  }
  if (video.status === 206) response.setHeader('Content-Range', `bytes ${video.start}-${video.end}/${video.size}`);
  return new StreamableFile(video.stream, { type: 'video/mp4', length: video.end - video.start + 1 });
}

@Controller('hero-banners')
export class HeroBannersPublicController {
  constructor(@Inject(HeroBannersService) private readonly banners: HeroBannersService) {}
  @Get()
  @Header('Cache-Control', 'no-store')
  async list() {
    const records = await this.banners.list();
    return { data: records.filter(record => record.enabled), configured: records.length > 0 };
  }

  @Get(':id/poster')
  @Header('X-Content-Type-Options', 'nosniff')
  @Header('Cache-Control', 'no-store')
  async poster(@Param('id') id: string, @Res() response: Response) {
    const poster = await this.banners.poster(id);
    response.type(poster.mime).send(poster.buffer);
  }
  @Get(':id/video')
  @Header('Content-Type', 'video/mp4')
  @Header('X-Content-Type-Options', 'nosniff')
  @Header('Cache-Control', 'no-store')
  async video(@Param('id') id: string, @Headers('range') range: string | undefined, @Res({ passthrough: true }) response: Response) {
    return videoResponse(this.banners, id, range, response, false);
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
  @Get(':id/video')
  @StaffAuth('tours:read')
  @Header('Content-Type', 'video/mp4')
  @Header('X-Content-Type-Options', 'nosniff')
  @Header('Cache-Control', 'private, no-store')
  async video(@Param('id') id: string, @Headers('range') range: string | undefined, @Res({ passthrough: true }) response: Response) {
    return videoResponse(this.banners, id, range, response, true);
  }
  @Post()
  @HttpCode(201)
  @StaffAuth('media:upload', 'tours:write')
  @UseInterceptors(FileFieldsInterceptor([{ name: 'file', maxCount: 1 }, { name: 'poster', maxCount: 1 }], { storage: uploadStorage, limits: { fileSize: HERO_VIDEO_MAX_BYTES, files: 2, fields: 3, fieldSize: 1024, parts: 5 } }))
  async upload(@UploadedFiles() files: BannerFiles | undefined, @Body() body: UploadHeroBannerDto) {
    const file = files?.file?.[0];
    if (!file?.buffer) throw new ValidationError('file-required', 'Adjunta la imagen, el HTML o el video MP4 en el campo file.');
    return { data: await this.banners.upload(file.buffer, file.originalname, body.title, body.effect, body.titleEmbedded === undefined ? undefined : body.titleEmbedded === 'true', files?.poster?.[0]?.buffer) };
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
