import { Body, Controller, Get, Inject, Param, ParseUUIDPipe, Post, Res } from '@nestjs/common';
import { ApiConflictResponse, ApiCreatedResponse, ApiHeader, ApiOperation, ApiProperty, ApiPropertyOptional, ApiTags, ApiUnprocessableEntityResponse } from '@nestjs/swagger';
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
import type { Response } from 'express';
import { money } from '../../../shared/interface/common.dto.js';
import { CartToken, IdempotencyKey } from '../../../shared/interface/http-params.js';
import { BookingUseCases } from '../application/booking.use-cases.js';
import type { Booking } from '../domain/booking.js';
import type { PaymentOption } from '../domain/payment-plan.js';
import { Money } from '../../../shared/domain/money.js';
import { CLOCK } from '../../../shared/application/tokens.js';
import type { Clock } from '../../../shared/domain/ports.js';

export class CheckoutCustomerDto {
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

  @ApiPropertyOptional({ maxLength: 2000 })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  customerNotes?: string;

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
  @ApiOperation({ summary: 'Checkout desde el carrito: retiene cupo (hold) y calcula el plan de pago.' })
  @ApiHeader({ name: 'Idempotency-Key', required: true, description: 'UUID u otro valor único por intento (8-100 caracteres).' })
  @ApiHeader({ name: 'X-Cart-Token', required: true })
  @ApiCreatedResponse({ description: 'Reserva en estado `held`. Repetir con la misma clave devuelve 200 + `Idempotent-Replayed: true`.' })
  @ApiConflictResponse({ description: 'sold-out, cart-has-issues, total-changed, cart-already-checked-out, idempotency-in-progress' })
  @ApiUnprocessableEntityResponse({ description: 'deposit-not-available, idempotency-key-reused, currency-mismatch' })
  async checkout(
    @Body() body: CheckoutDto,
    @IdempotencyKey() idempotencyKey: string | undefined,
    @CartToken() cartToken: string | undefined,
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
      customerNotes: body.customerNotes ?? null,
      expectedTotalAmount: body.expectedTotalAmount !== undefined ? BigInt(body.expectedTotalAmount) : undefined,
    });
    if (result.replayed) {
      res.status(200).setHeader('Idempotent-Replayed', 'true');
    }
    res.setHeader('Location', `/api/v1/bookings/${result.booking.id}`);
    return { data: presentBooking(result.booking, this.clock.now()) };
  }

  @Get(':bookingId')
  @ApiOperation({ summary: 'Estado, montos y plan de pago de la reserva (sin datos personales).' })
  async get(@Param('bookingId', new ParseUUIDPipe()) bookingId: string) {
    return { data: presentBooking(await this.bookings.getById(bookingId), this.clock.now()) };
  }
}
