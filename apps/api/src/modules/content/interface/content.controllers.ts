import { Body, Controller, Get, HttpCode, Inject, Param, Post, Query, Res } from '@nestjs/common';
import { ApiAcceptedResponse, ApiCreatedResponse, ApiMovedPermanentlyResponse, ApiNotFoundResponse, ApiOperation, ApiProperty, ApiPropertyOptional, ApiTags } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import { Equals, IsBoolean, IsEmail, IsIn, IsInt, IsOptional, IsString, Length, Matches, Max, MaxLength, Min } from 'class-validator';
import type { Response } from 'express';
import { MEDIA_URL_RESOLVER } from '../../../shared/application/tokens.js';
import { CONTENT_LOCALES, type ContentLocale } from '../../../shared/domain/i18n.js';
import { pageMeta } from '../../../shared/interface/common.dto.js';
import { ProblemDetailsDto } from '../../../shared/interface/problem-details.dto.js';
import { LinkThrottle } from '../../../shared/interface/throttling.js';
import type { MediaUrlResolver } from '../../media/domain/media.js';
import { ContentUseCases, type LocalizedPost } from '../application/content.use-cases.js';
import { SiteContentService } from '../application/site-content.service.js';
import type { Testimonial } from '../domain/content.js';

const SLUG = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const toBool = ({ value }: { value: unknown }) => (value === 'true' || value === true ? true : value === 'false' || value === false ? false : value);

class LocalePageQueryDto {
  @ApiPropertyOptional({ enum: CONTENT_LOCALES, default: 'es' })
  @IsOptional()
  @IsIn(CONTENT_LOCALES)
  locale: ContentLocale = 'es';

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

export class BlogListQueryDto extends LocalePageQueryDto {
  @ApiPropertyOptional({ description: 'Filtra por etiqueta (minúsculas).' })
  @IsOptional()
  @IsString()
  @MaxLength(60)
  tag?: string;
}

export class LocaleOnlyQueryDto {
  @ApiPropertyOptional({ enum: CONTENT_LOCALES, default: 'es' })
  @IsOptional()
  @IsIn(CONTENT_LOCALES)
  locale: ContentLocale = 'es';
}

export class TestimonialListQueryDto extends LocalePageQueryDto {
  @ApiPropertyOptional({ description: 'Solo testimonios de este tour.' })
  @IsOptional()
  @Matches(SLUG)
  tourSlug?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(toBool)
  @IsBoolean()
  featured?: boolean;

  @ApiPropertyOptional({ default: false, description: 'true = todos los idiomas (por defecto solo el pedido).' })
  @IsOptional()
  @Transform(toBool)
  @IsBoolean()
  allLocales?: boolean;
}

export class SubmitTestimonialDto {
  @ApiProperty({ example: 'Ana Q.' })
  @IsString()
  @Length(2, 120)
  authorName: string;

  @ApiPropertyOptional({ example: 'PE', description: 'ISO 3166-1 alfa-2' })
  @IsOptional()
  @Matches(/^[A-Za-z]{2}$/)
  authorCountry?: string;

  @ApiProperty({ minimum: 1, maximum: 5 })
  @IsInt()
  @Min(1)
  @Max(5)
  rating: number;

  @ApiProperty({ description: 'Texto plano: sin enlaces ni HTML (20-3000).' })
  @IsString()
  @Length(20, 3000)
  body: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Matches(SLUG)
  @MaxLength(160)
  tourSlug?: string;

  @ApiPropertyOptional({ example: '2026-05-01' })
  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  travelDate?: string;

  @ApiPropertyOptional({ enum: CONTENT_LOCALES, default: 'es' })
  @IsOptional()
  @IsIn(CONTENT_LOCALES)
  locale: ContentLocale = 'es';

  @ApiProperty({ description: 'Autoriza publicar el testimonio con su nombre (obligatorio).' })
  @IsBoolean()
  @Equals(true, { message: 'Debes autorizar la publicación.' })
  publishConsent: boolean;

  @ApiProperty({ description: 'Leyó el aviso de privacidad (Ley 29733, obligatorio).' })
  @IsBoolean()
  @Equals(true, { message: 'Debes aceptar el aviso de privacidad.' })
  consentPrivacyNotice: boolean;
}

export class ContactDto {
  @ApiProperty()
  @IsString()
  @Length(2, 120)
  name: string;

  @ApiProperty()
  @IsEmail()
  @MaxLength(254)
  email: string;

  @ApiPropertyOptional({ example: '+51987654321' })
  @IsOptional()
  @Matches(/^\+?[0-9 ()-]{6,20}$/)
  phone?: string;

  @ApiProperty()
  @IsString()
  @Length(3, 150)
  subject: string;

  @ApiProperty({ description: '10-5000 caracteres.' })
  @IsString()
  @Length(10, 5000)
  message: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Matches(SLUG)
  @MaxLength(160)
  tourSlug?: string;

  @ApiPropertyOptional({ enum: CONTENT_LOCALES, default: 'es' })
  @IsOptional()
  @IsIn(CONTENT_LOCALES)
  locale: ContentLocale = 'es';

  @ApiProperty({ description: 'Leyó el aviso de privacidad (obligatorio).' })
  @IsBoolean()
  @Equals(true, { message: 'Debes aceptar el aviso de privacidad.' })
  consentPrivacyNotice: boolean;
}

function presentPost(p: LocalizedPost, urls: MediaUrlResolver, full: boolean) {
  const t = p.translation;
  return {
    id: p.post.id,
    slug: t.slug,
    locale: p.locale,
    fallback: p.fallback,
    title: t.title,
    excerpt: t.excerpt,
    coverImage: p.post.coverStorageKey ? { url: urls.url(p.post.coverStorageKey), alt: t.title } : null,
    publishedAt: p.post.publishedAt,
    tags: p.post.tags,
    alternateLocales: p.post.translations.map((x) => ({ locale: x.locale, slug: x.slug })),
    ...(full ? { body: t.body, seo: { title: t.seoTitle ?? t.title, description: t.seoDescription ?? t.excerpt }, updatedAt: p.post.updatedAt } : {}),
  };
}

export function presentTestimonial(t: Testimonial) {
  return {
    id: t.id,
    authorName: t.authorName,
    authorCountry: t.authorCountry,
    locale: t.locale,
    rating: t.rating,
    body: t.body,
    travelDate: t.travelDate,
    isFeatured: t.isFeatured,
    source: t.origin === 'legacy_site' ? t.source : null,
    sourceUrl: t.origin === 'legacy_site' ? t.sourceUrl : null,
    tourId: t.tourId,
    approvedAt: t.approvedAt,
  };
}

@ApiTags('content')
@Controller()
export class ContentController {
  constructor(
    @Inject(ContentUseCases) private readonly content: ContentUseCases,
    @Inject(SiteContentService) private readonly site: SiteContentService,
    @Inject(MEDIA_URL_RESOLVER) private readonly urls: MediaUrlResolver,
  ) {}

  @Get('blog')
  @ApiOperation({ summary: 'Blog publicado (más reciente primero). Sin traducción `en`, se sirve `es` con `fallback: true`.' })
  async listPosts(@Query() q: BlogListQueryDto) {
    const r = await this.content.listPosts({ locale: q.locale, page: q.page, pageSize: q.pageSize, tag: q.tag?.toLowerCase() });
    return { data: r.items.map((p) => presentPost(p, this.urls, false)), meta: Object.assign(pageMeta(q.page, q.pageSize, r.total), { locale: q.locale }) };
  }

  @Get('blog/:slug')
  @ApiOperation({ summary: 'Artículo por slug de cualquier idioma; 301 al slug del idioma pedido.' })
  @ApiMovedPermanentlyResponse({ description: '`{ data: { redirect: { slug, locale } } }` + Location.' })
  @ApiNotFoundResponse({ type: ProblemDetailsDto, description: 'blog-post-not-found' })
  async getPost(@Param('slug') slug: string, @Query() q: LocaleOnlyQueryDto, @Res({ passthrough: true }) res: Response) {
    const r = await this.content.getPost(slug, q.locale);
    if (r.kind === 'redirect') {
      res.status(301).setHeader('Location', `/api/v1/blog/${encodeURIComponent(r.slug)}?locale=${r.locale}`);
      return { data: { redirect: { slug: r.slug, locale: r.locale } } };
    }
    return { data: presentPost(r.value, this.urls, true) };
  }

  @Get('testimonials')
  @ApiOperation({ summary: 'Testimonios aprobados (con consentimiento o heredados del sitio viejo), destacados primero.' })
  async listTestimonials(@Query() q: TestimonialListQueryDto) {
    const r = await this.content.listTestimonials({ locale: q.allLocales ? undefined : q.locale, tourSlug: q.tourSlug, featured: q.featured, page: q.page, pageSize: q.pageSize });
    return { data: r.items.map(presentTestimonial), meta: Object.assign(pageMeta(q.page, q.pageSize, r.total), { locale: q.locale }) };
  }

  @Post('testimonials')
  @HttpCode(202)
  @LinkThrottle()
  @ApiOperation({ summary: 'Deja un testimonio: queda PENDIENTE de moderación. Exige consentimiento de publicación y aviso de privacidad; sin URLs ni HTML.' })
  @ApiAcceptedResponse({ description: '`{ data: { id, status: "pending" } }`' })
  async submitTestimonial(@Body() body: SubmitTestimonialDto) {
    const t = await this.content.submitTestimonial(body);
    return { data: { id: t.id, status: t.status } };
  }

  @Post('contact')
  @HttpCode(201)
  @LinkThrottle()
  @ApiOperation({ summary: 'Formulario de contacto: guarda el mensaje, avisa a la agencia (AGENCY_INBOX_EMAIL) y envía acuse al cliente.' })
  @ApiCreatedResponse({ description: '`{ data: { id, status: "received" } }`' })
  async contact(@Body() body: ContactDto) {
    const r = await this.content.submitContact(body);
    return { data: { id: r.id, status: 'received' } };
  }

  @Get('site-content')
  @ApiOperation({ summary: 'Contenido institucional heredado (Quiénes somos, FAQ generales, redes, teléfonos y horario). Solo `es` por ahora (`fallback`).' })
  @ApiNotFoundResponse({ type: ProblemDetailsDto, description: 'site-content-not-found' })
  async siteContent(@Query() q: LocaleOnlyQueryDto) {
    const data = await this.site.get(q.locale);
    return { data };
  }
}
