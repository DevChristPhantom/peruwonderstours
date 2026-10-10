import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
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
import { CONTENT_LOCALES, TRANSLATION_STATUSES, type ContentLocale } from '../../../shared/domain/i18n.js';
import { CONTACT_STATUSES, type ContactStatus } from '../../content/domain/content.js';

const SLUG = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);
type TranslationStatus = (typeof TRANSLATION_STATUSES)[number];

export class AdminPageQueryDto {
  @ApiPropertyOptional({ default: 1 }) @IsOptional() @Type(() => Number) @IsInt() @Min(1) page?: number;
  @ApiPropertyOptional({ default: 20, maximum: 100 }) @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) pageSize?: number;
}

export class VersionBodyDto {
  @ApiProperty({ description: 'Versión leída (bloqueo optimista).' }) @IsInt() @Min(0) version: number;
}

// ----------------------------------------------------------------------- Blog
export class BlogListQueryAdminDto extends AdminPageQueryDto {
  @ApiPropertyOptional({ enum: ['draft', 'published', 'archived'] }) @IsOptional() @IsIn(['draft', 'published', 'archived']) status?: 'draft' | 'published' | 'archived';
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(100) q?: string;
}

export class BlogTranslationDto {
  @ApiProperty() @Matches(SLUG) @MaxLength(160) slug: string;
  @ApiProperty() @Transform(trim) @IsString() @Length(1, 200) title: string;
  @ApiPropertyOptional({ nullable: true }) @IsOptional() @IsString() @MaxLength(400) excerpt?: string | null;
  @ApiProperty({ description: 'Markdown/HTML del editor (el front lo sanea al renderizar).' }) @IsString() @Length(1, 200_000) body: string;
  @ApiPropertyOptional({ nullable: true }) @IsOptional() @IsString() @MaxLength(70) seoTitle?: string | null;
  @ApiPropertyOptional({ nullable: true }) @IsOptional() @IsString() @MaxLength(170) seoDescription?: string | null;
  @ApiPropertyOptional({ nullable: true, enum: TRANSLATION_STATUSES }) @IsOptional() @IsIn(TRANSLATION_STATUSES) translationStatus?: TranslationStatus | null;
}

export class VersionedBlogTranslationDto extends BlogTranslationDto {
  @ApiProperty() @IsInt() @Min(0) version: number;
}

export class CreateBlogPostDto {
  @ApiPropertyOptional({ nullable: true, description: 'storageKey de POST /admin/media o URL absoluta.' }) @IsOptional() @IsString() @MaxLength(2000) coverStorageKey?: string | null;
  @ApiPropertyOptional({ type: [String] }) @IsOptional() @IsArray() @ArrayMaxSize(20) @IsString({ each: true }) @MaxLength(60, { each: true }) tags?: string[];
  @ApiProperty({ type: BlogTranslationDto, description: 'Traducción canónica `es`.' }) @ValidateNested() @Type(() => BlogTranslationDto) translation: BlogTranslationDto;
}

export class UpdateBlogPostDto extends VersionBodyDto {
  @ApiPropertyOptional({ nullable: true }) @IsOptional() @IsString() @MaxLength(2000) coverStorageKey?: string | null;
  @ApiPropertyOptional({ type: [String] }) @IsOptional() @IsArray() @ArrayMaxSize(20) @IsString({ each: true }) @MaxLength(60, { each: true }) tags?: string[];
}

export class PublishBlogPostDto extends VersionBodyDto {
  @ApiPropertyOptional({ description: 'Fecha de publicación (ISO 8601 UTC); por defecto ahora o la original.' }) @IsOptional() @IsISO8601() publishedAt?: string;
}

// ---------------------------------------------------------------- Testimonios
export class TestimonialListQueryAdminDto extends AdminPageQueryDto {
  @ApiPropertyOptional({ enum: ['pending', 'approved', 'rejected'] }) @IsOptional() @IsIn(['pending', 'approved', 'rejected']) status?: 'pending' | 'approved' | 'rejected';
}

export class ModerationNoteDto {
  @ApiPropertyOptional({ maxLength: 500 }) @IsOptional() @IsString() @MaxLength(500) note?: string;
}

export class RejectTestimonialDto {
  @ApiProperty({ maxLength: 500 }) @IsString() @Length(3, 500) note: string;
}

export class UpdateTestimonialDto {
  @ApiPropertyOptional() @IsOptional() @IsString() @Length(2, 120) authorName?: string;
  @ApiPropertyOptional({ nullable: true }) @IsOptional() @Matches(/^[A-Za-z]{2}$/) authorCountry?: string | null;
  @ApiPropertyOptional() @IsOptional() @IsString() @Length(20, 3000) body?: string;
  @ApiPropertyOptional() @IsOptional() @IsInt() @Min(1) @Max(5) rating?: number;
  @ApiPropertyOptional({ enum: CONTENT_LOCALES }) @IsOptional() @IsIn(CONTENT_LOCALES) locale?: ContentLocale;
}

export class FeatureDto {
  @ApiProperty() @IsBoolean() featured: boolean;
}

// ------------------------------------------------------------------- Contacto
export class ContactListQueryDto extends AdminPageQueryDto {
  @ApiPropertyOptional({ enum: CONTACT_STATUSES }) @IsOptional() @IsIn(CONTACT_STATUSES) status?: ContactStatus;
}

export class ContactStatusDto {
  @ApiProperty({ enum: CONTACT_STATUSES }) @IsIn(CONTACT_STATUSES) status: ContactStatus;
  @ApiPropertyOptional({ maxLength: 2000 }) @IsOptional() @IsString() @MaxLength(2000) internalNote?: string;
}

// ------------------------------------------------------ Destinos y categorías
export class TaxonomyTranslationDto {
  @ApiProperty() @Transform(trim) @IsString() @Length(1, 160) name: string;
  @ApiPropertyOptional({ nullable: true }) @IsOptional() @IsString() @MaxLength(20_000) description?: string | null;
  @ApiPropertyOptional({ nullable: true, description: 'Slug propio del idioma (solo `en`; null = el canónico).' }) @IsOptional() @Matches(SLUG) @MaxLength(160) slug?: string | null;
  @ApiPropertyOptional({ nullable: true, description: 'Solo destinos.' }) @IsOptional() @IsString() @MaxLength(70) seoTitle?: string | null;
  @ApiPropertyOptional({ nullable: true, description: 'Solo destinos.' }) @IsOptional() @IsString() @MaxLength(170) seoDescription?: string | null;
  @ApiPropertyOptional({ nullable: true, enum: TRANSLATION_STATUSES }) @IsOptional() @IsIn(TRANSLATION_STATUSES) translationStatus?: TranslationStatus | null;
}

export class VersionedTaxonomyTranslationDto extends TaxonomyTranslationDto {
  @ApiProperty() @IsInt() @Min(0) version: number;
}

export class CreateTaxonomyDto {
  @ApiProperty({ description: 'Slug canónico (es).' }) @Matches(SLUG) @MaxLength(120) slug: string;
  @ApiPropertyOptional() @IsOptional() @IsInt() @Min(0) @Max(10_000) sortOrder?: number;
  @ApiPropertyOptional({ nullable: true }) @IsOptional() @IsString() @MaxLength(2000) coverStorageKey?: string | null;
  @ApiPropertyOptional({ enum: ['draft', 'published'], description: 'Solo destinos.' }) @IsOptional() @IsIn(['draft', 'published']) status?: 'draft' | 'published';
  @ApiPropertyOptional({ nullable: true, format: 'uuid', description: 'Solo destinos.' }) @IsOptional() @IsUUID() parentId?: string | null;
  @ApiProperty({ type: TaxonomyTranslationDto }) @ValidateNested() @Type(() => TaxonomyTranslationDto) translation: TaxonomyTranslationDto;
}

export class UpdateTaxonomyDto extends VersionBodyDto {
  @ApiPropertyOptional() @IsOptional() @Matches(SLUG) @MaxLength(120) slug?: string;
  @ApiPropertyOptional() @IsOptional() @IsInt() @Min(0) @Max(10_000) sortOrder?: number;
  @ApiPropertyOptional({ nullable: true }) @IsOptional() @IsString() @MaxLength(2000) coverStorageKey?: string | null;
  @ApiPropertyOptional({ enum: ['draft', 'published'] }) @IsOptional() @IsIn(['draft', 'published']) status?: 'draft' | 'published';
  @ApiPropertyOptional({ nullable: true, format: 'uuid' }) @IsOptional() @IsUUID() parentId?: string | null;
}

export class ReorderItemDto {
  @ApiProperty({ format: 'uuid' }) @IsUUID() id: string;
  @ApiProperty() @IsInt() @Min(0) @Max(10_000) sortOrder: number;
}

export class ReorderDto {
  @ApiProperty({ type: [ReorderItemDto] }) @IsArray() @ArrayMaxSize(500) @ValidateNested({ each: true }) @Type(() => ReorderItemDto) items: ReorderItemDto[];
}

// --------------------------------------------------------------------- Pagos
export class ManualPaymentsQueryDto {
  @ApiPropertyOptional({ example: '2026-10-09', description: 'Día de Lima (YYYY-MM-DD); por defecto hoy.' }) @IsOptional() @Matches(/^\d{4}-\d{2}-\d{2}$/) date?: string;
}

export class VoidPaymentDto {
  @ApiProperty({ description: 'Motivo de la anulación (queda en el pago, no en audit_log).', minLength: 5, maxLength: 500 }) @IsString() @Length(5, 500) reason: string;
}
