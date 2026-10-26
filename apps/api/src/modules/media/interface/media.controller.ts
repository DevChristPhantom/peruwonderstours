import { Controller, HttpCode, Inject, Post, Query, UploadedFile, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBody, ApiConsumes, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { ValidationError } from '../../../shared/domain/domain-error.js';
import { ReqMeta, StaffAuth, CurrentStaff } from '../../identity/interface/staff-auth.guard.js';
import type { StaffActor } from '../../identity/application/staff-auth.use-cases.js';
import type { RequestMeta } from '../../../shared/application/audit.js';
import { MediaUploadService } from '../application/media-upload.service.js';

/** Archivo de multer (memoryStorage); tipado local para no depender de @types/multer. */
interface UploadedImageFile {
  buffer: Buffer;
  size: number;
  originalname: string;
  mimetype: string;
}

const PREFIXES = ['tours', 'destinations', 'categories', 'blog', 'promotions', 'uploads'] as const;

@ApiTags('admin: medios')
@Controller('admin/media')
export class MediaAdminController {
  constructor(@Inject(MediaUploadService) private readonly media: MediaUploadService) {}

  @Post()
  @HttpCode(201)
  @StaffAuth('media:upload')
  @UseInterceptors(FileInterceptor('file'))
  @ApiConsumes('multipart/form-data')
  @ApiBody({ schema: { type: 'object', required: ['file'], properties: { file: { type: 'string', format: 'binary' } } } })
  @ApiQuery({ name: 'folder', required: false, enum: PREFIXES })
  @ApiOperation({
    summary:
      'Sube una imagen (campo multipart `file`). Se valida el tipo REAL por magic bytes (JPEG, PNG, WebP, AVIF) y el tamaño (MEDIA_MAX_UPLOAD_MB). ' +
      'Devuelve `storageKey` (direccionada por contenido: subir dos veces la misma imagen no duplica) para usarla en POST /admin/tours/:id/media, portadas de destinos/categorías o del blog.',
  })
  async upload(@CurrentStaff() _actor: StaffActor, @ReqMeta() _meta: RequestMeta, @UploadedFile() file: UploadedImageFile | undefined, @Query('folder') folder?: string) {
    if (!file?.buffer) throw new ValidationError('file-required', 'Adjunta la imagen en el campo multipart "file".');
    const prefix = folder && (PREFIXES as readonly string[]).includes(folder) ? folder : 'uploads';
    const stored = await this.media.store(new Uint8Array(file.buffer), prefix);
    return {
      data: {
        storageKey: stored.storageKey,
        url: stored.url,
        contentType: stored.mime,
        size: stored.size,
        width: stored.width,
        height: stored.height,
        sha256: stored.sha256,
        created: stored.created,
      },
    };
  }
}
