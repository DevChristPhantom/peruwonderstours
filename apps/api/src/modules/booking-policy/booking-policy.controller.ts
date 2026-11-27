import { Body, Controller, Get, Header, Inject, Post, Put, Query } from '@nestjs/common';
import { IsInt, IsObject, Min } from 'class-validator';
import type { RequestMeta } from '../../shared/application/audit.js';
import { ValidationError } from '../../shared/domain/domain-error.js';
import type { StaffActor } from '../identity/application/staff-auth.use-cases.js';
import { CurrentStaff, ReqMeta, StaffAuth } from '../identity/interface/staff-auth.guard.js';
import { BookingPolicyService, type PolicyLocale } from './booking-policy.service.js';
class PolicyRevisionDto {
  @IsInt() @Min(0) expectedRevision!: number;
}
class SavePolicyDto extends PolicyRevisionDto {
  @IsObject() translations!: Record<string, unknown>;
}
@Controller('booking-policy')
export class BookingPolicyPublicController {
  constructor(@Inject(BookingPolicyService) private readonly policies: BookingPolicyService) {}
  @Get() @Header('Cache-Control', 'no-store') @Header('X-Robots-Tag', 'noindex, nofollow')
  async get(@Query('locale') locale = 'es', @Query('version') version?: string) {
    if (!['es', 'en', 'pt'].includes(locale)) throw new ValidationError('unsupported-locale', 'Idioma no soportado.');
    return { data: await this.policies.current(locale as PolicyLocale, version) };
  }
}
@Controller('admin/booking-policy')
export class BookingPolicyAdminController {
  constructor(@Inject(BookingPolicyService) private readonly policies: BookingPolicyService) {}
  @Get() @StaffAuth('content:read') @Header('Cache-Control', 'private, no-store')
  async get() { return { data: await this.policies.editor() }; }
  @Post('publish') @StaffAuth('content:write')
  async publish(@CurrentStaff() actor: StaffActor, @ReqMeta() meta: RequestMeta, @Body() body: PolicyRevisionDto) {
    return { data: await this.policies.save(actor, meta, body.expectedRevision) };
  }
  @Put() @StaffAuth('content:write')
  async save(@CurrentStaff() actor: StaffActor, @ReqMeta() meta: RequestMeta, @Body() body: SavePolicyDto) {
    return { data: await this.policies.save(actor, meta, body.expectedRevision, body.translations) };
  }
}
