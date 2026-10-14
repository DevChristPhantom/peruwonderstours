import { TRANSLATION_STATUSES } from '../../../shared/domain/i18n.js';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsEmail,
  IsIn,
  IsInt,
  IsISO8601,

  IsOptional,
  IsString,
  IsUUID,
  Length,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { BOOKING_STATUSES } from '../../booking/domain/booking-status.js';
import { DIFFICULTIES, LOCALES, PAX_TYPES, RESIDENCIES, TOUR_TYPES } from '../../catalog/domain/tour.js';
import { COMPLAINT_STATUSES, COMPLAINT_TYPES } from '../../complaints/domain/complaint.js';
import { ComplaintConsumerDto, ComplaintGoodDto, ComplaintGuardianDto } from '../../complaints/interface/complaint.dto.js';
import { DSR_TYPES } from '../domain/backoffice-rules.js';

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const SLUG = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const toInt = ({ value }: { value: unknown }) => (typeof value === 'string' && /^-?\d+$/.test(value) ? Number(value) : value);
const toBool = ({ value }: { value: unknown }) => (value === 'true' ? true : value === 'false' ? false : value);

export class PageQueryDto {
  @ApiPropertyOptional({ default: 1, minimum: 1 })
  @IsOptional()
  @Transform(toInt)
  @IsInt()
  @Min(1)
  page?: number;

  @ApiPropertyOptional({ default: 20, minimum: 1, maximum: 100 })
  @IsOptional()
  @Transform(toInt)
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize?: number;
}

export class VersionDto {
  @ApiProperty({ description: 'Versión leída del recurso (bloqueo optimista).' })
  @IsInt()
  @Min(0)
  version: number;
}

// -----------------------------------------------------------------------------
// Tours
// -----------------------------------------------------------------------------
export class TourListQueryDto extends PageQueryDto {
  @ApiPropertyOptional({ enum: ['draft', 'published', 'archived'] })
  @IsOptional()
  @IsIn(['draft', 'published', 'archived'])
  status?: 'draft' | 'published' | 'archived';

  @ApiPropertyOptional({ description: 'Busca en código, slug y título.' })
  @IsOptional()
  @Transform(trim)
  @IsString()
  @Length(1, 100)
  q?: string;
}

export class TourFieldsDto {
  @ApiPropertyOptional({ enum: TOUR_TYPES })
  @IsOptional()
  @IsIn(TOUR_TYPES)
  type?: (typeof TOUR_TYPES)[number];

  @ApiPropertyOptional({ example: 'CUS-MAPI-01' })
  @IsOptional()
  @Transform(trim)
  @Matches(/^[A-Z0-9][A-Z0-9-]{1,39}$/, { message: 'Código: 2-40 mayúsculas, números o guiones.' })
  code?: string;

  @ApiPropertyOptional({ example: 'machu-picchu-full-day', description: 'Slug canónico (es).' })
  @IsOptional()
  @Matches(SLUG, { message: 'Slug: minúsculas, números y guiones.' })
  @MaxLength(160)
  slug?: string;

  @ApiPropertyOptional({ nullable: true, format: 'uuid' })
  @IsOptional()
  @IsUUID()
  categoryId?: string | null;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(60)
  durationDays?: number | null;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(60)
  durationNights?: number | null;

  @ApiPropertyOptional({ nullable: true, example: 4.5 })
  @IsOptional()
  @Min(0)
  @Max(999)
  durationHours?: number | null;

  @ApiPropertyOptional({ minimum: 1 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(500)
  minPax?: number;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(500)
  maxPax?: number | null;

  @ApiPropertyOptional({ enum: DIFFICULTIES, nullable: true })
  @IsOptional()
  @IsIn(DIFFICULTIES)
  difficulty?: (typeof DIFFICULTIES)[number] | null;

  @ApiPropertyOptional({ type: [String], example: ['es', 'en', 'pt'] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(10)
  @Matches(/^[a-z]{2}$/, { each: true })
  languages?: string[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(8760)
  bookingCutoffHours?: number;

  @ApiPropertyOptional({ nullable: true, minimum: 1, maximum: 100 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  depositPercentOverride?: number | null;

  @ApiPropertyOptional() @IsOptional() @IsBoolean() requiresTravelerDocument?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() usesInventory?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() isFeatured?: boolean;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(40)
  cancellationPolicyCode?: string | null;

  @ApiPropertyOptional({ type: [String], format: 'uuid', description: 'Reemplaza los destinos.' })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @IsUUID('all', { each: true })
  destinationIds?: string[];

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  @IsOptional()
  @IsUUID()
  primaryDestinationId?: string | null;
}

export class CreateTourDto extends TourFieldsDto {
  @ApiProperty({ enum: TOUR_TYPES })
  @IsIn(TOUR_TYPES)
  declare type: (typeof TOUR_TYPES)[number];

  @ApiProperty({ example: 'CUS-MAPI-01' })
  @Transform(trim)
  @Matches(/^[A-Z0-9][A-Z0-9-]{1,39}$/, { message: 'Código: 2-40 mayúsculas, números o guiones.' })
  declare code: string;

  @ApiProperty({ example: 'machu-picchu-full-day' })
  @Matches(SLUG, { message: 'Slug: minúsculas, números y guiones.' })
  @MaxLength(160)
  declare slug: string;
}

export class UpdateTourDto extends TourFieldsDto {
  @ApiProperty() @IsInt() @Min(0) version: number;
}

export class ItineraryDayDto {
  @ApiProperty() @IsInt() @Min(1) @Max(60) day: number;
  @ApiPropertyOptional({ nullable: true }) @IsOptional() @IsString() @MaxLength(200) title?: string | null;
  @ApiProperty() @IsString() @Length(1, 5000) description: string;
  @ApiPropertyOptional({ type: [String] }) @IsOptional() @IsArray() @IsString({ each: true }) meals?: string[];
  @ApiPropertyOptional({ nullable: true }) @IsOptional() @IsString() @MaxLength(120) overnight?: string | null;
}

export class FaqDto {
  @ApiProperty() @IsString() @Length(1, 500) question: string;
  @ApiProperty() @IsString() @Length(1, 4000) answer: string;
}

export class TranslationDto {
  @ApiProperty() @IsInt() @Min(0) version: number;
  @ApiProperty() @Matches(SLUG) @MaxLength(160) slug: string;
  @ApiProperty() @Transform(trim) @IsString() @Length(1, 200) title: string;
  @ApiProperty() @Transform(trim) @IsString() @Length(1, 600) summary: string;
  @ApiPropertyOptional({ nullable: true }) @IsOptional() @IsString() @MaxLength(50_000) description?: string | null;
  @ApiPropertyOptional({ type: [ItineraryDayDto] }) @IsOptional() @IsArray() @ArrayMaxSize(60) @ValidateNested({ each: true }) @Type(() => ItineraryDayDto) itinerary?: ItineraryDayDto[];
  @ApiPropertyOptional({ type: [String] }) @IsOptional() @IsArray() @ArrayMaxSize(100) @IsString({ each: true }) includes?: string[];
  @ApiPropertyOptional({ type: [String] }) @IsOptional() @IsArray() @ArrayMaxSize(100) @IsString({ each: true }) notIncluded?: string[];
  @ApiPropertyOptional({ type: [String] }) @IsOptional() @IsArray() @ArrayMaxSize(100) @IsString({ each: true }) recommendations?: string[];
  @ApiPropertyOptional({ type: [FaqDto] }) @IsOptional() @IsArray() @ArrayMaxSize(100) @ValidateNested({ each: true }) @Type(() => FaqDto) faqs?: FaqDto[];
  @ApiPropertyOptional({ type: [String] }) @IsOptional() @IsArray() @ArrayMaxSize(100) @IsString({ each: true }) importantNotes?: string[];
  @ApiPropertyOptional({ nullable: true }) @IsOptional() @IsString() @MaxLength(20_000) policies?: string | null;
  @ApiPropertyOptional({ nullable: true }) @IsOptional() @IsString() @MaxLength(2000) meetingPoint?: string | null;
  @ApiPropertyOptional({ nullable: true }) @IsOptional() @IsString() @MaxLength(70) seoTitle?: string | null;
  @ApiPropertyOptional({ nullable: true }) @IsOptional() @IsString() @MaxLength(170) seoDescription?: string | null;
  @ApiPropertyOptional({ nullable: true, enum: TRANSLATION_STATUSES, description: 'Por defecto null (revisada por el staff).' })
  @IsOptional()
  @IsIn(TRANSLATION_STATUSES)
  translationStatus?: (typeof TRANSLATION_STATUSES)[number] | null;
}

export class MediaDto {
  @ApiProperty() @IsInt() @Min(0) version: number;
  @ApiProperty({ description: 'URL absoluta del CDN o clave del almacenamiento (la subida de archivos está pendiente).' })
  @IsString()
  @Length(3, 2000)
  storageKey: string;
  @ApiPropertyOptional({ enum: ['image', 'video'] }) @IsOptional() @IsIn(['image', 'video']) kind?: 'image' | 'video';
  @ApiPropertyOptional({ nullable: true }) @IsOptional() @IsString() @MaxLength(250) altEs?: string | null;
  @ApiPropertyOptional({ nullable: true }) @IsOptional() @IsString() @MaxLength(250) altEn?: string | null;
  @ApiPropertyOptional({ nullable: true }) @IsOptional() @IsInt() @Min(1) width?: number | null;
  @ApiPropertyOptional({ nullable: true }) @IsOptional() @IsInt() @Min(1) height?: number | null;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() isCover?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsInt() @Min(0) sortOrder?: number;
}

export class UpdateMediaDto {
  @ApiProperty() @IsInt() @Min(0) version: number;
  @ApiPropertyOptional() @IsOptional() @IsString() @Length(3, 2000) storageKey?: string;
  @ApiPropertyOptional({ enum: ['image', 'video'] }) @IsOptional() @IsIn(['image', 'video']) kind?: 'image' | 'video';
  @ApiPropertyOptional({ nullable: true }) @IsOptional() @IsString() @MaxLength(250) altEs?: string | null;
  @ApiPropertyOptional({ nullable: true }) @IsOptional() @IsString() @MaxLength(250) altEn?: string | null;
  @ApiPropertyOptional({ nullable: true }) @IsOptional() @IsInt() @Min(1) width?: number | null;
  @ApiPropertyOptional({ nullable: true }) @IsOptional() @IsInt() @Min(1) height?: number | null;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() isCover?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsInt() @Min(0) sortOrder?: number;
}

export const LOCALE_PARAM = LOCALES;

// -----------------------------------------------------------------------------
// Temporadas y tarifas
// -----------------------------------------------------------------------------
export class SeasonDto {
  @ApiProperty({ example: 'ALTA-2027' }) @Transform(trim) @Matches(/^[A-Z0-9][A-Z0-9_-]{1,39}$/) code: string;
  @ApiProperty({ example: 'Temporada alta 2027' }) @Transform(trim) @IsString() @Length(2, 120) name: string;
  @ApiProperty({ example: '2027-05-01' }) @Matches(DATE) startDate: string;
  @ApiProperty({ example: '2027-09-30' }) @Matches(DATE) endDate: string;
  @ApiPropertyOptional({ description: 'Mayor prioridad gana si se solapan.' }) @IsOptional() @IsInt() @Min(0) @Max(100) priority?: number;
}

export class UpdateSeasonDto {
  @ApiProperty() @IsInt() @Min(0) version: number;
  @ApiPropertyOptional() @IsOptional() @Transform(trim) @Matches(/^[A-Z0-9][A-Z0-9_-]{1,39}$/) code?: string;
  @ApiPropertyOptional() @IsOptional() @Transform(trim) @IsString() @Length(2, 120) name?: string;
  @ApiPropertyOptional() @IsOptional() @Matches(DATE) startDate?: string;
  @ApiPropertyOptional() @IsOptional() @Matches(DATE) endDate?: string;
  @ApiPropertyOptional() @IsOptional() @IsInt() @Min(0) @Max(100) priority?: number;
}

export class RateDto {
  @ApiPropertyOptional({ format: 'uuid', nullable: true }) @IsOptional() @IsUUID() seasonId?: string | null;
  @ApiProperty({ enum: PAX_TYPES }) @IsIn(PAX_TYPES) paxType: (typeof PAX_TYPES)[number];
  @ApiProperty({ enum: RESIDENCIES }) @IsIn(RESIDENCIES) residency: (typeof RESIDENCIES)[number];
  @ApiProperty({ enum: ['PEN', 'USD'] }) @IsIn(['PEN', 'USD']) currency: 'PEN' | 'USD';
  @ApiProperty({ description: 'Precio por persona en céntimos (entero).', example: 45000 }) @IsInt() @Min(0) @Max(100_000_000) amount: number;
  @ApiProperty({ example: '2027-01-01' }) @Matches(DATE) validFrom: string;
  @ApiProperty({ example: '2027-12-31' }) @Matches(DATE) validTo: string;
  @ApiPropertyOptional({ default: 1 }) @IsOptional() @IsInt() @Min(1) @Max(500) minGroupSize?: number;
  @ApiPropertyOptional({ nullable: true }) @IsOptional() @IsInt() @Min(1) @Max(500) maxGroupSize?: number | null;
  @ApiPropertyOptional({ default: true }) @IsOptional() @IsBoolean() isActive?: boolean;
}

export class UpdateRateDto {
  @ApiProperty() @IsInt() @Min(0) version: number;
  @ApiPropertyOptional({ format: 'uuid', nullable: true }) @IsOptional() @IsUUID() seasonId?: string | null;
  @ApiPropertyOptional({ enum: PAX_TYPES }) @IsOptional() @IsIn(PAX_TYPES) paxType?: (typeof PAX_TYPES)[number];
  @ApiPropertyOptional({ enum: RESIDENCIES }) @IsOptional() @IsIn(RESIDENCIES) residency?: (typeof RESIDENCIES)[number];
  @ApiPropertyOptional({ enum: ['PEN', 'USD'] }) @IsOptional() @IsIn(['PEN', 'USD']) currency?: 'PEN' | 'USD';
  @ApiPropertyOptional() @IsOptional() @IsInt() @Min(0) @Max(100_000_000) amount?: number;
  @ApiPropertyOptional() @IsOptional() @Matches(DATE) validFrom?: string;
  @ApiPropertyOptional() @IsOptional() @Matches(DATE) validTo?: string;
  @ApiPropertyOptional() @IsOptional() @IsInt() @Min(1) @Max(500) minGroupSize?: number;
  @ApiPropertyOptional({ nullable: true }) @IsOptional() @IsInt() @Min(1) @Max(500) maxGroupSize?: number | null;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() isActive?: boolean;
}

export class RateListQueryDto {
  @ApiPropertyOptional() @IsOptional() @Transform(toBool) @IsBoolean() includeInactive?: boolean;
}

// -----------------------------------------------------------------------------
// Salidas
// -----------------------------------------------------------------------------
export class DepartureRangeQueryDto {
  @ApiPropertyOptional({ example: '2026-11-01' }) @IsOptional() @Matches(DATE) from?: string;
  @ApiPropertyOptional({ example: '2026-12-31' }) @IsOptional() @Matches(DATE) to?: string;
}

export class BulkDeparturesDto {
  @ApiProperty({ example: '2026-11-01' }) @Matches(DATE) from: string;
  @ApiProperty({ example: '2027-03-31' }) @Matches(DATE) to: string;
  @ApiProperty({ type: [Number], example: [1, 3, 5], description: 'ISO: 1 = lunes ... 7 = domingo.' })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(7)
  @IsInt({ each: true })
  @Min(1, { each: true })
  @Max(7, { each: true })
  weekdays: number[];
  @ApiPropertyOptional({ example: '05:30', description: 'Hora local de Lima (HH:MM); 00:00 = sin hora fija.' }) @IsOptional() @Matches(/^([01]\d|2[0-3]):[0-5]\d$/) startTime?: string;
  @ApiProperty({ example: 16 }) @IsInt() @Min(1) @Max(10_000) capacity: number;
}

export class UpdateDepartureDto {
  @ApiProperty() @IsInt() @Min(0) version: number;
  @ApiPropertyOptional({ description: 'No puede ser menor que vendidos + retenidos.' }) @IsOptional() @IsInt() @Min(0) @Max(10_000) capacity?: number;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() isClosed?: boolean;
}

// -----------------------------------------------------------------------------
// Reservas
// -----------------------------------------------------------------------------
export class BookingListQueryDto extends PageQueryDto {
  @ApiPropertyOptional({ enum: BOOKING_STATUSES }) @IsOptional() @IsIn(BOOKING_STATUSES) status?: (typeof BOOKING_STATUSES)[number];
  @ApiPropertyOptional({ example: '2026-11-01', description: 'Primer día de servicio desde.' }) @IsOptional() @Matches(DATE) travelDateFrom?: string;
  @ApiPropertyOptional({ example: '2026-11-30' }) @IsOptional() @Matches(DATE) travelDateTo?: string;
  @ApiPropertyOptional({ example: 'PWT-2026-0000', description: 'Prefijo del código.' }) @IsOptional() @Transform(trim) @Matches(/^[A-Za-z0-9-]{3,20}$/) code?: string;
}

/** H-15: la búsqueda por correo va en el cuerpo (POST), nunca en la URL (logs de proxies). */
export class BookingSearchDto extends BookingListQueryDto {
  @ApiPropertyOptional({ description: 'Correo exacto del cliente.' }) @IsOptional() @Transform(trim) @IsEmail() email?: string;
}

export class CancelBookingDto {
  @ApiProperty({ example: 'Solicitud del cliente por correo del 2026-10-08' }) @Transform(trim) @IsString() @Length(5, 500) reason: string;
  @ApiPropertyOptional({ description: 'Reembolso distinto al de la política (céntimos). Requiere overrideReason.' })
  @IsOptional()
  @IsInt()
  @Min(0)
  refundAmountOverride?: number;
  @ApiPropertyOptional() @IsOptional() @Transform(trim) @IsString() @Length(5, 500) overrideReason?: string;
}

export class ManualPaymentDto {
  @ApiProperty({ description: 'Céntimos en la moneda de la reserva.', example: 45000 }) @IsInt() @Min(1) amount: number;
  @ApiProperty({ enum: ['cash', 'bank_transfer'] }) @IsIn(['cash', 'bank_transfer']) method: 'cash' | 'bank_transfer';
  @ApiProperty({ description: 'N.º de operación bancaria o de recibo (único por método).', example: 'OP-0012345' })
  @Transform(trim)
  @Matches(/^[A-Za-z0-9._:/-]{3,80}$/, { message: 'Referencia: 3-80 caracteres (letras, números, . _ : / -).' })
  reference: string;
  @ApiPropertyOptional({ format: 'date-time', description: 'Cuándo se recibió (por defecto ahora).' }) @IsOptional() @IsISO8601() receivedAt?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(500) note?: string;
}

export class ManualRefundDto {
  @ApiProperty({ example: 22500 }) @IsInt() @Min(1) amount: number;
  @ApiProperty({ enum: ['cash', 'bank_transfer'] }) @IsIn(['cash', 'bank_transfer']) method: 'cash' | 'bank_transfer';
  @ApiProperty() @Transform(trim) @Matches(/^[A-Za-z0-9._:/-]{3,80}$/) reference: string;
  @ApiPropertyOptional({ format: 'uuid', description: 'Pago original (por defecto, el último exitoso).' }) @IsOptional() @IsUUID() parentPaymentId?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(500) note?: string;
}

// -----------------------------------------------------------------------------
// Libro de Reclamaciones
// -----------------------------------------------------------------------------
export class ComplaintListQueryDto extends PageQueryDto {
  @ApiPropertyOptional({ enum: COMPLAINT_STATUSES }) @IsOptional() @IsIn(COMPLAINT_STATUSES) status?: (typeof COMPLAINT_STATUSES)[number];
  @ApiPropertyOptional({ enum: COMPLAINT_TYPES }) @IsOptional() @IsIn(COMPLAINT_TYPES) type?: (typeof COMPLAINT_TYPES)[number];
  @ApiPropertyOptional({ enum: ['green', 'yellow', 'red', 'overdue', 'suspended', 'done'] })
  @IsOptional()
  @IsIn(['green', 'yellow', 'red', 'overdue', 'suspended', 'done'])
  trafficLight?: 'green' | 'yellow' | 'red' | 'overdue' | 'suspended' | 'done';
  @ApiPropertyOptional({ enum: ['web', 'backup_book', 'office_assisted'] }) @IsOptional() @IsIn(['web', 'backup_book', 'office_assisted']) channel?: 'web' | 'backup_book' | 'office_assisted';
  @ApiPropertyOptional({ example: 'LR-2026-' }) @IsOptional() @Transform(trim) @Matches(/^[A-Za-z0-9-]{3,20}$/) code?: string;
}

export class RespondComplaintDto {
  @ApiProperty({ minLength: 10, maxLength: 10_000 }) @IsString() @Length(10, 10_000) responseText: string;
  @ApiPropertyOptional({ format: 'date-time', description: 'Solo canal carta: fecha de envío.' }) @IsOptional() @IsISO8601() letterSentAt?: string;
  @ApiPropertyOptional({ description: 'Solo canal carta: n.º de cargo/guía.' }) @IsOptional() @Transform(trim) @IsString() @Length(2, 150) letterDeliveryRef?: string;
}

export class ReclassifyComplaintDto {
  @ApiProperty({ enum: COMPLAINT_TYPES }) @IsIn(COMPLAINT_TYPES) type: (typeof COMPLAINT_TYPES)[number];
  @ApiProperty({ example: 'El detalle se refiere al servicio contratado (art. 6).' }) @Transform(trim) @IsString() @Length(5, 500) reason: string;
}

export class SettlementOfferDto {
  @ApiProperty({ description: 'Propuesta de solución (se envía por correo con la frase de aceptación).' }) @Transform(trim) @IsString() @Length(10, 5000) offerText: string;
}

export class SettlementAcceptanceDto {
  @ApiProperty({ description: 'Evidencia (p. ej. correo del consumidor con "ACUERDO ACEPTADO PARA SOLUCIONAR EL RECLAMO").' })
  @Transform(trim)
  @IsString()
  @Length(10, 5000)
  evidence: string;
  @ApiPropertyOptional({ format: 'date-time' }) @IsOptional() @IsISO8601() acceptedAt?: string;
}

export class SettlementRejectionDto {
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(500) note?: string;
}

export class TranscriptionDto {
  @ApiProperty({ example: '000123', description: 'N.º de la hoja del libro de respaldo físico.' }) @Transform(trim) @IsString() @Length(1, 40) backupSheetNumber: string;
  @ApiProperty({ format: 'date-time', description: 'Fecha y hora en que el consumidor llenó la hoja física.' }) @IsISO8601() submittedAt: string;
  @ApiProperty({ type: ComplaintConsumerDto }) @ValidateNested() @Type(() => ComplaintConsumerDto) consumer: ComplaintConsumerDto;
  @ApiPropertyOptional({ type: ComplaintGuardianDto, nullable: true }) @IsOptional() @ValidateNested() @Type(() => ComplaintGuardianDto) guardian?: ComplaintGuardianDto | null;
  @ApiProperty({ type: ComplaintGoodDto }) @ValidateNested() @Type(() => ComplaintGoodDto) good: ComplaintGoodDto;
  @ApiPropertyOptional({ enum: COMPLAINT_TYPES, nullable: true }) @IsOptional() @IsIn(COMPLAINT_TYPES) declaredType?: (typeof COMPLAINT_TYPES)[number] | null;
  @ApiProperty() @IsString() @Length(10, 5000) detail: string;
  @ApiProperty() @IsString() @Length(5, 2000) consumerRequest: string;
  @ApiProperty({ enum: ['email', 'letter'] }) @IsIn(['email', 'letter']) responseChannel: 'email' | 'letter';
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(20) bookingCode?: string;
}

// -----------------------------------------------------------------------------
// Protección de datos (ARCO)
// -----------------------------------------------------------------------------
export class DsrListQueryDto extends PageQueryDto {
  @ApiPropertyOptional({ enum: ['received', 'in_progress', 'answered', 'rejected', 'withdrawn'] })
  @IsOptional()
  @IsIn(['received', 'in_progress', 'answered', 'rejected', 'withdrawn'])
  status?: 'received' | 'in_progress' | 'answered' | 'rejected' | 'withdrawn';
  @ApiPropertyOptional({ enum: DSR_TYPES }) @IsOptional() @IsIn(DSR_TYPES) type?: (typeof DSR_TYPES)[number];
  @ApiPropertyOptional() @IsOptional() @Transform(toBool) @IsBoolean() overdue?: boolean;
}

export class CreateDsrDto {
  @ApiProperty({ enum: DSR_TYPES }) @IsIn(DSR_TYPES) type: (typeof DSR_TYPES)[number];
  @ApiProperty() @Transform(trim) @IsString() @Length(3, 200) subjectName: string;
  @ApiProperty() @Transform(trim) @IsEmail() @MaxLength(254) subjectEmail: string;
  @ApiProperty({ enum: ['email', 'web', 'office', 'phone', 'letter'] }) @IsIn(['email', 'web', 'office', 'phone', 'letter']) channel: 'email' | 'web' | 'office' | 'phone' | 'letter';
  @ApiProperty() @Transform(trim) @IsString() @Length(5, 5000) detail: string;
  @ApiPropertyOptional({ format: 'date-time' }) @IsOptional() @IsISO8601() receivedAt?: string;
}

export class DsrStatusDto extends VersionDto {
  @ApiProperty({ enum: ['in_progress', 'withdrawn'] }) @IsIn(['in_progress', 'withdrawn']) status: 'in_progress' | 'withdrawn';
}

export class DsrExtendDto extends VersionDto {
  @ApiProperty() @Transform(trim) @IsString() @Length(10, 1000) reason: string;
}

export class DsrRespondDto extends VersionDto {
  @ApiProperty({ enum: ['answered', 'rejected'] }) @IsIn(['answered', 'rejected']) status: 'answered' | 'rejected';
  @ApiProperty() @IsString() @Length(10, 20_000) responseText: string;
}

export class ConsentHistoryQueryDto {
  @ApiProperty() @Transform(trim) @IsEmail() email: string;
}

export class AuditQueryDto extends PageQueryDto {
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(60) entityType?: string;
  @ApiPropertyOptional({ format: 'uuid' }) @IsOptional() @IsUUID() entityId?: string;
  @ApiPropertyOptional({ format: 'uuid' }) @IsOptional() @IsUUID() actorId?: string;
  @ApiPropertyOptional() @IsOptional() @Matches(/^[A-Za-z_]{2,40}$/) action?: string;
  @ApiPropertyOptional({ format: 'date-time' }) @IsOptional() @IsISO8601() from?: string;
  @ApiPropertyOptional({ format: 'date-time' }) @IsOptional() @IsISO8601() to?: string;
}

