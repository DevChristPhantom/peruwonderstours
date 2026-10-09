import { Body, Controller, Get, Headers, HttpCode, Inject, Param, ParseUUIDPipe, Post, Res } from '@nestjs/common';
import {
  ApiBody,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiExcludeEndpoint,
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
import { IsIn, IsObject, IsOptional, IsUrl, MaxLength } from 'class-validator';
import type { Response } from 'express';
import { APP_SETTINGS, type AppSettings } from '../../../config/app-settings.js';
import { DomainError, ValidationError } from '../../../shared/domain/domain-error.js';
import { money, MoneyDto } from '../../../shared/interface/common.dto.js';
import { BookingToken, IdempotencyKey, RawBody } from '../../../shared/interface/http-params.js';
import { ProblemDetailsDto } from '../../../shared/interface/problem-details.dto.js';
import { StrictThrottle } from '../../../shared/interface/throttling.js';
import { PaymentUseCases } from '../application/payment.use-cases.js';
import { StaffAuth } from '../../identity/interface/staff-auth.guard.js';
import { PAYMENT_STATUSES, type Payment, type PaymentMethod } from '../domain/payment.js';
import type { WebhookHeaders } from '../domain/payment-gateway.js';

const METHODS: PaymentMethod[] = ['card', 'yape', 'plin', 'pagoefectivo'];

export class CreatePaymentDto {
  @ApiPropertyOptional({ enum: METHODS })
  @IsOptional()
  @IsIn(METHODS)
  method?: PaymentMethod;

  @ApiPropertyOptional({ description: 'URL de retorno tras el formulario del proveedor.' })
  @IsOptional()
  @IsUrl({ require_tld: false, require_protocol: true, protocols: ['http', 'https'] })
  @MaxLength(500)
  returnUrl?: string;
}

export class ConfirmPaymentDto {
  @ApiPropertyOptional({
    description: 'Confirmación opaca del formulario del proveedor. En sandbox: `{ "simulate": "fail" }` simula rechazo.',
    example: { simulate: 'succeed' },
  })
  @IsOptional()
  @IsObject()
  confirmation?: Record<string, unknown>;
}

export function presentPayment(payment: Payment) {
  const s = payment.toSnapshot();
  return {
    id: s.id,
    bookingId: s.bookingId,
    kind: s.kind,
    provider: s.provider,
    method: s.method,
    status: s.status,
    amount: money(payment.amount),
    failureCode: s.failureCode,
    failureMessage: s.failureMessage,
    succeededAt: s.succeededAt,
    createdAt: s.createdAt,
  };
}

function toStringRecord(value: Record<string, unknown> | undefined): Record<string, string> {
  const entries = Object.entries(value ?? {});
  if (entries.length > 20 || entries.some(([k, v]) => typeof v !== 'string' || k.length > 64 || v.length > 4096)) {
    throw new DomainError('invalid-confirmation', 'La confirmación debe ser un objeto de hasta 20 textos.', 'validation');
  }
  return Object.fromEntries(entries) as Record<string, string>;
}

export class PaymentDto {
  @ApiProperty({ format: 'uuid' }) id: string;
  @ApiProperty({ format: 'uuid' }) bookingId: string;
  @ApiProperty({ enum: ['deposit', 'balance', 'full', 'refund'] }) kind: string;
  @ApiProperty({ enum: ['izipay', 'niubiz', 'mercadopago', 'culqi', 'manual', 'sandbox'] }) provider: string;
  @ApiProperty({ enum: ['card', 'yape', 'plin', 'pagoefectivo', 'bank_transfer', 'cash'], nullable: true, type: String }) method: string | null;
  @ApiProperty({ enum: PAYMENT_STATUSES }) status: string;
  @ApiProperty({ type: MoneyDto }) amount: MoneyDto;
  @ApiProperty({ type: String, nullable: true }) failureCode: string | null;
  @ApiProperty({ type: String, nullable: true }) failureMessage: string | null;
  @ApiProperty({ type: String, format: 'date-time', nullable: true }) succeededAt: string | null;
  @ApiProperty({ format: 'date-time' }) createdAt: string;
}

export class NextActionDto {
  @ApiProperty({ enum: ['redirect', 'sdk', 'none'] }) type: string;
  @ApiPropertyOptional({ description: 'Solo type=redirect.' }) url?: string;
  @ApiPropertyOptional({ description: 'Solo type=sdk.' }) token?: string;
}

export class CreatedPaymentDto {
  @ApiProperty({ type: PaymentDto }) payment: PaymentDto;
  @ApiProperty({ type: NextActionDto }) nextAction: NextActionDto;
}

export class CreatedPaymentResponseDto {
  @ApiProperty({ type: CreatedPaymentDto }) data: CreatedPaymentDto;
}

export class PaymentResponseDto {
  @ApiProperty({ type: PaymentDto }) data: PaymentDto;
}

export class PaymentListResponseDto {
  @ApiProperty({ type: [PaymentDto] }) data: PaymentDto[];
}

export class WebhookAckDto {
  @ApiProperty({ example: true }) received: boolean;
  @ApiProperty() eventId: string;
  @ApiProperty({ enum: ['processed', 'duplicate', 'ignored', 'failed'] }) status: string;
}

const BOOKING_TOKEN_HEADER = { name: 'X-Booking-Token', required: true, description: 'Token entregado en POST /bookings.' };
const BOOKING_CODE_PARAM = { name: 'code', example: 'PWT-2026-000123' };

@ApiTags('payments')
@Controller()
export class PaymentsController {
  constructor(
    @Inject(PaymentUseCases) private readonly payments: PaymentUseCases,
    @Inject(APP_SETTINGS) private readonly settings: AppSettings,
  ) {}

  /** H-16: la pasarela solo puede volver al sitio propio (evita redirecciones abiertas). */
  private assertReturnUrl(returnUrl: string | undefined): void {
    if (returnUrl === undefined) return;
    const allowed = new URL(this.settings.mail.publicWebBaseUrl).origin;
    let origin = '';
    try {
      origin = new URL(returnUrl).origin;
    } catch {
      origin = '';
    }
    if (origin !== allowed) {
      throw new ValidationError('invalid-return-url', `returnUrl debe estar bajo ${allowed}.`, { errors: [{ field: 'returnUrl', messages: ['Fuera del sitio permitido.'] }] });
    }
  }

  @Post('bookings/:code/payments')
  @StrictThrottle()
  @ApiOperation({ summary: 'Iniciar el cobro que toca (adelanto, total o saldo) y obtener la acción siguiente (redirect/SDK).' })
  @ApiParam(BOOKING_CODE_PARAM)
  @ApiHeader(BOOKING_TOKEN_HEADER)
  @ApiHeader({ name: 'Idempotency-Key', required: true })
  @ApiCreatedResponse({ type: CreatedPaymentResponseDto, description: 'Misma clave => mismo intento (200 + Idempotent-Replayed: true).' })
  @ApiOkResponse({ type: CreatedPaymentResponseDto, description: 'Replay idempotente.' })
  @ApiUnauthorizedResponse({ type: ProblemDetailsDto, description: 'booking-token-required' })
  @ApiNotFoundResponse({ type: ProblemDetailsDto, description: 'booking-not-found (genérico)' })
  @ApiConflictResponse({ type: ProblemDetailsDto, description: 'hold-expired, booking-already-paid, invalid-booking-state' })
  @ApiUnprocessableEntityResponse({ type: ProblemDetailsDto, description: 'idempotency-key-reused' })
  @ApiTooManyRequestsResponse({ type: ProblemDetailsDto })
  async create(
    @Param('code') code: string,
    @BookingToken() token: string | undefined,
    @IdempotencyKey() idempotencyKey: string | undefined,
    @Body() body: CreatePaymentDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    this.assertReturnUrl(body.returnUrl);
    const result = await this.payments.createPayment({ booking: { code, token }, idempotencyKey, method: body.method ?? null, returnUrl: body.returnUrl });
    if (result.replayed) res.status(200).setHeader('Idempotent-Replayed', 'true');
    res.setHeader('Cache-Control', 'no-store');
    return { data: { payment: presentPayment(result.payment), nextAction: result.nextAction } };
  }

  @Get('bookings/:code/payments')
  @ApiOperation({ summary: 'Pagos y reembolsos de la reserva.' })
  @ApiParam(BOOKING_CODE_PARAM)
  @ApiHeader(BOOKING_TOKEN_HEADER)
  @ApiOkResponse({ type: PaymentListResponseDto })
  @ApiUnauthorizedResponse({ type: ProblemDetailsDto, description: 'booking-token-required' })
  @ApiNotFoundResponse({ type: ProblemDetailsDto, description: 'booking-not-found (genérico)' })
  async list(@Param('code') code: string, @BookingToken() token: string | undefined, @Res({ passthrough: true }) res: Response) {
    res.setHeader('Cache-Control', 'no-store');
    return { data: (await this.payments.listPayments({ code, token })).map(presentPayment) };
  }

  @Get('bookings/:code/payments/:paymentId')
  @ApiOperation({ summary: 'Estado de un pago de la reserva.' })
  @ApiParam(BOOKING_CODE_PARAM)
  @ApiHeader(BOOKING_TOKEN_HEADER)
  @ApiOkResponse({ type: PaymentResponseDto })
  @ApiUnauthorizedResponse({ type: ProblemDetailsDto, description: 'booking-token-required' })
  @ApiNotFoundResponse({ type: ProblemDetailsDto, description: 'booking-not-found (genérico) o payment-not-found' })
  async get(
    @Param('code') code: string,
    @Param('paymentId', new ParseUUIDPipe()) paymentId: string,
    @BookingToken() token: string | undefined,
    @Res({ passthrough: true }) res: Response,
  ) {
    res.setHeader('Cache-Control', 'no-store');
    return { data: presentPayment(await this.payments.getPayment({ code, token }, paymentId)) };
  }

  @Post('bookings/:code/payments/:paymentId/confirm')
  @HttpCode(200)
  @StrictThrottle()
  @ApiOperation({ summary: 'Confirmar el cobro con la respuesta del formulario del proveedor (verificación servidor a servidor).' })
  @ApiParam(BOOKING_CODE_PARAM)
  @ApiHeader(BOOKING_TOKEN_HEADER)
  @ApiOkResponse({ type: PaymentResponseDto })
  @ApiUnauthorizedResponse({ type: ProblemDetailsDto, description: 'booking-token-required' })
  @ApiNotFoundResponse({ type: ProblemDetailsDto, description: 'booking-not-found (genérico) o payment-not-found' })
  @ApiConflictResponse({ type: ProblemDetailsDto, description: 'payment-not-started' })
  async confirm(
    @Param('code') code: string,
    @Param('paymentId', new ParseUUIDPipe()) paymentId: string,
    @BookingToken() token: string | undefined,
    @Body() body: ConfirmPaymentDto,
  ) {
    return { data: presentPayment(await this.payments.confirmPayment({ code, token }, paymentId, toStringRecord(body.confirmation))) };
  }

  @Post('admin/payments/reconcile')
  @HttpCode(200)
  @StaffAuth('payments:refund')
  @ApiOperation({ summary: 'H-01: concilia ya los intentos de cobro no terminales de más de 30 min (aplica, reembolsa o expira a las 24 h).' })
  async reconcile() {
    const now = Date.now();
    return { data: await this.payments.reconcileStalePayments({ staleBefore: new Date(now - 30 * 60_000), expireBefore: new Date(now - 24 * 3600_000) }) };
  }

  @Post('payments/webhooks/:provider')
  @HttpCode(200)
  @ApiOperation({ summary: 'Webhook del proveedor (firma HMAC sobre el cuerpo crudo; idempotente por eventId).' })
  @ApiBody({ description: 'Payload del proveedor (sandbox: `{ id, type, created, data: { providerPaymentId, status, amount, currency } }`).' })
  @ApiOkResponse({ type: WebhookAckDto })
  async webhook(@Param('provider') provider: string, @RawBody() rawBody: Buffer, @Headers() headers: WebhookHeaders) {
    const result = await this.payments.handleWebhook(provider, rawBody, headers);
    return { received: true, eventId: result.eventId, status: result.status };
  }

  /** Página mínima del checkout simulado (solo sandbox): evita un 404 al seguir el redirect. */
  @Get('sandbox/checkout/:providerPaymentId')
  @ApiExcludeEndpoint()
  sandboxCheckout(@Param('providerPaymentId') providerPaymentId: string) {
    return {
      sandbox: true,
      providerPaymentId,
      message: 'Pasarela simulada: confirma con POST /api/v1/bookings/{code}/payments/{paymentId}/confirm.',
    };
  }
}
