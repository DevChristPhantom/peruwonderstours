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
  ApiTags,
  ApiTooManyRequestsResponse,
  ApiUnauthorizedResponse,
  ApiUnprocessableEntityResponse,
} from '@nestjs/swagger';
import type { Request, Response } from 'express';
import { Money } from '../../../shared/domain/money.js';
import { money } from '../../../shared/interface/common.dto.js';
import { ComplaintToken, IdempotencyKey } from '../../../shared/interface/http-params.js';
import { ProblemDetailsDto } from '../../../shared/interface/problem-details.dto.js';
import { StrictThrottle } from '../../../shared/interface/throttling.js';
import { ComplaintUseCases, type ComplaintView } from '../application/complaint.use-cases.js';
import { COMPLAINT_LEGAL_NOTICES, formatSheetNumber } from '../domain/complaint.js';
import { ComplaintReceiptResponseDto, ComplaintSheetResponseDto, SubmitComplaintDto } from './complaint.dto.js';

function presentSheet({ complaint: c, consumerDocNumber, consumerPhone, guardianPhone }: ComplaintView) {
  return {
    code: c.code,
    sheetNumber: formatSheetNumber(c.year, c.sequence),
    status: c.status,
    submittedAt: c.submittedAt,
    responseDueAt: c.responseDueAt,
    provider: { ...c.provider },
    consumer: {
      fullName: c.consumer.fullName,
      docType: c.consumer.docType,
      docNumber: consumerDocNumber,
      address: c.consumer.address,
      phone: consumerPhone,
      email: c.consumer.email,
      isMinor: c.consumer.isMinor,
    },
    guardian: c.guardian ? { fullName: c.guardian.fullName, address: c.guardian.address, phone: guardianPhone, email: c.guardian.email } : null,
    good: {
      type: c.good.type,
      description: c.good.description,
      claimedAmount: c.good.claimedAmount !== null && c.good.currency ? money(Money.of(c.good.claimedAmount, c.good.currency)) : null,
    },
    declaredType: c.declaredType,
    type: c.type,
    detail: c.detail,
    consumerRequest: c.consumerRequest,
    responseChannel: c.responseChannel,
    conformityAcceptedAt: c.conformityAcceptedAt,
    legalNotices: [...COMPLAINT_LEGAL_NOTICES],
    answer: c.responseText && c.responseSentAt ? { text: c.responseText, sentAt: c.responseSentAt } : null,
  };
}

@ApiTags('complaints')
@Controller('complaints')
export class ComplaintsController {
  constructor(@Inject(ComplaintUseCases) private readonly complaints: ComplaintUseCases) {}

  @Post()
  @StrictThrottle()
  @ApiOperation({
    summary: 'Registrar una hoja del Libro de Reclamaciones (sin cuenta). Devuelve la constancia con fecha/hora, número y vencimiento.',
  })
  @ApiHeader({ name: 'Idempotency-Key', required: true, description: 'Una sola hoja ante doble envío (8-100: letras, números, . _ : -).' })
  @ApiCreatedResponse({ type: ComplaintReceiptResponseDto, description: 'Mismo cuerpo + misma clave => 200, misma hoja, token NUEVO.' })
  @ApiOkResponse({ type: ComplaintReceiptResponseDto, description: 'Replay idempotente (Idempotent-Replayed: true).' })
  @ApiBadRequestResponse({ type: ProblemDetailsDto, description: 'validation-failed (con `errors` por campo), idempotency-key-required' })
  @ApiConflictResponse({ type: ProblemDetailsDto, description: 'idempotency-in-progress' })
  @ApiUnprocessableEntityResponse({ type: ProblemDetailsDto, description: 'idempotency-key-reused' })
  @ApiTooManyRequestsResponse({ type: ProblemDetailsDto })
  async submit(
    @Body() body: SubmitComplaintDto,
    @IdempotencyKey() idempotencyKey: string | undefined,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.complaints.submit({
      idempotencyKey,
      ip: req.ip ?? null,
      bookingCode: body.bookingCode ?? null,
      draft: {
        consumer: {
          fullName: body.consumer.fullName,
          docType: body.consumer.docType,
          docNumber: body.consumer.docNumber,
          address: body.consumer.address,
          phone: body.consumer.phone,
          email: body.consumer.email,
          isMinor: body.consumer.isMinor,
        },
        guardian: body.guardian
          ? { fullName: body.guardian.fullName, address: body.guardian.address, phone: body.guardian.phone, email: body.guardian.email }
          : null,
        good: {
          type: body.good.type,
          description: body.good.description,
          claimedAmount: body.good.claimedAmount !== undefined ? BigInt(body.good.claimedAmount) : null,
          currency: body.good.currency ?? null,
        },
        declaredType: body.declaredType,
        detail: body.detail,
        consumerRequest: body.consumerRequest,
        responseChannel: body.responseChannel,
        conformityAccepted: body.conformityAccepted,
      },
    });
    if (result.replayed) res.status(200).setHeader('Idempotent-Replayed', 'true');
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('Location', `/api/v1/complaints/${result.complaint.code}`);
    const c = result.complaint;
    return {
      data: {
        code: c.code,
        sheetNumber: formatSheetNumber(c.year, c.sequence),
        createdAt: c.submittedAt,
        responseDueAt: c.responseDueAt,
        accessToken: result.accessToken,
      },
    };
  }

  @Get(':code')
  @ApiOperation({ summary: 'Hoja de reclamación completa para su titular (constancia imprimible).' })
  @ApiParam({ name: 'code', example: 'LR-2026-000045' })
  @ApiHeader({ name: 'X-Complaint-Token', required: true, description: 'Token entregado en POST /complaints.' })
  @ApiOkResponse({ type: ComplaintSheetResponseDto })
  @ApiUnauthorizedResponse({ type: ProblemDetailsDto, description: 'complaint-token-required' })
  @ApiNotFoundResponse({ type: ProblemDetailsDto, description: 'complaint-not-found (genérico: código inexistente o token incorrecto)' })
  async get(@Param('code') code: string, @ComplaintToken() token: string | undefined, @Res({ passthrough: true }) res: Response) {
    res.setHeader('Cache-Control', 'no-store');
    return { data: presentSheet(await this.complaints.getByCode({ code, token })) };
  }
}
