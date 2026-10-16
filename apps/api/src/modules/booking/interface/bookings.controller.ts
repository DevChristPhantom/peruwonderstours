import { Body, Controller, Get, Inject, Param, Post, Req, Res } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiHeader,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiProperty,
  ApiPropertyOptional,
  ApiTags,
  ApiTooManyRequestsResponse,
  ApiUnauthorizedResponse,
  ApiUnprocessableEntityResponse,
} from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  Equals,
  IsBoolean,
  IsEmail,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Matches,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import type { Request, Response } from 'express';
import { requestMeta } from '../../../shared/interface/request-meta.js';
import { money } from '../../../shared/interface/common.dto.js';
import { BookingToken, CartToken, IdempotencyKey } from '../../../shared/interface/http-params.js';
import { ProblemDetailsDto } from '../../../shared/interface/problem-details.dto.js';
import { StrictThrottle } from '../../../shared/interface/throttling.js';
import { BookingResponseDto, CreatedBookingResponseDto } from './booking.responses.js';
import { BookingUseCases } from '../application/booking.use-cases.js';
import type { Booking } from '../domain/booking.js';
import type { PaymentOption } from '../domain/payment-plan.js';
import { Money } from '../../../shared/domain/money.js';
import { CLOCK } from '../../../shared/application/tokens.js';
import type { Clock } from '../../../shared/domain/ports.js';

export class CheckoutCustomerDto {
  @ApiPropertyOptional({ example: '+51924278597' })
  @IsOptional()
  @Matches(/^\+[1-9]\d{7,14}$/)
  phone?: string;
  @ApiProperty({ example: 'viajero@example.com' })
  @IsEmail()
  @MaxLength(254)
  email: string;

  @ApiProperty({ example: 'Ana' })
  @IsString()
  @Length(1, 100)
  firstName: string;

  @ApiProperty({ example: 'Quispe' })
  @IsString()
  @Length(1, 100)
  lastName: string;

  @ApiPropertyOptional({ example: 'PE', description: 'ISO 3166-1 alfa-2' })
  @IsOptional()
  @Matches(/^[A-Za-z]{2}$/)
  country?: string;
}

export class CheckoutDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  cartId: string;

  @ApiProperty({ enum: ['deposit', 'full'], description: 'deposit = adelanto (50 % por defecto); full = 100 %.' })
  @IsIn(['deposit', 'full'])
  paymentOption: PaymentOption;

  @ApiProperty({ type: CheckoutCustomerDto })
  @ValidateNested()
  @Type(() => CheckoutCustomerDto)
  customer: CheckoutCustomerDto;

  @ApiProperty({ description: 'Aceptación de términos y condiciones (obligatoria).' })
  @IsBoolean()
  @Equals(true, { message: 'Debes aceptar los términos y condiciones.' })
  acceptTerms: boolean;

  @ApiProperty({ description: 'Aceptación de la política de privacidad, Ley 29733 (obligatoria).' })
  @IsBoolean()
  @Equals(true, { message: 'Debes aceptar la política de privacidad.' })
  acceptPrivacyPolicy: boolean;

  @ApiPropertyOptional({ default: false, description: 'Consentimiento OPCIONAL de ofertas por correo (desmarcado por defecto).' })
  @IsOptional()
  @IsBoolean()
  marketingEmailOptIn?: boolean;

  @ApiPropertyOptional({ default: false, description: 'Consentimiento OPCIONAL de ofertas por WhatsApp/SMS (desmarcado por defecto).' })
  @IsOptional()
  @IsBoolean()
  marketingWhatsappOptIn?: boolean;

  @ApiPropertyOptional({ maxLength: 2000 })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  customerNotes?: string;

  @ApiPropertyOptional({ enum: ['es', 'en', 'pt'], description: 'Idioma de la reserva y de sus correos (por defecto el del carrito).' })
  @IsOptional()
  @IsIn(['es', 'en', 'pt'])
  locale?: 'es' | 'en' | 'pt';

  @ApiPropertyOptional({ description: 'Total que el cliente vio (céntimos). Si cambió => 409 total-changed.' })
  @IsOptional()
  @IsInt()
  @Min(1)
  expectedTotalAmount?: number;
}

/** Vista pública de la reserva: sin datos personales del cliente (Ley 29733). */
export function presentBooking(booking: Booking, now: Date) {
  const s = booking.toSnapshot();
  let nextPayment: { kind: string; amount: ReturnType<typeof money> } | null = null;
  try {
    const next = booking.nextPayment(now);
    nextPayment = { kind: next.kind, amount: money(next.amount) };
  } catch {
    nextPayment = null;
  }
  return {
    id: s.id,
    code: s.code,
    status: s.status,
    locale: s.locale,
    currency: s.currency,
    total: money(booking.total),
    paymentOption: s.paymentOption,
    depositPercent: s.depositPercent,
    deposit: money(booking.deposit),
    balance: money(Money.of(s.balanceAmount, s.currency)),
    balanceDueAt: s.balanceDueAt,
    paid: money(booking.paid),
    refunded: money(booking.refunded),
    outstanding: money(booking.outstanding),
    nextPayment,
    holdExpiresAt: s.holdExpiresAt,
    firstServiceDate: s.firstServiceDate,
    lastServiceDate: s.lastServiceDate,
    termsVersion: s.termsVersion,
    cancellationPolicyVersion: s.cancellationPolicyVersion,
    items: s.items.map((i) => ({
      id: i.id,
      tourId: i.tourId,
      tourTitle: i.tourTitle,
      departureId: i.departureId,
      travelDate: i.travelDate,
      paxCount: i.paxCount,
      status: i.status,
      subtotal: money(Money.of(i.subtotalAmount, i.currency)),
      pax: i.lines.map((l) => ({
        paxType: l.paxType,
        residency: l.residency,
        quantity: l.quantity,
        unitAmount: money(Money.of(l.unitAmount, i.currency)),
        lineAmount: money(Money.of(l.lineAmount, i.currency)),
      })),
    })),
    createdAt: s.createdAt,
  };
}

@ApiTags('bookings')
@Controller('bookings')
export class BookingsController {
  constructor(
    @Inject(BookingUseCases) private readonly bookings: BookingUseCases,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  @Post()
  @StrictThrottle()
  @ApiOperation({
    summary: 'Checkout desde el carrito: retiene cupo (hold), calcula el plan de pago y entrega el token de acceso del comprador.',
  })
  @ApiHeader({ name: 'Idempotency-Key', required: true, description: 'UUID u otro valor único por intento (8-100: letras, números, . _ : -).' })
  @ApiHeader({ name: 'X-Cart-Token', required: true })
  @ApiCreatedResponse({
    type: CreatedBookingResponseDto,
    description:
      'Reserva en estado `held` + `accessToken`. Repetir con la misma clave y X-Cart-Token devuelve 200 + `Idempotent-Replayed: true` con un token NUEVO (el anterior se invalida).',
  })
  @ApiOkResponse({ type: CreatedBookingResponseDto, description: 'Replay idempotente (cabecera Idempotent-Replayed: true).' })
  @ApiBadRequestResponse({ type: ProblemDetailsDto, description: 'validation-failed, idempotency-key-required, consent-required' })
  @ApiNotFoundResponse({ type: ProblemDetailsDto, description: 'cart-not-found (carrito inexistente o X-Cart-Token incorrecto)' })
  @ApiConflictResponse({ type: ProblemDetailsDto, description: 'sold-out, cart-has-issues, total-changed, cart-already-checked-out, idempotency-in-progress' })
  @ApiUnprocessableEntityResponse({ type: ProblemDetailsDto, description: 'deposit-not-available, idempotency-key-reused, currency-mismatch, cart-empty' })
  @ApiTooManyRequestsResponse({ type: ProblemDetailsDto })
  async checkout(
    @Body() body: CheckoutDto,
    @IdempotencyKey() idempotencyKey: string | undefined,
    @CartToken() cartToken: string | undefined,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.bookings.checkout({
      cartId: body.cartId,
      cartToken,
      idempotencyKey,
      paymentOption: body.paymentOption,
      customer: body.customer,
      acceptTerms: body.acceptTerms,
      acceptPrivacyPolicy: body.acceptPrivacyPolicy,
      marketingEmailOptIn: body.marketingEmailOptIn ?? false,
      marketingWhatsappOptIn: body.marketingWhatsappOptIn ?? false,
      meta: requestMeta(req),
      customerNotes: body.customerNotes ?? null,
      expectedTotalAmount: body.expectedTotalAmount !== undefined ? BigInt(body.expectedTotalAmount) : undefined,
      locale: body.locale,
    });
    if (result.replayed) {
      res.status(200).setHeader('Idempotent-Replayed', 'true');
    }
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('Location', `/api/v1/bookings/${result.booking.code}`);
    return { data: { ...presentBooking(result.booking, this.clock.now()), accessToken: result.accessToken } };
  }

  @Get(':code')
  @ApiOperation({ summary: 'Estado, montos y plan de pago de la reserva por su código (sin datos personales).' })
  @ApiParam({ name: 'code', example: 'PWT-2026-000123' })
  @ApiHeader({ name: 'X-Booking-Token', required: true, description: 'Token entregado en POST /bookings.' })
  @ApiOkResponse({ type: BookingResponseDto })
  @ApiUnauthorizedResponse({ type: ProblemDetailsDto, description: 'booking-token-required (falta la cabecera o formato inválido)' })
  @ApiNotFoundResponse({ type: ProblemDetailsDto, description: 'booking-not-found (genérico: código inexistente o token incorrecto)' })
  async get(@Param('code') code: string, @BookingToken() token: string | undefined, @Res({ passthrough: true }) res: Response) {
    res.setHeader('Cache-Control', 'no-store');
    return { data: presentBooking(await this.bookings.getByCode({ code, token }), this.clock.now()) };
  }
}
