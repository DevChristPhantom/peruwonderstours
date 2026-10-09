import { Body, Controller, Get, Header, HttpCode, Inject, Post, Query } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiPropertyOptional, ApiProperty, ApiTags, ApiUnauthorizedResponse } from '@nestjs/swagger';
import { ArrayMaxSize, IsArray, IsIn, IsOptional, IsString, Length } from 'class-validator';
import type { RequestMeta } from '../../../shared/application/audit.js';
import { ProblemDetailsDto } from '../../../shared/interface/problem-details.dto.js';
import { StrictThrottle } from '../../../shared/interface/throttling.js';
import { ReqMeta } from '../../identity/interface/staff-auth.guard.js';
import { PrivacyUseCases } from '../application/privacy.use-cases.js';
import { MARKETING_PURPOSES, type MarketingPurpose } from '../domain/consent.js';

export class UnsubscribeQueryDto {
  @ApiProperty({ description: 'Token firmado del enlace de baja.' })
  @IsString()
  @Length(20, 1024)
  token: string;
}

export class UnsubscribeDto extends UnsubscribeQueryDto {
  @ApiPropertyOptional({ enum: MARKETING_PURPOSES, isArray: true, description: 'Por defecto, todas las finalidades del enlace.' })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(2)
  @IsIn(MARKETING_PURPOSES, { each: true })
  purposes?: MarketingPurpose[];
}

/**
 * Endpoints públicos de privacidad (sin cuenta). La baja de marketing es gratuita, inmediata
 * y tan simple como el alta (Ley 29733; Reglamento arts. 10.4 y 26.5).
 */
@ApiTags('privacy')
@Controller('privacy')
export class PrivacyController {
  constructor(@Inject(PrivacyUseCases) private readonly privacy: PrivacyUseCases) {}

  @Get('unsubscribe')
  @Header('Cache-Control', 'no-store')
  @ApiOperation({ summary: 'Estado de las finalidades de marketing del enlace de baja (para mostrar la página de confirmación).' })
  @ApiUnauthorizedResponse({ type: ProblemDetailsDto, description: 'invalid-unsubscribe-link' })
  async preview(@Query() query: UnsubscribeQueryDto) {
    return { data: await this.privacy.previewUnsubscribe(query.token) };
  }

  @Get('marketing-confirmation')
  @Header('Cache-Control', 'no-store')
  @ApiOperation({ summary: 'Doble opt-in (H-05): estado de las finalidades del enlace de confirmación.' })
  @ApiUnauthorizedResponse({ type: ProblemDetailsDto, description: 'invalid-confirmation-link (firma inválida o vencido: 7 días)' })
  async previewConfirmation(@Query() query: UnsubscribeQueryDto) {
    return { data: await this.privacy.previewConfirmation(query.token) };
  }

  @Post('marketing-confirmation')
  @HttpCode(200)
  @StrictThrottle()
  @Header('Cache-Control', 'no-store')
  @ApiOperation({ summary: 'Doble opt-in (H-05): el titular confirma el marketing pedido en el checkout. Idempotente.' })
  @ApiOkResponse({ description: '`{ data: { confirmed: [...], alreadyConfirmed: [...], notPending: [...] } }`' })
  @ApiUnauthorizedResponse({ type: ProblemDetailsDto, description: 'invalid-confirmation-link' })
  async confirm(@Body() body: UnsubscribeQueryDto, @ReqMeta() meta: RequestMeta) {
    return { data: await this.privacy.confirmMarketing(body.token, meta) };
  }

  @Post('unsubscribe')
  @HttpCode(200)
  @StrictThrottle()
  @Header('Cache-Control', 'no-store')
  @ApiOperation({ summary: 'Revoca el consentimiento de marketing (correo y/o WhatsApp) con el enlace firmado. Idempotente.' })
  @ApiOkResponse({ description: '`{ data: { revoked: [...], alreadyRevoked: [...] } }`' })
  @ApiUnauthorizedResponse({ type: ProblemDetailsDto, description: 'invalid-unsubscribe-link' })
  async unsubscribe(@Body() body: UnsubscribeDto, @ReqMeta() meta: RequestMeta) {
    return { data: await this.privacy.unsubscribe(body.token, body.purposes, meta) };
  }
}
