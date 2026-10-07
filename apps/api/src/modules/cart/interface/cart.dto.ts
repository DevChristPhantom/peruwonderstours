import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { ArrayMaxSize, ArrayMinSize, IsIn, IsInt, IsOptional, IsUUID, Matches, Max, Min, ValidateNested } from 'class-validator';
import { SUPPORTED_CURRENCIES, type CurrencyCode } from '../../../shared/domain/money.js';
import { LOCALES, PAX_TYPES, RESIDENCIES, type Locale, type PaxType, type Residency } from '../../catalog/domain/tour.js';

export class CreateCartDto {
  @ApiProperty({ enum: SUPPORTED_CURRENCIES, example: 'USD' })
  @IsIn(SUPPORTED_CURRENCIES)
  currency: CurrencyCode;

  @ApiPropertyOptional({ enum: LOCALES, default: 'es' })
  @IsOptional()
  @IsIn(LOCALES)
  locale: Locale = 'es';
}

export class PaxLineDto {
  @ApiProperty({ enum: PAX_TYPES, example: 'adult' })
  @IsIn(PAX_TYPES)
  paxType: PaxType;

  @ApiProperty({ enum: RESIDENCIES, example: 'foreign' })
  @IsIn(RESIDENCIES)
  residency: Residency;

  @ApiProperty({ minimum: 1, maximum: 50, example: 2 })
  @IsInt()
  @Min(1)
  @Max(50)
  quantity: number;
}

export class AddCartItemDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  tourId: string;

  @ApiProperty({ example: '2026-11-20', description: 'Fecha de inicio del servicio (Lima).' })
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  travelDate: string;

  @ApiPropertyOptional({ format: 'uuid', description: 'Obligatorio si hay varias salidas ese día.' })
  @IsOptional()
  @IsUUID()
  departureId?: string;

  @ApiProperty({ type: [PaxLineDto] })
  @ValidateNested({ each: true })
  @Type(() => PaxLineDto)
  @ArrayMinSize(1)
  @ArrayMaxSize(8)
  pax: PaxLineDto[];
}
