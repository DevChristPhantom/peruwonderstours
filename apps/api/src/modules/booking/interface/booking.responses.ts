import { ApiProperty } from '@nestjs/swagger';
import { MoneyDto } from '../../../shared/interface/common.dto.js';
import { PAX_TYPES, RESIDENCIES } from '../../catalog/domain/tour.js';
import { BOOKING_STATUSES } from '../domain/booking-status.js';

/** Esquemas de respuesta (solo documentación OpenAPI; el frontend genera tipos a partir de ellos). */

export class BookingPaxLineDto {
  @ApiProperty({ enum: PAX_TYPES }) paxType: string;
  @ApiProperty({ enum: RESIDENCIES }) residency: string;
  @ApiProperty({ type: 'integer' }) quantity: number;
  @ApiProperty({ type: MoneyDto }) unitAmount: MoneyDto;
  @ApiProperty({ type: MoneyDto }) lineAmount: MoneyDto;
}

export class BookingItemDto {
  @ApiProperty({ format: 'uuid' }) id: string;
  @ApiProperty({ format: 'uuid' }) tourId: string;
  @ApiProperty({ description: 'Título del tour congelado al reservar.' }) tourTitle: string;
  @ApiProperty({ format: 'uuid', nullable: true, type: String }) departureId: string | null;
  @ApiProperty({ format: 'date', example: '2026-11-10', description: 'Fecha de viaje (America/Lima).' }) travelDate: string;
  @ApiProperty({ type: 'integer' }) paxCount: number;
  @ApiProperty({ enum: ['active', 'cancelled'] }) status: string;
  @ApiProperty({ type: MoneyDto }) subtotal: MoneyDto;
  @ApiProperty({ type: [BookingPaxLineDto] }) pax: BookingPaxLineDto[];
}

export class NextPaymentDto {
  @ApiProperty({ enum: ['deposit', 'balance', 'full'] }) kind: string;
  @ApiProperty({ type: MoneyDto }) amount: MoneyDto;
}

/** Vista pública de la reserva: sin datos personales del cliente (Ley 29733). */
export class BookingDto {
  @ApiProperty({ format: 'uuid' }) id: string;
  @ApiProperty({ example: 'PWT-2026-000123', pattern: '^PWT-\\d{4}-\\d{6}$' }) code: string;
  @ApiProperty({ enum: BOOKING_STATUSES }) status: string;
  @ApiProperty({ enum: ['es', 'en', 'pt'] }) locale: string;
  @ApiProperty({ enum: ['PEN', 'USD'] }) currency: string;
  @ApiProperty({ type: MoneyDto }) total: MoneyDto;
  @ApiProperty({ enum: ['deposit', 'full'] }) paymentOption: string;
  @ApiProperty({ type: 'integer', example: 50 }) depositPercent: number;
  @ApiProperty({ type: MoneyDto }) deposit: MoneyDto;
  @ApiProperty({ type: MoneyDto }) balance: MoneyDto;
  @ApiProperty({ type: String, format: 'date-time', nullable: true }) balanceDueAt: string | null;
  @ApiProperty({ type: MoneyDto }) paid: MoneyDto;
  @ApiProperty({ type: MoneyDto }) refunded: MoneyDto;
  @ApiProperty({ type: MoneyDto }) outstanding: MoneyDto;
  @ApiProperty({ type: NextPaymentDto, nullable: true, description: 'Cobro que toca ahora; null si no hay nada que pagar.' })
  nextPayment: NextPaymentDto | null;
  @ApiProperty({ type: String, format: 'date-time', nullable: true, description: 'Fin de la retención de cupo (estado held).' })
  holdExpiresAt: string | null;
  @ApiProperty({ format: 'date' }) firstServiceDate: string;
  @ApiProperty({ format: 'date' }) lastServiceDate: string;
  @ApiProperty() termsVersion: string;
  @ApiProperty() cancellationPolicyVersion: string;
  @ApiProperty({ type: [BookingItemDto] }) items: BookingItemDto[];
  @ApiProperty({ format: 'date-time' }) createdAt: string;
}

export class CreatedBookingDto extends BookingDto {
  @ApiProperty({
    example: 'q3b0VnS9j1mJ8m2c3Qx0u7p6YwX4Z1aB2cD3eF4gH5i',
    description:
      'Token de acceso del comprador (43 caracteres base64url). Se entrega SOLO aquí: guárdalo del lado servidor y envíalo en ' +
      '`X-Booking-Token`. Un replay idempotente emite uno nuevo e invalida el anterior.',
  })
  accessToken: string;
}

export class BookingResponseDto {
  @ApiProperty({ type: BookingDto }) data: BookingDto;
}

export class CreatedBookingResponseDto {
  @ApiProperty({ type: CreatedBookingDto }) data: CreatedBookingDto;
}
