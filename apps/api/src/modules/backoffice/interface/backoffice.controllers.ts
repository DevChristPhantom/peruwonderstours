import { Body, Controller, Delete, Get, Header, HttpCode, Inject, Param, ParseUUIDPipe, Patch, Post, Put, Query } from '@nestjs/common';
import { ApiConflictResponse, ApiHeader, ApiOperation, ApiParam, ApiTags, ApiUnprocessableEntityResponse } from '@nestjs/swagger';
import type { RequestMeta } from '../../../shared/application/audit.js';
import { BadRequestException } from '@nestjs/common';
import { pageMeta } from '../../../shared/interface/common.dto.js';
import { IdempotencyKey } from '../../../shared/interface/http-params.js';
import { ProblemDetailsDto } from '../../../shared/interface/problem-details.dto.js';
import type { Locale } from '../../catalog/domain/tour.js';
import type { StaffActor } from '../../identity/application/staff-auth.use-cases.js';
import { CurrentStaff, ReqMeta, StaffAuth } from '../../identity/interface/staff-auth.guard.js';
import { AuditQueryService } from '../application/audit-query.service.js';
import { BookingsAdminService } from '../application/bookings-admin.service.js';
import { ComplaintsAdminService } from '../application/complaints-admin.service.js';
import { DashboardService } from '../application/dashboard.service.js';
import { DeparturesAdminService } from '../application/departures-admin.service.js';
import { PricingAdminService } from '../application/pricing-admin.service.js';
import { PrivacyAdminService } from '../application/privacy-admin.service.js';
import { ToursAdminService } from '../application/tours-admin.service.js';
import {
  AuditQueryDto,
  BookingListQueryDto,
  BulkDeparturesDto,
  CancelBookingDto,
  ComplaintListQueryDto,
  ConsentHistoryQueryDto,
  CreateDsrDto,
  CreateTourDto,
  DepartureRangeQueryDto,
  DsrExtendDto,
  DsrListQueryDto,
  DsrRespondDto,
  DsrStatusDto,
  ManualPaymentDto,
  ManualRefundDto,
  MediaDto,
  RateDto,
  RateListQueryDto,
  ReclassifyComplaintDto,
  RespondComplaintDto,
  SeasonDto,
  SettlementAcceptanceDto,
  SettlementOfferDto,
  SettlementRejectionDto,
  TourListQueryDto,
  TranscriptionDto,
  TranslationDto,
  UpdateDepartureDto,
  UpdateMediaDto,
  UpdateRateDto,
  UpdateSeasonDto,
  UpdateTourDto,
  VersionDto,
} from './backoffice.dto.js';

const uuid = () => new ParseUUIDPipe();

function page(q: { page?: number; pageSize?: number }) {
  return { page: q.page ?? 1, pageSize: q.pageSize ?? 20 };
}

function paged<T>(q: { page: number; pageSize: number }, result: { total: number; items: T[] }) {
  return { data: result.items, meta: pageMeta(q.page, q.pageSize, result.total) };
}

function locale(value: string): Locale {
  if (value !== 'es' && value !== 'en') throw new BadRequestException('Idioma no soportado (es | en).');
  return value;
}

// =============================================================================
// Tablero
// =============================================================================
@ApiTags('admin: tablero')
@Controller('admin/dashboard')
@StaffAuth('dashboard:read')
export class DashboardController {
  constructor(@Inject(DashboardService) private readonly dashboard: DashboardService) {}

  @Get()
  @Header('Cache-Control', 'no-store')
  @ApiOperation({ summary: 'KPIs: ventas del día/mes, reservas por estado, saldos por vencer (7 días), reclamos por vencer, ocupación de salidas próximas (14 días).' })
  async get() {
    return { data: await this.dashboard.summary() };
  }
}

// =============================================================================
// Tours
// =============================================================================
@ApiTags('admin: tours')
@Controller('admin/tours')
export class ToursAdminController {
  constructor(@Inject(ToursAdminService) private readonly tours: ToursAdminService) {}

  @Get()
  @StaffAuth('tours:read')
  async list(@Query() query: TourListQueryDto) {
    const q = { ...page(query), status: query.status, q: query.q };
    return paged(q, await this.tours.list(q));
  }

  @Get(':id')
  @StaffAuth('tours:read')
  @ApiOperation({ summary: 'Detalle editable (traducciones, medios, destinos, `version`, checklist de publicación).' })
  async get(@Param('id', uuid()) id: string) {
    return { data: await this.tours.get(id) };
  }

  @Post()
  @StaffAuth('tours:write')
  @ApiOperation({ summary: 'Crea un tour en borrador.' })
  @ApiConflictResponse({ type: ProblemDetailsDto, description: 'tour-code-taken, tour-slug-taken' })
  async create(@CurrentStaff() actor: StaffActor, @ReqMeta() meta: RequestMeta, @Body() body: CreateTourDto) {
    return { data: await this.tours.create(actor, meta, body) };
  }

  @Patch(':id')
  @StaffAuth('tours:write')
  @ApiOperation({ summary: 'Edita campos del tour (bloqueo optimista: `version`).' })
  @ApiConflictResponse({ type: ProblemDetailsDto, description: 'tour-version-conflict ("Este tour fue modificado por <usuario>"), tour-code-taken, tour-slug-taken' })
  async update(@CurrentStaff() actor: StaffActor, @ReqMeta() meta: RequestMeta, @Param('id', uuid()) id: string, @Body() body: UpdateTourDto) {
    return { data: await this.tours.update(actor, meta, id, body) };
  }

  @Post(':id/publish')
  @HttpCode(200)
  @StaffAuth('tours:publish')
  @ApiOperation({ summary: 'Publica (exige traducción es con título, resumen e itinerario, y portada).' })
  @ApiUnprocessableEntityResponse({ type: ProblemDetailsDto, description: 'tour-not-publishable (con `errors` por campo)' })
  async publish(@CurrentStaff() actor: StaffActor, @ReqMeta() meta: RequestMeta, @Param('id', uuid()) id: string, @Body() body: VersionDto) {
    return { data: await this.tours.publish(actor, meta, id, body.version) };
  }

  @Post(':id/unpublish')
  @HttpCode(200)
  @StaffAuth('tours:publish')
  async unpublish(@CurrentStaff() actor: StaffActor, @ReqMeta() meta: RequestMeta, @Param('id', uuid()) id: string, @Body() body: VersionDto) {
    return { data: await this.tours.unpublish(actor, meta, id, body.version) };
  }

  @Post(':id/archive')
  @HttpCode(204)
  @StaffAuth('tours:publish')
  @ApiOperation({ summary: 'Borrado lógico (archiva). Rechaza si hay reservas activas con viaje futuro.' })
  async archive(@CurrentStaff() actor: StaffActor, @ReqMeta() meta: RequestMeta, @Param('id', uuid()) id: string, @Body() body: VersionDto) {
    await this.tours.archive(actor, meta, id, body.version);
  }

  @Put(':id/translations/:locale')
  @StaffAuth('tours:write')
  @ApiParam({ name: 'locale', enum: ['es', 'en'] })
  @ApiOperation({ summary: 'Crea o reemplaza una traducción. Cambiar el slug de un tour publicado crea un 301 automático.' })
  async upsertTranslation(
    @CurrentStaff() actor: StaffActor,
    @ReqMeta() meta: RequestMeta,
    @Param('id', uuid()) id: string,
    @Param('locale') loc: string,
    @Body() body: TranslationDto,
  ) {
    return { data: await this.tours.upsertTranslation(actor, meta, id, locale(loc), body) };
  }

  @Delete(':id/translations/:locale')
  @StaffAuth('tours:write')
  @ApiParam({ name: 'locale', enum: ['en'] })
  async deleteTranslation(@CurrentStaff() actor: StaffActor, @ReqMeta() meta: RequestMeta, @Param('id', uuid()) id: string, @Param('locale') loc: string, @Body() body: VersionDto) {
    return { data: await this.tours.deleteTranslation(actor, meta, id, locale(loc), body.version) };
  }

  @Post(':id/media')
  @StaffAuth('tours:write')
  @ApiOperation({ summary: 'Agrega un medio por URL/clave de almacenamiento (`isCover` reemplaza la portada).' })
  async addMedia(@CurrentStaff() actor: StaffActor, @ReqMeta() meta: RequestMeta, @Param('id', uuid()) id: string, @Body() body: MediaDto) {
    return { data: await this.tours.addMedia(actor, meta, id, body) };
  }

  @Patch(':id/media/:mediaId')
  @StaffAuth('tours:write')
  async updateMedia(
    @CurrentStaff() actor: StaffActor,
    @ReqMeta() meta: RequestMeta,
    @Param('id', uuid()) id: string,
    @Param('mediaId', uuid()) mediaId: string,
    @Body() body: UpdateMediaDto,
  ) {
    return { data: await this.tours.updateMedia(actor, meta, id, mediaId, body) };
  }

  @Delete(':id/media/:mediaId')
  @StaffAuth('tours:write')
  async deleteMedia(
    @CurrentStaff() actor: StaffActor,
    @ReqMeta() meta: RequestMeta,
    @Param('id', uuid()) id: string,
    @Param('mediaId', uuid()) mediaId: string,
    @Body() body: VersionDto,
  ) {
    return { data: await this.tours.deleteMedia(actor, meta, id, mediaId, body.version) };
  }
}

// =============================================================================
// Temporadas y tarifas
// =============================================================================
@ApiTags('admin: temporadas y tarifas')
@Controller('admin')
export class PricingAdminController {
  constructor(@Inject(PricingAdminService) private readonly pricing: PricingAdminService) {}

  @Get('seasons')
  @StaffAuth('pricing:read')
  async listSeasons() {
    return { data: await this.pricing.listSeasons() };
  }

  @Post('seasons')
  @StaffAuth('pricing:write')
  @ApiConflictResponse({ type: ProblemDetailsDto, description: 'season-code-taken' })
  async createSeason(@CurrentStaff() actor: StaffActor, @ReqMeta() meta: RequestMeta, @Body() body: SeasonDto) {
    return { data: await this.pricing.createSeason(actor, meta, body) };
  }

  @Patch('seasons/:id')
  @StaffAuth('pricing:write')
  async updateSeason(@CurrentStaff() actor: StaffActor, @ReqMeta() meta: RequestMeta, @Param('id', uuid()) id: string, @Body() body: UpdateSeasonDto) {
    return { data: await this.pricing.updateSeason(actor, meta, id, body) };
  }

  @Delete('seasons/:id')
  @HttpCode(204)
  @StaffAuth('pricing:write')
  @ApiConflictResponse({ type: ProblemDetailsDto, description: 'season-in-use' })
  async deleteSeason(@CurrentStaff() actor: StaffActor, @ReqMeta() meta: RequestMeta, @Param('id', uuid()) id: string) {
    await this.pricing.deleteSeason(actor, meta, id);
  }

  @Get('tours/:tourId/rates')
  @StaffAuth('pricing:read')
  async listRates(@Param('tourId', uuid()) tourId: string, @Query() query: RateListQueryDto) {
    return { data: await this.pricing.listRates(tourId, query.includeInactive ?? false) };
  }

  @Post('tours/:tourId/rates')
  @StaffAuth('pricing:write')
  @ApiOperation({ summary: 'Crea una tarifa por persona. Rechaza solapes de vigencia/grupo con otra tarifa activa de la misma combinación.' })
  @ApiConflictResponse({ type: ProblemDetailsDto, description: 'rate-overlap (indica la tarifa en conflicto), exclusion-violation' })
  async createRate(@CurrentStaff() actor: StaffActor, @ReqMeta() meta: RequestMeta, @Param('tourId', uuid()) tourId: string, @Body() body: RateDto) {
    return { data: await this.pricing.createRate(actor, meta, tourId, {
          seasonId: body.seasonId,
          paxType: body.paxType,
          residency: body.residency,
          currency: body.currency,
          amount: BigInt(body.amount),
          validFrom: body.validFrom,
          validTo: body.validTo,
          minGroupSize: body.minGroupSize,
          maxGroupSize: body.maxGroupSize,
          isActive: body.isActive,
        }) };
  }

  @Patch('rates/:id')
  @StaffAuth('pricing:write')
  @ApiConflictResponse({ type: ProblemDetailsDto, description: 'rate-overlap, concurrency-conflict' })
  async updateRate(@CurrentStaff() actor: StaffActor, @ReqMeta() meta: RequestMeta, @Param('id', uuid()) id: string, @Body() body: UpdateRateDto) {
    return { data: await this.pricing.updateRate(actor, meta, id, {
          version: body.version,
          seasonId: body.seasonId,
          paxType: body.paxType,
          residency: body.residency,
          currency: body.currency,
          amount: body.amount !== undefined ? BigInt(body.amount) : undefined,
          validFrom: body.validFrom,
          validTo: body.validTo,
          minGroupSize: body.minGroupSize,
          maxGroupSize: body.maxGroupSize,
          isActive: body.isActive,
        }) };
  }

  @Delete('rates/:id')
  @HttpCode(204)
  @StaffAuth('pricing:write')
  async deleteRate(@CurrentStaff() actor: StaffActor, @ReqMeta() meta: RequestMeta, @Param('id', uuid()) id: string) {
    await this.pricing.deleteRate(actor, meta, id);
  }
}

// =============================================================================
// Salidas
// =============================================================================
@ApiTags('admin: salidas y cupos')
@Controller('admin')
export class DeparturesAdminController {
  constructor(@Inject(DeparturesAdminService) private readonly departures: DeparturesAdminService) {}

  @Get('tours/:tourId/departures')
  @StaffAuth('departures:read')
  async list(@Param('tourId', uuid()) tourId: string, @Query() query: DepartureRangeQueryDto) {
    return { data: await this.departures.list(tourId, query) };
  }

  @Post('tours/:tourId/departures/bulk')
  @StaffAuth('departures:write')
  @ApiOperation({ summary: 'Genera salidas por rango de fechas (máx. 366 días) y días de semana. Omite las existentes (idempotente).' })
  async bulk(@CurrentStaff() actor: StaffActor, @ReqMeta() meta: RequestMeta, @Param('tourId', uuid()) tourId: string, @Body() body: BulkDeparturesDto) {
    return { data: await this.departures.bulkCreate(actor, meta, tourId, body) };
  }

  @Patch('departures/:id')
  @StaffAuth('departures:write')
  @ApiOperation({ summary: 'Edita capacidad o cierre de ventas (bloqueo optimista con `version`).' })
  @ApiUnprocessableEntityResponse({ type: ProblemDetailsDto, description: 'capacity-below-sold ("Hay N cupos vendidos")' })
  @ApiConflictResponse({ type: ProblemDetailsDto, description: 'concurrency-conflict' })
  async update(@CurrentStaff() actor: StaffActor, @ReqMeta() meta: RequestMeta, @Param('id', uuid()) id: string, @Body() body: UpdateDepartureDto) {
    return { data: await this.departures.update(actor, meta, id, body) };
  }

  @Post('departures/:id/close-sales')
  @HttpCode(200)
  @StaffAuth('departures:write')
  async close(@CurrentStaff() actor: StaffActor, @ReqMeta() meta: RequestMeta, @Param('id', uuid()) id: string, @Body() body: VersionDto) {
    return { data: await this.departures.setSalesClosed(actor, meta, id, body.version, true) };
  }

  @Post('departures/:id/reopen-sales')
  @HttpCode(200)
  @StaffAuth('departures:write')
  async reopen(@CurrentStaff() actor: StaffActor, @ReqMeta() meta: RequestMeta, @Param('id', uuid()) id: string, @Body() body: VersionDto) {
    return { data: await this.departures.setSalesClosed(actor, meta, id, body.version, false) };
  }

  @Delete('departures/:id')
  @HttpCode(204)
  @StaffAuth('departures:write')
  @ApiOperation({ summary: 'Elimina una salida sin ventas ni referencias (si no, ciérrala).' })
  async remove(@CurrentStaff() actor: StaffActor, @ReqMeta() meta: RequestMeta, @Param('id', uuid()) id: string, @Body() body: VersionDto) {
    await this.departures.delete(actor, meta, id, body.version);
  }
}

// =============================================================================
// Reservas
// =============================================================================
@ApiTags('admin: reservas')
@Controller('admin/bookings')
export class BookingsAdminController {
  constructor(@Inject(BookingsAdminService) private readonly bookings: BookingsAdminService) {}

  @Get()
  @StaffAuth('bookings:read')
  @ApiOperation({ summary: 'Listado con filtros: estado, fecha de viaje (primer servicio), prefijo de código y correo exacto.' })
  async list(@Query() query: BookingListQueryDto) {
    const q = { ...page(query), status: query.status, travelDateFrom: query.travelDateFrom, travelDateTo: query.travelDateTo, code: query.code, email: query.email };
    return paged(q, await this.bookings.list(q));
  }

  @Get(':code')
  @StaffAuth('bookings:read')
  @Header('Cache-Control', 'no-store')
  @ApiParam({ name: 'code', example: 'PWT-2026-000123' })
  @ApiOperation({ summary: 'Detalle: ítems, viajeros, pagos, historial, aceptaciones legales, correos enviados y cotización de cancelación.' })
  async detail(@Param('code') code: string) {
    return { data: await this.bookings.detail(code) };
  }

  @Get(':code/cancellation-quote')
  @StaffAuth('bookings:read')
  @ApiOperation({ summary: 'Reembolso según la política configurable (CANCELLATION_REFUND_TIERS).' })
  async quote(@Param('code') code: string) {
    return { data: await this.bookings.cancellationQuote(code) };
  }

  @Post(':code/cancel')
  @HttpCode(200)
  @StaffAuth('bookings:cancel')
  @ApiOperation({ summary: 'Cancela, libera cupos, fija el reembolso adeudado (política u override con motivo) y envía el correo de cancelación.' })
  @ApiConflictResponse({ type: ProblemDetailsDto, description: 'booking-not-cancellable' })
  async cancel(@CurrentStaff() actor: StaffActor, @ReqMeta() meta: RequestMeta, @Param('code') code: string, @Body() body: CancelBookingDto) {
    return {
      data: await this.bookings.cancel(actor, meta, code, {
        reason: body.reason,
        refundAmountOverride: body.refundAmountOverride !== undefined ? BigInt(body.refundAmountOverride) : undefined,
        overrideReason: body.overrideReason,
      }),
    };
  }

  @Post(':code/payments')
  @StaffAuth('payments:record')
  @ApiHeader({ name: 'Idempotency-Key', required: true })
  @ApiOperation({ summary: 'Registra un pago manual (efectivo/transferencia) con referencia. Idempotente.' })
  @ApiConflictResponse({ type: ProblemDetailsDto, description: 'payment-reference-taken, booking-not-payable, hold-expired' })
  @ApiUnprocessableEntityResponse({ type: ProblemDetailsDto, description: 'overpayment, insufficient-deposit, idempotency-key-reused' })
  async recordPayment(
    @CurrentStaff() actor: StaffActor,
    @ReqMeta() meta: RequestMeta,
    @Param('code') code: string,
    @IdempotencyKey() key: string | undefined,
    @Body() body: ManualPaymentDto,
  ) {
    return {
      data: await this.bookings.recordManualPayment(actor, meta, code, key, {
        amount: BigInt(body.amount),
        method: body.method,
        reference: body.reference,
        receivedAt: body.receivedAt ? new Date(body.receivedAt) : undefined,
        note: body.note,
      }),
    };
  }

  @Post(':code/refunds')
  @StaffAuth('payments:refund')
  @ApiHeader({ name: 'Idempotency-Key', required: true })
  @ApiOperation({ summary: 'Registra un reembolso manual contra un pago (no supera lo pagado neto).' })
  @ApiUnprocessableEntityResponse({ type: ProblemDetailsDto, description: 'refund-exceeds-paid, refund-exceeds-payment' })
  async recordRefund(
    @CurrentStaff() actor: StaffActor,
    @ReqMeta() meta: RequestMeta,
    @Param('code') code: string,
    @IdempotencyKey() key: string | undefined,
    @Body() body: ManualRefundDto,
  ) {
    return {
      data: await this.bookings.recordManualRefund(actor, meta, code, key, {
        amount: BigInt(body.amount),
        method: body.method,
        reference: body.reference,
        parentPaymentId: body.parentPaymentId,
        note: body.note,
      }),
    };
  }

  @Post(':code/resend-voucher')
  @HttpCode(202)
  @StaffAuth('bookings:resend-voucher')
  @ApiOperation({ summary: 'Encola el reenvío del voucher por correo.' })
  async resendVoucher(@CurrentStaff() actor: StaffActor, @ReqMeta() meta: RequestMeta, @Param('code') code: string) {
    return { data: await this.bookings.resendVoucher(actor, meta, code) };
  }
}

// =============================================================================
// Libro de Reclamaciones
// =============================================================================
@ApiTags('admin: libro de reclamaciones')
@Controller('admin/complaints')
export class ComplaintsAdminController {
  constructor(@Inject(ComplaintsAdminService) private readonly complaints: ComplaintsAdminService) {}

  @Get()
  @StaffAuth('complaints:read')
  @ApiOperation({ summary: 'Bandeja ordenada por vencimiento con semáforo (verde < 10, amarillo 10-12, rojo 13-15 días hábiles, vencido, suspendido por solución directa).' })
  async list(@Query() query: ComplaintListQueryDto) {
    const q = { ...page(query), status: query.status, type: query.type, light: query.trafficLight, code: query.code, channel: query.channel };
    return paged(q, await this.complaints.list(q));
  }

  @Post('transcriptions')
  @StaffAuth('complaints:manage')
  @ApiOperation({ summary: 'Transcribe una hoja del libro de respaldo físico (art. 4-A). Alerta si pasó más de 1 día calendario.' })
  @ApiConflictResponse({ type: ProblemDetailsDto, description: 'backup-sheet-already-transcribed' })
  async transcribe(@CurrentStaff() actor: StaffActor, @ReqMeta() meta: RequestMeta, @Body() body: TranscriptionDto) {
    return {
      data: await this.complaints.transcribe(actor, meta, {
        backupSheetNumber: body.backupSheetNumber,
        submittedAt: new Date(body.submittedAt),
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
          declaredType: body.declaredType ?? null,
          detail: body.detail,
          consumerRequest: body.consumerRequest,
          responseChannel: body.responseChannel,
        },
      }),
    };
  }

  @Get(':id')
  @StaffAuth('complaints:read')
  @Header('Cache-Control', 'no-store')
  @ApiOperation({ summary: 'Hoja completa con datos personales descifrados (la consulta queda en audit_log).' })
  async detail(@CurrentStaff() actor: StaffActor, @ReqMeta() meta: RequestMeta, @Param('id', uuid()) id: string) {
    return { data: await this.complaints.detail(actor, meta, id) };
  }

  @Post(':id/in-review')
  @HttpCode(200)
  @StaffAuth('complaints:respond')
  async inReview(@CurrentStaff() actor: StaffActor, @ReqMeta() meta: RequestMeta, @Param('id', uuid()) id: string) {
    return { data: await this.complaints.markInReview(actor, meta, id) };
  }

  @Post(':id/respond')
  @HttpCode(200)
  @StaffAuth('complaints:respond')
  @ApiOperation({ summary: 'Responde. Correo: se envía y `responseSentAt` se fija al entregarse. Carta: exige letterSentAt + letterDeliveryRef.' })
  @ApiConflictResponse({ type: ProblemDetailsDto, description: 'complaint-already-closed, complaint-settled' })
  async respond(@CurrentStaff() actor: StaffActor, @ReqMeta() meta: RequestMeta, @Param('id', uuid()) id: string, @Body() body: RespondComplaintDto) {
    return {
      data: await this.complaints.respond(actor, meta, id, {
        responseText: body.responseText,
        letterSentAt: body.letterSentAt ? new Date(body.letterSentAt) : undefined,
        letterDeliveryRef: body.letterDeliveryRef,
      }),
    };
  }

  @Post(':id/reclassify')
  @HttpCode(200)
  @StaffAuth('complaints:manage')
  @ApiOperation({ summary: 'Reclasifica queja <-> reclamo (conserva el tipo declarado; el plazo no cambia).' })
  async reclassify(@CurrentStaff() actor: StaffActor, @ReqMeta() meta: RequestMeta, @Param('id', uuid()) id: string, @Body() body: ReclassifyComplaintDto) {
    return { data: await this.complaints.reclassify(actor, meta, id, body) };
  }

  @Post(':id/settlement-offer')
  @HttpCode(200)
  @StaffAuth('complaints:manage')
  @ApiOperation({ summary: 'Solución directa (art. 6-A): envía la oferta; suspende el plazo hasta 5 días hábiles.' })
  async offer(@CurrentStaff() actor: StaffActor, @ReqMeta() meta: RequestMeta, @Param('id', uuid()) id: string, @Body() body: SettlementOfferDto) {
    return { data: await this.complaints.offerSettlement(actor, meta, id, body) };
  }

  @Post(':id/settlement-acceptance')
  @HttpCode(200)
  @StaffAuth('complaints:manage')
  @ApiOperation({ summary: 'Registra la aceptación expresa del consumidor (estado settled).' })
  @ApiConflictResponse({ type: ProblemDetailsDto, description: 'settlement-not-offered, settlement-already-resolved, settlement-expired' })
  async accept(@CurrentStaff() actor: StaffActor, @ReqMeta() meta: RequestMeta, @Param('id', uuid()) id: string, @Body() body: SettlementAcceptanceDto) {
    return { data: await this.complaints.acceptSettlement(actor, meta, id, { evidence: body.evidence, acceptedAt: body.acceptedAt ? new Date(body.acceptedAt) : undefined }) };
  }

  @Post(':id/settlement-rejection')
  @HttpCode(200)
  @StaffAuth('complaints:manage')
  @ApiOperation({ summary: 'Rechazo o silencio: el plazo se reanuda (vencimiento corrido por la suspensión, máx. 5 días hábiles).' })
  async reject(@CurrentStaff() actor: StaffActor, @ReqMeta() meta: RequestMeta, @Param('id', uuid()) id: string, @Body() body: SettlementRejectionDto) {
    return { data: await this.complaints.rejectSettlement(actor, meta, id, body) };
  }
}

// =============================================================================
// Protección de datos y auditoría
// =============================================================================
@ApiTags('admin: protección de datos')
@Controller('admin/privacy')
export class PrivacyAdminController {
  constructor(@Inject(PrivacyAdminService) private readonly privacy: PrivacyAdminService) {}

  @Get('requests')
  @StaffAuth('privacy:read')
  async list(@Query() query: DsrListQueryDto) {
    const q = { ...page(query), status: query.status, type: query.type, overdue: query.overdue };
    return paged(q, await this.privacy.list(q));
  }

  @Post('requests')
  @StaffAuth('privacy:manage')
  @ApiOperation({ summary: 'Registra una solicitud ARCO recibida (vencimiento en días hábiles según el tipo).' })
  async create(@CurrentStaff() actor: StaffActor, @ReqMeta() meta: RequestMeta, @Body() body: CreateDsrDto) {
    return { data: await this.privacy.create(actor, meta, {
          type: body.type,
          subjectName: body.subjectName,
          subjectEmail: body.subjectEmail,
          channel: body.channel,
          detail: body.detail,
          receivedAt: body.receivedAt ? new Date(body.receivedAt) : undefined,
        }) };
  }

  @Get('requests/:id')
  @StaffAuth('privacy:read')
  async get(@CurrentStaff() actor: StaffActor, @ReqMeta() meta: RequestMeta, @Param('id', uuid()) id: string) {
    return { data: await this.privacy.get(actor, meta, id) };
  }

  @Post('requests/:id/status')
  @HttpCode(200)
  @StaffAuth('privacy:manage')
  async status(@CurrentStaff() actor: StaffActor, @ReqMeta() meta: RequestMeta, @Param('id', uuid()) id: string, @Body() body: DsrStatusDto) {
    return { data: await this.privacy.setStatus(actor, meta, id, body) };
  }

  @Post('requests/:id/extend')
  @HttpCode(200)
  @StaffAuth('privacy:manage')
  @ApiOperation({ summary: 'Ampliación única por igual plazo (no aplica a información ni revocación).' })
  async extend(@CurrentStaff() actor: StaffActor, @ReqMeta() meta: RequestMeta, @Param('id', uuid()) id: string, @Body() body: DsrExtendDto) {
    return { data: await this.privacy.extend(actor, meta, id, body) };
  }

  @Post('requests/:id/respond')
  @HttpCode(200)
  @StaffAuth('privacy:manage')
  async respond(@CurrentStaff() actor: StaffActor, @ReqMeta() meta: RequestMeta, @Param('id', uuid()) id: string, @Body() body: DsrRespondDto) {
    return { data: await this.privacy.respond(actor, meta, id, body) };
  }

  @Get('consents')
  @StaffAuth('privacy:read')
  @Header('Cache-Control', 'no-store')
  @ApiOperation({ summary: 'Historial de consentimientos y aceptaciones de un titular (por correo; consulta auditada).' })
  async consents(@CurrentStaff() actor: StaffActor, @ReqMeta() meta: RequestMeta, @Query() query: ConsentHistoryQueryDto) {
    return { data: await this.privacy.consentHistory(actor, meta, query.email) };
  }
}

@ApiTags('admin: auditoría')
@Controller('admin/audit')
@StaffAuth('audit:read')
export class AuditAdminController {
  constructor(@Inject(AuditQueryService) private readonly audit: AuditQueryService) {}

  @Get()
  async list(@Query() query: AuditQueryDto) {
    const q = {
      ...page(query),
      entityType: query.entityType,
      entityId: query.entityId,
      actorId: query.actorId,
      action: query.action,
      from: query.from ? new Date(query.from) : undefined,
      to: query.to ? new Date(query.to) : undefined,
    };
    return paged(q, await this.audit.list(q));
  }
}
