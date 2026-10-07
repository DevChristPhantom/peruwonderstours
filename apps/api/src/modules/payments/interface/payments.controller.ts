import { Body, Controller, Get, Headers, HttpCode, Inject, Param, ParseUUIDPipe, Post, Res } from '@nestjs/common';
import { ApiBody, ApiCreatedResponse, ApiExcludeEndpoint, ApiHeader, ApiOkResponse, ApiOperation, ApiPropertyOptional, ApiTags } from '@nestjs/swagger';
import { IsIn, IsObject, IsOptional, IsUrl, MaxLength } from 'class-validator';
import type { Response } from 'express';
import { DomainError } from '../../../shared/domain/domain-error.js';
import { money } from '../../../shared/interface/common.dto.js';
import { IdempotencyKey, RawBody } from '../../../shared/interface/http-params.js';
import { PaymentUseCases } from '../application/payment.use-cases.js';
import type { Payment, PaymentMethod } from '../domain/payment.js';
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

@ApiTags('payments')
@Controller()
export class PaymentsController {
  constructor(@Inject(PaymentUseCases) private readonly payments: PaymentUseCases) {}

  @Post('bookings/:bookingId/payments')
  @ApiOperation({ summary: 'Iniciar el cobro que toca (adelanto, total o saldo) y obtener la acción siguiente (redirect/SDK).' })
  @ApiHeader({ name: 'Idempotency-Key', required: true })
  @ApiCreatedResponse({ description: '`{ data: { payment, nextAction } }`. Misma clave => mismo intento (200 + Idempotent-Replayed).' })
  async create(
    @Param('bookingId', new ParseUUIDPipe()) bookingId: string,
    @IdempotencyKey() idempotencyKey: string | undefined,
    @Body() body: CreatePaymentDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.payments.createPayment({ bookingId, idempotencyKey, method: body.method ?? null, returnUrl: body.returnUrl });
    if (result.replayed) res.status(200).setHeader('Idempotent-Replayed', 'true');
    return { data: { payment: presentPayment(result.payment), nextAction: result.nextAction } };
  }

  @Get('payments/:paymentId')
  @ApiOperation({ summary: 'Estado de un pago.' })
  async get(@Param('paymentId', new ParseUUIDPipe()) paymentId: string) {
    return { data: presentPayment(await this.payments.getPayment(paymentId)) };
  }

  @Post('payments/:paymentId/confirm')
  @HttpCode(200)
  @ApiOperation({ summary: 'Confirmar el cobro con la respuesta del formulario del proveedor (verificación servidor a servidor).' })
  async confirm(@Param('paymentId', new ParseUUIDPipe()) paymentId: string, @Body() body: ConfirmPaymentDto) {
    return { data: presentPayment(await this.payments.confirmPayment(paymentId, toStringRecord(body.confirmation))) };
  }

  @Post('payments/webhooks/:provider')
  @HttpCode(200)
  @ApiOperation({ summary: 'Webhook del proveedor (firma HMAC sobre el cuerpo crudo; idempotente por eventId).' })
  @ApiBody({ description: 'Payload del proveedor (sandbox: `{ id, type, created, data: { providerPaymentId, status, amount, currency } }`).' })
  @ApiOkResponse({ description: '`{ received: true, status: processed|duplicate|ignored|failed }`' })
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
      message: 'Pasarela simulada: confirma con POST /api/v1/payments/{paymentId}/confirm.',
    };
  }
}
