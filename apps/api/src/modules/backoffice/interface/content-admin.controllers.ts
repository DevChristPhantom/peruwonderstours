import { Body, Controller, Delete, Get, Header, HttpCode, Inject, Param, ParseUUIDPipe, Patch, Post, Put, Query } from '@nestjs/common';
import { ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';
import type { RequestMeta } from '../../../shared/application/audit.js';
import { ValidationError } from '../../../shared/domain/domain-error.js';
import { assertCalendarDate, toLimaCalendarDate } from '../../../shared/domain/calendar-date.js';
import type { ContentLocale } from '../../../shared/domain/i18n.js';
import { pageMeta } from '../../../shared/interface/common.dto.js';
import type { StaffActor } from '../../identity/application/staff-auth.use-cases.js';
import { CurrentStaff, ReqMeta, StaffAuth } from '../../identity/interface/staff-auth.guard.js';
import { ContentAdminService } from '../application/content-admin.service.js';
import { PaymentsAdminService } from '../application/payments-admin.service.js';
import {
  BlogListQueryAdminDto,
  ContactListQueryDto,
  ContactStatusDto,
  CreateBlogPostDto,
  CreateTaxonomyDto,
  FeatureDto,
  ManualPaymentsQueryDto,
  ModerationNoteDto,
  PublishBlogPostDto,
  RejectTestimonialDto,
  ReorderDto,
  TestimonialListQueryAdminDto,
  UpdateBlogPostDto,
  UpdateTaxonomyDto,
  UpdateTestimonialDto,
  VersionBodyDto,
  VersionedBlogTranslationDto,
  VersionedTaxonomyTranslationDto,
  VoidPaymentDto,
} from './content-admin.dto.js';

const uuid = () => new ParseUUIDPipe();
const pg = (q: { page?: number; pageSize?: number }) => ({ page: q.page ?? 1, pageSize: q.pageSize ?? 20 });

function locale(value: string): ContentLocale {
  if (value !== 'es' && value !== 'en' && value !== 'pt') throw new ValidationError('unsupported-locale', 'Idioma no soportado (es | en | pt).');
  return value;
}

// =============================================================================
// Blog
// =============================================================================
@ApiTags('admin: blog')
@Controller('admin/blog-posts')
export class BlogAdminController {
  constructor(@Inject(ContentAdminService) private readonly content: ContentAdminService) {}

  @Get()
  @StaffAuth('content:read')
  async list(@Query() q: BlogListQueryAdminDto) {
    const p = pg(q);
    const r = await this.content.listPosts({ ...p, status: q.status, q: q.q });
    return { data: r.items, meta: pageMeta(p.page, p.pageSize, r.total) };
  }

  @Get(':id')
  @StaffAuth('content:read')
  async get(@Param('id', uuid()) id: string) {
    return { data: await this.content.getPost(id) };
  }

  @Post()
  @StaffAuth('content:write')
  @ApiOperation({ summary: 'Crea un artículo en borrador con su traducción `es`.' })
  async create(@CurrentStaff() a: StaffActor, @ReqMeta() m: RequestMeta, @Body() body: CreateBlogPostDto) {
    return { data: await this.content.createPost(a, m, body) };
  }

  @Patch(':id')
  @StaffAuth('content:write')
  async update(@CurrentStaff() a: StaffActor, @ReqMeta() m: RequestMeta, @Param('id', uuid()) id: string, @Body() body: UpdateBlogPostDto) {
    return { data: await this.content.updatePost(a, m, id, body) };
  }

  @Put(':id/translations/:locale')
  @StaffAuth('content:write')
  @ApiParam({ name: 'locale', enum: ['es', 'en', 'pt'] })
  async upsertTranslation(@CurrentStaff() a: StaffActor, @ReqMeta() m: RequestMeta, @Param('id', uuid()) id: string, @Param('locale') loc: string, @Body() body: VersionedBlogTranslationDto) {
    return { data: await this.content.upsertPostTranslation(a, m, id, locale(loc), body) };
  }

  @Delete(':id/translations/:locale')
  @StaffAuth('content:write')
  @ApiParam({ name: 'locale', enum: ['en'] })
  async deleteTranslation(@CurrentStaff() a: StaffActor, @ReqMeta() m: RequestMeta, @Param('id', uuid()) id: string, @Param('locale') loc: string, @Body() body: VersionBodyDto) {
    return { data: await this.content.deletePostTranslation(a, m, id, locale(loc), body.version) };
  }

  @Post(':id/publish')
  @HttpCode(200)
  @StaffAuth('content:publish')
  async publish(@CurrentStaff() a: StaffActor, @ReqMeta() m: RequestMeta, @Param('id', uuid()) id: string, @Body() body: PublishBlogPostDto) {
    return { data: await this.content.publishPost(a, m, id, body.version, body.publishedAt ? new Date(body.publishedAt) : undefined) };
  }

  @Post(':id/unpublish')
  @HttpCode(200)
  @StaffAuth('content:publish')
  async unpublish(@CurrentStaff() a: StaffActor, @ReqMeta() m: RequestMeta, @Param('id', uuid()) id: string, @Body() body: VersionBodyDto) {
    return { data: await this.content.unpublishPost(a, m, id, body.version) };
  }

  @Post(':id/archive')
  @HttpCode(204)
  @StaffAuth('content:publish')
  async archive(@CurrentStaff() a: StaffActor, @ReqMeta() m: RequestMeta, @Param('id', uuid()) id: string, @Body() body: VersionBodyDto) {
    await this.content.archivePost(a, m, id, body.version);
  }
}

// =============================================================================
// Testimonios
// =============================================================================
@ApiTags('admin: testimonios')
@Controller('admin/testimonials')
export class TestimonialsAdminController {
  constructor(@Inject(ContentAdminService) private readonly content: ContentAdminService) {}

  @Get()
  @StaffAuth('content:read')
  async list(@Query() q: TestimonialListQueryAdminDto) {
    const p = pg(q);
    const r = await this.content.listTestimonials({ ...p, status: q.status });
    return { data: r.items, meta: pageMeta(p.page, p.pageSize, r.total) };
  }

  @Post(':id/approve')
  @HttpCode(200)
  @StaffAuth('content:publish')
  async approve(@CurrentStaff() a: StaffActor, @ReqMeta() m: RequestMeta, @Param('id', uuid()) id: string, @Body() body: ModerationNoteDto) {
    return { data: await this.content.approveTestimonial(a, m, id, body.note) };
  }

  @Post(':id/reject')
  @HttpCode(200)
  @StaffAuth('content:publish')
  async reject(@CurrentStaff() a: StaffActor, @ReqMeta() m: RequestMeta, @Param('id', uuid()) id: string, @Body() body: RejectTestimonialDto) {
    return { data: await this.content.rejectTestimonial(a, m, id, body.note) };
  }

  @Patch(':id')
  @StaffAuth('content:write')
  async update(@CurrentStaff() a: StaffActor, @ReqMeta() m: RequestMeta, @Param('id', uuid()) id: string, @Body() body: UpdateTestimonialDto) {
    return { data: await this.content.updateTestimonial(a, m, id, body) };
  }

  @Post(':id/feature')
  @HttpCode(200)
  @StaffAuth('content:publish')
  @ApiOperation({ summary: '`featured: true|false` (solo aprobados).' })
  async feature(@CurrentStaff() a: StaffActor, @ReqMeta() m: RequestMeta, @Param('id', uuid()) id: string, @Body() body: FeatureDto) {
    return { data: await this.content.featureTestimonial(a, m, id, body.featured) };
  }

  @Delete(':id')
  @HttpCode(204)
  @StaffAuth('content:publish')
  @ApiOperation({ summary: 'Elimina el testimonio de forma definitiva (spam o pedido del autor).' })
  async remove(@CurrentStaff() a: StaffActor, @ReqMeta() m: RequestMeta, @Param('id', uuid()) id: string): Promise<void> {
    await this.content.deleteTestimonial(a, m, id);
  }
}

// =============================================================================
// Bandeja de contacto
// =============================================================================
@ApiTags('admin: contacto')
@Controller('admin/contact-messages')
export class ContactAdminController {
  constructor(@Inject(ContentAdminService) private readonly content: ContentAdminService) {}

  @Get()
  @StaffAuth('contact:read')
  @Header('Cache-Control', 'no-store')
  async list(@Query() q: ContactListQueryDto) {
    const p = pg(q);
    const r = await this.content.listContactMessages({ ...p, status: q.status });
    return { data: r.items, meta: Object.assign(pageMeta(p.page, p.pageSize, r.total), { counts: r.counts }) };
  }

  @Get(':id')
  @StaffAuth('contact:read')
  @Header('Cache-Control', 'no-store')
  @ApiOperation({ summary: 'Detalle con teléfono descifrado (lectura auditada).' })
  async get(@CurrentStaff() a: StaffActor, @ReqMeta() m: RequestMeta, @Param('id', uuid()) id: string) {
    return { data: await this.content.getContactMessage(a, m, id) };
  }

  @Post(':id/status')
  @HttpCode(200)
  @StaffAuth('contact:manage')
  @ApiOperation({ summary: 'new -> answered | archived; answered -> archived; archived -> new.' })
  async status(@CurrentStaff() a: StaffActor, @ReqMeta() m: RequestMeta, @Param('id', uuid()) id: string, @Body() body: ContactStatusDto) {
    return { data: await this.content.setContactStatus(a, m, id, body.status, body.internalNote) };
  }
}

// =============================================================================
// Destinos y categorías (mismo contrato)
// =============================================================================
function taxonomyController(kind: 'destination' | 'category', path: string, tag: string) {
  @ApiTags(tag)
  @Controller(path)
  class TaxonomyAdminController {
    constructor(@Inject(ContentAdminService) readonly content: ContentAdminService) {}

    @Get()
    @StaffAuth('content:read')
    async list() {
      return { data: await this.content.listTaxonomy(kind) };
    }

    @Get(':id')
    @StaffAuth('content:read')
    async get(@Param('id', uuid()) id: string) {
      return { data: await this.content.getTaxonomy(kind, id) };
    }

    @Post()
    @StaffAuth('content:write')
    async create(@CurrentStaff() a: StaffActor, @ReqMeta() m: RequestMeta, @Body() body: CreateTaxonomyDto) {
      return { data: await this.content.createTaxonomy(a, m, kind, body) };
    }

    @Post('reorder')
    @HttpCode(200)
    @StaffAuth('content:write')
    async reorder(@CurrentStaff() a: StaffActor, @ReqMeta() m: RequestMeta, @Body() body: ReorderDto) {
      return { data: await this.content.reorderTaxonomy(a, m, kind, body.items) };
    }

    @Patch(':id')
    @StaffAuth('content:write')
    async update(@CurrentStaff() a: StaffActor, @ReqMeta() m: RequestMeta, @Param('id', uuid()) id: string, @Body() body: UpdateTaxonomyDto) {
      return { data: await this.content.updateTaxonomy(a, m, kind, id, body) };
    }

    @Put(':id/translations/:locale')
    @StaffAuth('content:write')
    @ApiParam({ name: 'locale', enum: ['es', 'en', 'pt'] })
    async upsertTranslation(@CurrentStaff() a: StaffActor, @ReqMeta() m: RequestMeta, @Param('id', uuid()) id: string, @Param('locale') loc: string, @Body() body: VersionedTaxonomyTranslationDto) {
      return { data: await this.content.upsertTaxonomyTranslation(a, m, kind, id, locale(loc), body) };
    }

    @Delete(':id/translations/:locale')
    @StaffAuth('content:write')
    async deleteTranslation(@CurrentStaff() a: StaffActor, @ReqMeta() m: RequestMeta, @Param('id', uuid()) id: string, @Param('locale') loc: string, @Body() body: VersionBodyDto) {
      return { data: await this.content.deleteTaxonomyTranslation(a, m, kind, id, locale(loc), body.version) };
    }

    @Delete(':id')
    @HttpCode(204)
    @StaffAuth('content:publish')
    async remove(@CurrentStaff() a: StaffActor, @ReqMeta() m: RequestMeta, @Param('id', uuid()) id: string, @Body() body: VersionBodyDto) {
      await this.content.deleteTaxonomy(a, m, kind, id, body.version);
    }
  }
  return TaxonomyAdminController;
}

export const DestinationsAdminController = taxonomyController('destination', 'admin/destinations', 'admin: destinos');
export const CategoriesAdminController = taxonomyController('category', 'admin/categories', 'admin: categorías');

// =============================================================================
// Pagos manuales (ADR-0003)
// =============================================================================
@ApiTags('admin: pagos')
@Controller('admin')
export class PaymentsAdminController {
  constructor(@Inject(PaymentsAdminService) private readonly payments: PaymentsAdminService) {}

  @Get('manual-payments')
  @StaffAuth('dashboard:read')
  @Header('Cache-Control', 'no-store')
  @ApiOperation({ summary: 'Pagos manuales del día (Lima) por usuario: recibidos, reembolsados y anulados (contra-asientos).' })
  async manualPayments(@Query() q: ManualPaymentsQueryDto) {
    const date = q.date ? assertCalendarDate(q.date, 'date') : toLimaCalendarDate(new Date());
    return { data: await this.payments.manualPaymentsOfDay(date) };
  }

  @Post('bookings/:code/payments/:paymentId/void')
  @HttpCode(200)
  @StaffAuth('payments:void')
  @ApiOperation({ summary: 'SOLO admin: anula un pago manual con contra-asiento auditado (resta del pagado y retrocede el estado si corresponde).' })
  async void(@CurrentStaff() a: StaffActor, @ReqMeta() m: RequestMeta, @Param('code') code: string, @Param('paymentId', uuid()) paymentId: string, @Body() body: VoidPaymentDto) {
    return { data: await this.payments.voidManualPayment(a, m, code, paymentId, body.reason) };
  }
}
