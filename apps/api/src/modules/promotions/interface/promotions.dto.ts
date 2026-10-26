import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsBoolean, IsIn, IsInt, IsISO8601, IsOptional, IsString, IsUUID, Length, Matches, Max, MaxLength, Min, ValidateNested } from 'class-validator';
import { CONTENT_LOCALES, TRANSLATION_STATUSES, type ContentLocale } from '../../../shared/domain/i18n.js';
import { PROMOTION_CTA_KINDS, PROMOTION_PATH, type PromotionCtaKind } from '../domain/promotion.js';

const CALENDAR_DATE = /^\d{4}-\d{2}-\d{2}$/;
type TranslationStatus = (typeof TRANSLATION_STATUSES)[number];

export class PromotionTranslationDto {
  @ApiProperty({ maxLength: 120 }) @IsString() @Length(1, 120) title: string;
  @ApiPropertyOptional({ nullable: true, maxLength: 80, description: 'Lugar y fecha sobre el título, p. ej. «Puno · febrero».' })
  @IsOptional() @IsString() @MaxLength(80) eyebrow?: string | null;
  @ApiProperty({ maxLength: 400 }) @IsString() @Length(1, 400) summary: string;
  @ApiPropertyOptional({ nullable: true, maxLength: 60 }) @IsOptional() @IsString() @MaxLength(60) ctaLabel?: string | null;
  @ApiPropertyOptional({ nullable: true, maxLength: 300, description: 'Mensaje precargado si el botón abre WhatsApp.' })
  @IsOptional() @IsString() @MaxLength(300) whatsappMessage?: string | null;
  @ApiPropertyOptional({ nullable: true, enum: TRANSLATION_STATUSES }) @IsOptional() @IsIn(TRANSLATION_STATUSES) translationStatus?: TranslationStatus | null;
}

export class PromotionFieldsDto {
  @ApiPropertyOptional({ nullable: true, format: 'date-time', description: 'Inicio de la difusión (vacío = desde ya).' }) @IsOptional() @IsISO8601() startsAt?: string | null;
  @ApiPropertyOptional({ nullable: true, format: 'date-time', description: 'Fin de la difusión (vacío = sin fin).' }) @IsOptional() @IsISO8601() endsAt?: string | null;
  @ApiPropertyOptional({ nullable: true, format: 'date' }) @IsOptional() @Matches(CALENDAR_DATE) eventStartsOn?: string | null;
  @ApiPropertyOptional({ nullable: true, format: 'date' }) @IsOptional() @Matches(CALENDAR_DATE) eventEndsOn?: string | null;
  @ApiPropertyOptional({ nullable: true }) @IsOptional() @IsString() @MaxLength(500) coverStorageKey?: string | null;
  @ApiPropertyOptional({ enum: PROMOTION_CTA_KINDS }) @IsOptional() @IsIn(PROMOTION_CTA_KINDS) ctaKind?: PromotionCtaKind;
  @ApiPropertyOptional({ nullable: true, format: 'uuid' }) @IsOptional() @IsUUID() tourId?: string | null;
  @ApiPropertyOptional({ nullable: true, example: '/destinos/tours-en-puno' }) @IsOptional() @Matches(PROMOTION_PATH) @MaxLength(300) ctaPath?: string | null;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() showPopup?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsInt() @Min(0) @Max(9999) sortOrder?: number;
}

export class CreatePromotionDto extends PromotionFieldsDto {
  @ApiProperty({ type: PromotionTranslationDto, description: 'Versión en español (obligatoria).' })
  @ValidateNested() @Type(() => PromotionTranslationDto) translation: PromotionTranslationDto;
}

export class UpdatePromotionDto extends PromotionFieldsDto {
  @ApiProperty({ description: 'Versión leída (bloqueo optimista).' }) @IsInt() @Min(0) version: number;
}

export class VersionedPromotionTranslationDto extends PromotionTranslationDto {
  @ApiProperty() @IsInt() @Min(0) version: number;
}

export class PromotionVersionDto {
  @ApiProperty() @IsInt() @Min(0) version: number;
}

export class PromotionLocaleQueryDto {
  @ApiPropertyOptional({ enum: CONTENT_LOCALES, default: 'es' }) @IsOptional() @IsIn(CONTENT_LOCALES) locale: ContentLocale = 'es';
}
