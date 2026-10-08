import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  Equals,
  IsBoolean,
  IsEmail,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Length,
  Matches,
  MaxLength,
  Min,
  ValidateIf,
  ValidateNested,
} from 'class-validator';
import { MoneyDto } from '../../../shared/interface/common.dto.js';
import { COMPLAINT_STATUSES, COMPLAINT_TYPES, CONSUMER_DOC_TYPES, GOOD_TYPES, RESPONSE_CHANNELS } from '../domain/complaint.js';

const E164 = /^\+?[0-9 ()-]{8,20}$/;
const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);

/** Formulario público (orden del Anexo I; especificación: brain/wiki/normativa/libro-de-reclamaciones.md §3.1). */
export class ComplaintConsumerDto {
  @ApiProperty({ example: 'Ana Quispe Mamani', minLength: 3, maxLength: 200 })
  @Transform(trim)
  @IsString()
  @Length(3, 200)
  fullName: string;

  @ApiProperty({ enum: CONSUMER_DOC_TYPES, example: 'dni' })
  @IsIn(CONSUMER_DOC_TYPES)
  docType: (typeof CONSUMER_DOC_TYPES)[number];

  @ApiProperty({ example: '45678912', description: 'DNI 8 dígitos; CE 9-12; pasaporte 5-20 alfanuméricos.' })
  @Transform(trim)
  @IsString()
  @Length(3, 20)
  docNumber: string;

  @ApiProperty({ example: 'Jr. Lima 123, Puno', minLength: 5, maxLength: 300 })
  @Transform(trim)
  @IsString()
  @Length(5, 300)
  address: string;

  @ApiProperty({ example: '+51987654321', description: 'Formato E.164 (con código de país).' })
  @Transform(trim)
  @IsString()
  @Matches(E164, { message: 'Teléfono inválido: usa el formato +51987654321.' })
  phone: string;

  @ApiProperty({ example: 'ana@example.com' })
  @Transform(trim)
  @IsEmail({}, { message: 'Correo electrónico inválido.' })
  @MaxLength(254)
  email: string;

  @ApiProperty({ description: 'Si es true, `guardian` es obligatorio.' })
  @IsBoolean()
  isMinor: boolean;
}

export class ComplaintGuardianDto {
  @ApiProperty({ minLength: 3, maxLength: 200 })
  @Transform(trim)
  @IsString()
  @Length(3, 200)
  fullName: string;

  @ApiProperty({ minLength: 5, maxLength: 300 })
  @Transform(trim)
  @IsString()
  @Length(5, 300)
  address: string;

  @ApiProperty({ example: '+51987654321' })
  @Transform(trim)
  @IsString()
  @Matches(E164, { message: 'Teléfono inválido: usa el formato +51987654321.' })
  phone: string;

  @ApiProperty()
  @Transform(trim)
  @IsEmail({}, { message: 'Correo electrónico inválido.' })
  @MaxLength(254)
  email: string;
}

export class ComplaintGoodDto {
  @ApiProperty({ enum: GOOD_TYPES, default: 'service' })
  @IsIn(GOOD_TYPES)
  type: (typeof GOOD_TYPES)[number];

  @ApiPropertyOptional({ type: 'integer', example: 45000, description: 'Monto reclamado en céntimos. Obligatorio si declaredType = reclamo.' })
  @IsOptional()
  @IsInt()
  @Min(0)
  claimedAmount?: number;

  @ApiPropertyOptional({ enum: ['PEN', 'USD'], description: 'Obligatoria si hay monto.' })
  @IsOptional()
  @IsIn(['PEN', 'USD'])
  currency?: 'PEN' | 'USD';

  @ApiProperty({ example: 'Tour Uros y Taquile del 12/10/2026 (reserva PWT-2026-000123)', minLength: 5, maxLength: 500 })
  @Transform(trim)
  @IsString()
  @Length(5, 500)
  description: string;
}

export class SubmitComplaintDto {
  @ApiProperty({ type: ComplaintConsumerDto })
  @ValidateNested()
  @Type(() => ComplaintConsumerDto)
  consumer: ComplaintConsumerDto;

  @ApiPropertyOptional({ type: ComplaintGuardianDto, description: 'Padre, madre o representante (solo si consumer.isMinor).' })
  @ValidateIf((o: SubmitComplaintDto) => o.guardian !== undefined && o.guardian !== null)
  @ValidateNested()
  @Type(() => ComplaintGuardianDto)
  guardian?: ComplaintGuardianDto | null;

  @ApiProperty({ type: ComplaintGoodDto })
  @ValidateNested()
  @Type(() => ComplaintGoodDto)
  good: ComplaintGoodDto;

  @ApiPropertyOptional({ example: 'PWT-2026-000123', description: 'Opcional; nunca obligatorio para reclamar.' })
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(20)
  bookingCode?: string;

  @ApiProperty({ enum: COMPLAINT_TYPES, nullable: true, description: 'null = "no sé" (se tramita como reclamo).' })
  @ValidateIf((o: SubmitComplaintDto) => o.declaredType !== null)
  @IsIn(COMPLAINT_TYPES)
  declaredType: (typeof COMPLAINT_TYPES)[number] | null;

  @ApiProperty({ minLength: 10, maxLength: 5000 })
  @Transform(trim)
  @IsString()
  @Length(10, 5000)
  detail: string;

  @ApiProperty({ minLength: 5, maxLength: 2000 })
  @Transform(trim)
  @IsString()
  @Length(5, 2000)
  consumerRequest: string;

  @ApiProperty({ enum: RESPONSE_CHANNELS, default: 'email' })
  @IsIn(RESPONSE_CHANNELS)
  responseChannel: (typeof RESPONSE_CHANNELS)[number];

  @ApiProperty({ description: 'Declaración de conformidad que sustituye la firma (debe ser true).' })
  @IsBoolean()
  @Equals(true, { message: 'Debes declarar la conformidad con los datos de la hoja.' })
  conformityAccepted: boolean;
}

// ----------------------------------------------------------------------------- respuestas

export class ComplaintReceiptDto {
  @ApiProperty({ example: 'LR-2026-000045' }) code: string;
  @ApiProperty({ example: '000000045-2026', description: 'Número de hoja como en el Anexo I.' }) sheetNumber: string;
  @ApiProperty({ format: 'date-time', description: 'Constancia: fecha y hora de presentación (UTC).' }) createdAt: string;
  @ApiProperty({ format: 'date-time', description: 'Vence la respuesta: fin del 15.º día hábil (America/Lima).' }) responseDueAt: string;
  @ApiProperty({ description: 'Token de consulta (X-Complaint-Token). Solo se entrega aquí.' }) accessToken: string;
}

export class ComplaintReceiptResponseDto {
  @ApiProperty({ type: ComplaintReceiptDto }) data: ComplaintReceiptDto;
}

class ComplaintProviderViewDto {
  @ApiProperty() legalName: string;
  @ApiProperty() ruc: string;
  @ApiProperty() establishmentAddress: string;
  @ApiProperty() establishmentCode: string;
}

class ComplaintConsumerViewDto {
  @ApiProperty() fullName: string;
  @ApiProperty({ enum: [...CONSUMER_DOC_TYPES, 'ruc'] }) docType: string;
  @ApiProperty() docNumber: string;
  @ApiProperty() address: string;
  @ApiProperty({ type: String, nullable: true }) phone: string | null;
  @ApiProperty() email: string;
  @ApiProperty() isMinor: boolean;
}

class ComplaintGuardianViewDto {
  @ApiProperty() fullName: string;
  @ApiProperty() address: string;
  @ApiProperty() phone: string;
  @ApiProperty() email: string;
}

class ComplaintGoodViewDto {
  @ApiProperty({ enum: GOOD_TYPES }) type: string;
  @ApiProperty() description: string;
  @ApiProperty({ type: MoneyDto, nullable: true }) claimedAmount: MoneyDto | null;
}

class ComplaintAnswerViewDto {
  @ApiProperty() text: string;
  @ApiProperty({ format: 'date-time' }) sentAt: string;
}

export class ComplaintSheetDto {
  @ApiProperty({ example: 'LR-2026-000045' }) code: string;
  @ApiProperty({ example: '000000045-2026' }) sheetNumber: string;
  @ApiProperty({ enum: COMPLAINT_STATUSES }) status: string;
  @ApiProperty({ format: 'date-time' }) submittedAt: string;
  @ApiProperty({ format: 'date-time' }) responseDueAt: string;
  @ApiProperty({ type: ComplaintProviderViewDto }) provider: ComplaintProviderViewDto;
  @ApiProperty({ type: ComplaintConsumerViewDto }) consumer: ComplaintConsumerViewDto;
  @ApiProperty({ type: ComplaintGuardianViewDto, nullable: true }) guardian: ComplaintGuardianViewDto | null;
  @ApiProperty({ type: ComplaintGoodViewDto }) good: ComplaintGoodViewDto;
  @ApiProperty({ enum: COMPLAINT_TYPES, nullable: true, type: String }) declaredType: string | null;
  @ApiProperty({ enum: COMPLAINT_TYPES, description: 'Tipo con el que se tramita.' }) type: string;
  @ApiProperty() detail: string;
  @ApiProperty() consumerRequest: string;
  @ApiProperty({ enum: RESPONSE_CHANNELS }) responseChannel: string;
  @ApiProperty({ type: String, format: 'date-time', nullable: true }) conformityAcceptedAt: string | null;
  @ApiProperty({ type: [String], description: 'Leyendas obligatorias del pie del Anexo I.' }) legalNotices: string[];
  @ApiProperty({ type: ComplaintAnswerViewDto, nullable: true, description: 'Respuesta del proveedor una vez comunicada.' })
  answer: ComplaintAnswerViewDto | null;
}

export class ComplaintSheetResponseDto {
  @ApiProperty({ type: ComplaintSheetDto }) data: ComplaintSheetDto;
}
