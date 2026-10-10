import { Controller, Get, Inject, Param, Query, Res } from '@nestjs/common';
import { ApiMovedPermanentlyResponse, ApiNotFoundResponse, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { MEDIA_URL_RESOLVER } from '../../../shared/application/tokens.js';
import type { MediaUrlResolver } from '../../media/domain/media.js';
import { assertCalendarDate } from '../../../shared/domain/calendar-date.js';
import { money, pageMeta } from '../../../shared/interface/common.dto.js';
import { CatalogQueries, type TaxonomyEntry, type TourDetail } from '../application/catalog-queries.js';
import type { TourListing } from '../domain/catalog.repository.js';
import type { Category, Destination } from '../domain/taxonomy.js';
import { coverImage, resolveTourTranslation, type Locale } from '../domain/tour.js';
import { DeparturesQueryDto, ListToursQueryDto, LocaleCurrencyQueryDto, LocaleQueryDto } from './catalog.dto.js';

/** 301 de la API al slug correcto del idioma (I3). El servidor de Next lo sigue o lo reenvía al navegador. */
function redirectTo(res: Response, path: string, query: Record<string, string>, slug: string, locale: Locale) {
  res.status(301).setHeader('Location', `/api/v1/${path}/${encodeURIComponent(slug)}?${new URLSearchParams(query).toString()}`);
  return { data: { redirect: { slug, locale } } };
}

function presentCard(listing: TourListing, locale: Locale, urls: MediaUrlResolver) {
  const { tour, priceFrom } = listing;
  const resolved = resolveTourTranslation(tour, locale)!;
  const translation = resolved.translation;
  const cover = coverImage(tour);
  return {
    id: tour.id,
    slug: translation.slug,
    /** Idioma realmente servido y si fue fallback a `es` (I6). */
    locale: resolved.locale,
    fallback: resolved.fallback,
    title: translation.title,
    summary: translation.summary,
    type: tour.type,
    durationDays: tour.durationDays,
    durationNights: tour.durationNights,
    durationHours: tour.durationHours,
    difficulty: tour.difficulty,
    minPax: tour.minPax,
    isFeatured: tour.isFeatured,
    categoryId: tour.categoryId,
    destinationIds: tour.destinations.map((d) => d.destinationId),
    coverImage: cover ? { url: urls.url(cover.url), alt: (locale === 'en' ? (cover.altEn ?? cover.altEs) : cover.altEs) ?? translation.title } : null,
    /** null => "Consultar precio" (HU-1.1). */
    priceFrom: priceFrom ? money(priceFrom) : null,
    bookable: priceFrom !== null,
  };
}

function presentDetail(detail: TourDetail, locale: Locale, urls: MediaUrlResolver) {
  const { tour, translation } = detail;
  return {
    ...presentCard({ tour, priceFrom: detail.priceFrom }, locale, urls),
    code: tour.code,
    requestedLocale: locale,
    description: translation.description,
    itinerary: translation.itinerary,
    includes: translation.includes,
    notIncluded: translation.notIncluded,
    recommendations: translation.recommendations,
    importantNotes: translation.importantNotes,
    faqs: translation.faqs,
    policies: translation.policies,
    meetingPoint: translation.meetingPoint,
    seo: { title: translation.seoTitle ?? translation.title, description: translation.seoDescription ?? translation.summary },
    maxPax: tour.maxPax,
    languages: tour.languages,
    bookingCutoffHours: tour.bookingCutoffHours,
    requiresTravelerDocument: tour.requiresTravelerDocument,
    usesInventory: tour.usesInventory,
    alternateLocales: tour.translations.map((t) => ({ locale: t.locale, slug: t.slug })),
    media: tour.media.map((m) => ({ url: urls.url(m.url), kind: m.kind, alt: (locale === 'en' ? (m.altEn ?? m.altEs) : m.altEs) ?? null, isCover: m.isCover })),
    category: detail.category ? { id: detail.category.id, slug: detail.category.translations.find((t) => t.locale === locale)?.slug ?? detail.category.slug } : null,
    destinations: detail.destinations.map((d) => ({
      id: d.destination.id,
      slug: d.destination.translations.find((t) => t.locale === locale)?.slug ?? d.destination.slug,
      isPrimary: d.isPrimary,
    })),
    rates: detail.rates.map((r) => ({
      id: r.id,
      paxType: r.paxType,
      residency: r.residency,
      amount: { amount: r.amount, currency: r.currency },
      validFrom: r.validFrom,
      validTo: r.validTo,
      minGroupSize: r.minGroupSize,
      maxGroupSize: r.maxGroupSize,
    })),
  };
}


function presentTaxonomy(e: TaxonomyEntry<Destination | Category>, urls: MediaUrlResolver) {
  return {
    id: e.entity.id,
    slug: e.slug,
    canonicalSlug: e.entity.slug,
    locale: e.locale,
    fallback: e.fallback,
    name: e.name,
    description: e.description,
    tourCount: e.tourCount,
    coverImage: e.entity.coverStorageKey ? { url: urls.url(e.entity.coverStorageKey), alt: e.name } : null,
    alternateLocales: e.entity.translations.map((t) => ({ locale: t.locale, slug: t.slug ?? e.entity.slug })),
  };
}

@ApiTags('catalog')
@Controller()
export class CatalogController {
  constructor(
    @Inject(CatalogQueries) private readonly queries: CatalogQueries,
    @Inject(MEDIA_URL_RESOLVER) private readonly urls: MediaUrlResolver,
  ) {}

  @Get('tours')
  @ApiOperation({ summary: 'Listar y buscar tours publicados (filtros, orden y paginación).' })
  @ApiOkResponse({ description: '`{ data: TourCard[], meta }`. Montos en céntimos.' })
  async listTours(@Query() query: ListToursQueryDto) {
    const result = await this.queries.searchTours({
      locale: query.locale,
      currency: query.currency,
      text: query.q?.trim() || undefined,
      destinationSlug: query.destination,
      categorySlug: query.category,
      type: query.type,
      difficulty: query.difficulty,
      minDays: query.minDays,
      maxDays: query.maxDays,
      featured: query.featured,
      minPrice: query.minPrice !== undefined ? BigInt(query.minPrice) : undefined,
      maxPrice: query.maxPrice !== undefined ? BigInt(query.maxPrice) : undefined,
      sort: query.sort,
      page: query.page,
      pageSize: query.pageSize,
    });
    return {
      data: result.items.map((l) => presentCard(l, query.locale, this.urls)),
      meta: Object.assign(pageMeta(result.page, result.pageSize, result.total), { locale: query.locale }),
    };
  }

  @Get('tours/:slug')
  @ApiOperation({
    summary:
      'Ficha del tour por slug de cualquier idioma. Sin traducción en el idioma pedido se sirve `es` con `fallback: true`. ' +
      'Si el slug pertenece a otro idioma y existe la traducción pedida: 301 (Location) al slug correcto.',
  })
  @ApiMovedPermanentlyResponse({ description: '`{ data: { redirect: { slug, locale } } }` + Location.' })
  @ApiNotFoundResponse({ description: 'problem+json `tour-not-found`.' })
  async getTour(@Param('slug') slug: string, @Query() query: LocaleCurrencyQueryDto, @Res({ passthrough: true }) res: Response) {
    const result = await this.queries.getTourBySlug(slug, query.locale, query.currency);
    if (result.kind === 'redirect') return redirectTo(res, 'tours', { locale: query.locale, currency: query.currency }, result.slug, result.locale);
    return { data: presentDetail(result.value, query.locale, this.urls) };
  }

  @Get('tours/:slug/departures')
  @ApiOperation({
    summary:
      'Calendario de la ficha: salidas con `available`, `isClosed`, `bookable` y `priceFrom` (adulto, moneda pedida) POR FECHA. Ventana máxima 180 días (por defecto desde hoy).',
  })
  async listDepartures(@Param('slug') slug: string, @Query() query: DeparturesQueryDto) {
    const from = query.from ? assertCalendarDate(query.from, 'from') : undefined;
    const to = query.to ? assertCalendarDate(query.to, 'to') : undefined;
    const list = await this.queries.listDepartures(slug, from, to, query.currency);
    return { data: list.map((d) => ({ ...d, priceFrom: d.priceFrom ? money(d.priceFrom) : null })) };
  }

  @Get('destinations')
  @ApiOperation({ summary: 'Destinos publicados con cantidad de tours.' })
  async listDestinations(@Query() query: LocaleQueryDto) {
    const entries = await this.queries.listDestinations(query.locale);
    return { data: entries.map((e) => ({ ...presentTaxonomy(e, this.urls), parentId: e.entity.parentId })), meta: { locale: query.locale } };
  }

  @Get('destinations/:slug')
  @ApiOperation({ summary: 'Destino publicado por slug (de cualquier idioma; 301 al slug del idioma pedido). Fallback `es` como en tours.' })
  @ApiMovedPermanentlyResponse({ description: '`{ data: { redirect: { slug, locale } } }` + Location.' })
  @ApiNotFoundResponse({ description: 'destination-not-found' })
  async getDestination(@Param('slug') slug: string, @Query() query: LocaleQueryDto, @Res({ passthrough: true }) res: Response) {
    const r = await this.queries.getDestination(slug, query.locale);
    if (r.kind === 'redirect') return redirectTo(res, 'destinations', { locale: query.locale }, r.slug, r.locale);
    return { data: { ...presentTaxonomy(r.value, this.urls), parentId: r.value.entity.parentId } };
  }

  @Get('categories')
  @ApiOperation({ summary: 'Categorías con cantidad de tours publicados.' })
  async listCategories(@Query() query: LocaleQueryDto) {
    const entries = await this.queries.listCategories(query.locale);
    return { data: entries.map((e) => presentTaxonomy(e, this.urls)), meta: { locale: query.locale } };
  }

  @Get('categories/:slug')
  @ApiOperation({ summary: 'Categoría por slug (de cualquier idioma; 301 al slug del idioma pedido).' })
  @ApiMovedPermanentlyResponse({ description: '`{ data: { redirect: { slug, locale } } }` + Location.' })
  @ApiNotFoundResponse({ description: 'category-not-found' })
  async getCategory(@Param('slug') slug: string, @Query() query: LocaleQueryDto, @Res({ passthrough: true }) res: Response) {
    const r = await this.queries.getCategory(slug, query.locale);
    if (r.kind === 'redirect') return redirectTo(res, 'categories', { locale: query.locale }, r.slug, r.locale);
    return { data: presentTaxonomy(r.value, this.urls) };
  }
}
