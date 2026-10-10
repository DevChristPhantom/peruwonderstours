import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import { IsBoolean, IsIn, IsInt, IsOptional, IsString, Matches, Max, MaxLength, Min } from 'class-validator';
import { SUPPORTED_CURRENCIES, type CurrencyCode } from '../../../shared/domain/money.js';
import type { TourSort } from '../domain/catalog.repository.js';
import { DIFFICULTIES, LOCALES, TOUR_TYPES, type Difficulty, type Locale, type TourType } from '../domain/tour.js';

const SORTS: TourSort[] = ['relevance', 'featured', 'price_asc', 'price_desc', 'duration_asc', 'duration_desc'];
const toBool = ({ value }: { value: unknown }) => (value === 'true' || value === true ? true : value === 'false' || value === false ? false : value);
const SLUG = /^[a-z0-9]+(-[a-z0-9]+)*$/;

export class LocaleQueryDto {
  @ApiPropertyOptional({ enum: LOCALES, default: 'es' })
  @IsOptional()
  @IsIn(LOCALES)
  locale: Locale = 'es';
}

export class LocaleCurrencyQueryDto extends LocaleQueryDto {
  @ApiPropertyOptional({ enum: SUPPORTED_CURRENCIES, default: 'PEN' })
  @IsOptional()
  @IsIn(SUPPORTED_CURRENCIES)
  currency: CurrencyCode = 'PEN';
}

export class ListToursQueryDto extends LocaleCurrencyQueryDto {
  @ApiPropertyOptional({ description: 'Texto libre tolerante a tildes y errores ("cuzco machupichu").' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  q?: string;

  @ApiPropertyOptional({ description: 'Slug de destino', example: 'cuzco' })
  @IsOptional()
  @Matches(SLUG)
  destination?: string;

  @ApiPropertyOptional({ description: 'Slug de categoría', example: 'full-days' })
  @IsOptional()
  @Matches(SLUG)
  category?: string;

  @ApiPropertyOptional({ enum: TOUR_TYPES })
  @IsOptional()
  @IsIn(TOUR_TYPES)
  type?: TourType;

  @ApiPropertyOptional({ enum: DIFFICULTIES })
  @IsOptional()
  @IsIn(DIFFICULTIES)
  difficulty?: Difficulty;

  @ApiPropertyOptional({ minimum: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(60)
  minDays?: number;

  @ApiPropertyOptional({ minimum: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(60)
  maxDays?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(toBool)
  @IsBoolean()
  featured?: boolean;

  @ApiPropertyOptional({ description: 'Precio desde mínimo, en céntimos de `currency`.' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  minPrice?: number;

  @ApiPropertyOptional({ description: 'Precio desde máximo, en céntimos de `currency`.' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  maxPrice?: number;

  @ApiPropertyOptional({ enum: SORTS, default: 'relevance' })
  @IsOptional()
  @IsIn(SORTS)
  sort: TourSort = 'relevance';

  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(1000)
  page = 1;

  @ApiPropertyOptional({ default: 12, maximum: 50 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  pageSize = 12;
}

export class DeparturesQueryDto {
  @ApiPropertyOptional({ enum: SUPPORTED_CURRENCIES, default: 'PEN', description: 'Moneda del precio desde por fecha.' })
  @IsOptional()
  @IsIn(SUPPORTED_CURRENCIES)
  currency: CurrencyCode = 'PEN';

  @ApiPropertyOptional({ example: '2026-11-01', description: 'Fecha inicial (YYYY-MM-DD, por defecto hoy en Lima).' })
  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  from?: string;

  @ApiPropertyOptional({ example: '2026-12-31' })
  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  to?: string;
}
