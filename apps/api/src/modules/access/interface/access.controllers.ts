import { Body, Controller, Get, HttpCode, Inject, Param, Post, Query, Res } from '@nestjs/common';
import {
  ApiAcceptedResponse,
  ApiGoneResponse,
  ApiHeader,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiProperty,
  ApiPropertyOptional,
  ApiTags,
  ApiTooManyRequestsResponse,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsBoolean, IsEmail, IsIn, IsOptional, IsString, Length, Matches, MaxLength } from 'class-validator';
import type { Response } from 'express';
import { createParamDecorator, type ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';
import { CLOCK } from '../../../shared/application/tokens.js';
import type { Clock } from '../../../shared/domain/ports.js';
import { CONTENT_LOCALES, type ContentLocale } from '../../../shared/domain/i18n.js';
import { ProblemDetailsDto } from '../../../shared/interface/problem-details.dto.js';
import { LinkThrottle, StrictThrottle } from '../../../shared/interface/throttling.js';
import { presentBooking } from '../../booking/interface/bookings.controller.js';
import { PasswordlessAccessUseCases } from '../application/passwordless-access.use-cases.js';

/** Cabecera `X-Customer-Token`: sesión de cliente ("Mis reservas"). */
export const CustomerToken = createParamDecorator((_data: unknown, ctx: ExecutionContext) => {
  const value = ctx.switchToHttp().getRequest<Request>().headers['x-customer-token'];
  return Array.isArray(value) ? value[0] : value;
});

const ACCEPTED = { data: { status: 'accepted', message: 'Si los datos coinciden, enviaremos un enlace a tu correo en unos minutos.' } };

export class BookingAccessLinkDto {
  @ApiProperty({ example: 'PWT-2026-000123' })
  @IsString()
  @MaxLength(20)
  code: string;

  @ApiProperty({ example: 'viajero@example.com' })
  @IsEmail()
  @MaxLength(254)
  email: string;

  @ApiPropertyOptional({ enum: CONTENT_LOCALES, description: 'Idioma del correo y de la página de destino (por defecto el de la reserva).' })
  @IsOptional()
  @IsIn(CONTENT_LOCALES)
  locale?: ContentLocale;
}

export class ComplaintAccessLinkDto {
  @ApiProperty({ example: 'LR-2026-000045' })
  @IsString()
  @MaxLength(20)
  code: string;

  @ApiProperty()
  @IsEmail()
  @MaxLength(254)
  email: string;

  @ApiPropertyOptional({ enum: CONTENT_LOCALES })
  @IsOptional()
  @IsIn(CONTENT_LOCALES)
  locale?: ContentLocale;
}

export class CustomerLoginLinkDto {
  @ApiProperty()
  @IsEmail()
  @MaxLength(254)
  email: string;

  @ApiPropertyOptional({ enum: CONTENT_LOCALES })
  @IsOptional()
  @IsIn(CONTENT_LOCALES)
  locale?: ContentLocale;
}

export class ExchangeTokenDto {
  @ApiProperty({ description: 'Token del enlace (`?token=` de la URL del correo).' })
  @IsString()
  @Length(10, 100)
  @Matches(/^[A-Za-z0-9_-]+$/)
  token: string;
}

export class LogoutDto {
  @ApiPropertyOptional({ default: false, description: 'Cerrar todas las sesiones del cliente.' })
  @IsOptional()
  @Transform(({ value }: { value: unknown }) => value === true || value === 'true')
  @IsBoolean()
  all?: boolean;
}

// =============================================================================
// F0 / F0b — acceso a la reserva por enlace
// =============================================================================
@ApiTags('bookings')
@Controller('bookings/access-link')
export class BookingAccessLinkController {
  constructor(@Inject(PasswordlessAccessUseCases) private readonly access: PasswordlessAccessUseCases) {}

  @Post()
  @HttpCode(202)
  @LinkThrottle()
  @ApiOperation({
    summary:
      'Recuperar mi reserva: si código y correo coinciden, envía un enlace de un solo uso (30 min) a `/{locale}/reserva/acceso?token=`. Responde SIEMPRE 202 genérico.',
  })
  @ApiAcceptedResponse({ description: '`{ data: { status: "accepted", message } }` (igual exista o no la reserva).' })
  @ApiTooManyRequestsResponse({ type: ProblemDetailsDto })
  async request(@Body() body: BookingAccessLinkDto, @Res({ passthrough: true }) res: Response) {
    res.setHeader('Cache-Control', 'no-store');
    await this.access.requestBookingLink(body);
    return ACCEPTED;
  }

  @Post('exchange')
  @HttpCode(200)
  @StrictThrottle()
  @ApiOperation({ summary: 'Canjea el enlace (una sola vez) por un `accessToken` nuevo de la reserva (cabecera X-Booking-Token, 30 días).' })
  @ApiOkResponse({ description: '`{ data: { code, accessToken, expiresAt, locale } }`' })
  @ApiNotFoundResponse({ type: ProblemDetailsDto, description: 'access-link-not-found' })
  @ApiGoneResponse({ type: ProblemDetailsDto, description: 'access-link-expired (ya usado, vencido o revocado)' })
  async exchange(@Body() body: ExchangeTokenDto, @Res({ passthrough: true }) res: Response) {
    res.setHeader('Cache-Control', 'no-store');
    return { data: await this.access.exchangeBookingLink(body.token) };
  }
}

// =============================================================================
// F7 — consulta de la hoja de reclamación por enlace
// =============================================================================
@ApiTags('complaints')
@Controller('complaints/access-link')
export class ComplaintAccessLinkController {
  constructor(@Inject(PasswordlessAccessUseCases) private readonly access: PasswordlessAccessUseCases) {}

  @Post()
  @HttpCode(202)
  @LinkThrottle()
  @ApiOperation({ summary: 'Consulta de reclamo: si código y correo coinciden, envía un enlace de un solo uso a `/{locale}/libro-de-reclamaciones/consulta?token=`. Siempre 202.' })
  @ApiAcceptedResponse({ description: 'Respuesta genérica.' })
  async request(@Body() body: ComplaintAccessLinkDto, @Res({ passthrough: true }) res: Response) {
    res.setHeader('Cache-Control', 'no-store');
    await this.access.requestComplaintLink(body);
    return ACCEPTED;
  }

  @Post('exchange')
  @HttpCode(200)
  @StrictThrottle()
  @ApiOperation({ summary: 'Canjea el enlace por un `accessToken` de la hoja (cabecera X-Complaint-Token en GET /complaints/:code).' })
  @ApiNotFoundResponse({ type: ProblemDetailsDto, description: 'access-link-not-found' })
  @ApiGoneResponse({ type: ProblemDetailsDto, description: 'access-link-expired' })
  async exchange(@Body() body: ExchangeTokenDto, @Res({ passthrough: true }) res: Response) {
    res.setHeader('Cache-Control', 'no-store');
    return { data: await this.access.exchangeComplaintLink(body.token) };
  }
}

// =============================================================================
// F6 — cuenta de cliente sin contraseña
// =============================================================================
@ApiTags('customers')
@Controller('customers/login-link')
export class CustomerLoginLinkController {
  constructor(@Inject(PasswordlessAccessUseCases) private readonly access: PasswordlessAccessUseCases) {}

  @Post()
  @HttpCode(202)
  @LinkThrottle()
  @ApiOperation({ summary: '"Mis reservas": envía un enlace de un solo uso a `/{locale}/cuenta/acceso?token=` si el correo tiene reservas. Siempre 202.' })
  async request(@Body() body: CustomerLoginLinkDto, @Res({ passthrough: true }) res: Response) {
    res.setHeader('Cache-Control', 'no-store');
    await this.access.requestCustomerLink(body);
    return ACCEPTED;
  }

  @Post('exchange')
  @HttpCode(200)
  @StrictThrottle()
  @ApiOperation({ summary: 'Canjea el enlace por un token de sesión de cliente (opaco, 30 días, revocable). Enviarlo en `X-Customer-Token`.' })
  @ApiGoneResponse({ type: ProblemDetailsDto, description: 'access-link-expired' })
  async exchange(@Body() body: ExchangeTokenDto, @Res({ passthrough: true }) res: Response) {
    res.setHeader('Cache-Control', 'no-store');
    const r = await this.access.exchangeCustomerLink(body.token);
    return { data: { sessionToken: r.sessionToken, expiresAt: r.expiresAt, customer: presentCustomer(r.customer) } };
  }
}

function presentCustomer(c: { id: string; email: string; firstName: string; lastName: string; country: string | null; preferredLocale: ContentLocale }) {
  return { id: c.id, email: c.email, firstName: c.firstName, lastName: c.lastName, country: c.country, preferredLocale: c.preferredLocale };
}

@ApiTags('customers')
@ApiHeader({ name: 'X-Customer-Token', required: true, description: 'Token de sesión de POST /customers/login-link/exchange.' })
@ApiUnauthorizedResponse({ type: ProblemDetailsDto, description: 'customer-session-required' })
@Controller('me')
export class MeController {
  constructor(
    @Inject(PasswordlessAccessUseCases) private readonly access: PasswordlessAccessUseCases,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Perfil del cliente de la sesión.' })
  async me(@CustomerToken() token: string | undefined, @Res({ passthrough: true }) res: Response) {
    res.setHeader('Cache-Control', 'no-store');
    const session = await this.access.authenticate(token);
    return { data: { ...presentCustomer(session.customer), sessionExpiresAt: session.expiresAt } };
  }

  @Get('bookings')
  @ApiOperation({ summary: 'Mis reservas (más recientes primero; sin datos personales de terceros).' })
  async bookings(@CustomerToken() token: string | undefined, @Res({ passthrough: true }) res: Response, @Query('limit') limit?: string) {
    res.setHeader('Cache-Control', 'no-store');
    const session = await this.access.authenticate(token);
    const n = Math.min(Math.max(Number.parseInt(limit ?? '50', 10) || 50, 1), 100);
    const list = await this.access.myBookings(session, n);
    const now = this.clock.now();
    return { data: list.map((b) => presentBooking(b, now)) };
  }

  @Post('bookings/:code/access')
  @HttpCode(200)
  @ApiOperation({ summary: 'Token de acceso (X-Booking-Token) a una reserva propia, para abrir la página de la reserva o pagar el saldo.' })
  @ApiNotFoundResponse({ type: ProblemDetailsDto, description: 'booking-not-found (no existe o no es del cliente)' })
  async bookingAccess(@CustomerToken() token: string | undefined, @Param('code') code: string, @Res({ passthrough: true }) res: Response) {
    res.setHeader('Cache-Control', 'no-store');
    const session = await this.access.authenticate(token);
    return { data: await this.access.grantBookingAccess(session, code) };
  }

  @Post('logout')
  @HttpCode(204)
  @ApiOperation({ summary: 'Revoca la sesión actual (`all: true` revoca todas). Idempotente.' })
  async logout(@CustomerToken() token: string | undefined, @Body() body: LogoutDto) {
    await this.access.logout(token, body.all ?? false);
  }
}
