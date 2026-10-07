import { Controller, Get, Inject, Param, Query } from '@nestjs/common';
import { ApiNotFoundResponse, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { assertCalendarDate } from '../../../shared/domain/calendar-date.js';
import { money, pageMeta } from '../../../shared/interface/common.dto.js';
import { CatalogQueries, type TourDetail } from '../application/catalog-queries.js';
import type { TourListing } from '../domain/catalog.repository.js';
import { coverImage, findTranslation, type Locale } from '../domain/tour.js';
import { DeparturesQueryDto, ListToursQueryDto, LocaleCurrencyQueryDto, LocaleQueryDto } from './catalog.dto.js';

function presentCard(listing: TourListing, locale: Locale) {
  const { tour, priceFrom } = listing;
  const translation = findTranslation(tour, locale)!;
  const cover = coverImage(tour);
  return {
    id: tour.id,
    slug: translation.slug,
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
    coverImage: cover ? { url: cover.url, alt: (locale === 'en' ? cover.altEn : cover.altEs) ?? translation.title } : null,
    /** null => "Consultar precio" (HU-1.1). */
    priceFrom: priceFrom ? money(priceFrom) : null,
    bookable: priceFrom !== null,
  };
}

function presentDetail(detail: TourDetail, locale: Locale) {
  const { tour, translation } = detail;
  return {
    ...presentCard({ tour, priceFrom: detail.priceFrom }, locale),
    code: tour.code,
    locale,
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
    media: tour.media.map((m) => ({ url: m.url, kind: m.kind, alt: (locale === 'en' ? m.altEn : m.altEs) ?? null, isCover: m.isCover })),
    category: detail.category ? { id: detail.category.id, slug: detail.category.slug } : null,
    destinations: detail.destinations.map((d) => ({ id: d.destination.id, slug: d.destination.slug, isPrimary: d.isPrimary })),
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


@ApiTags('catalog')
@Controller()
export class CatalogController {
  constructor(@Inject(CatalogQueries) private readonly queries: CatalogQueries) {}

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
    return { data: result.items.map((l) => presentCard(l, query.locale)), meta: pageMeta(result.page, result.pageSize, result.total) };
  }

  @Get('tours/:slug')
  @ApiOperation({ summary: 'Ficha del tour por slug (canónico o del idioma).' })
  @ApiNotFoundResponse({ description: 'problem+json `tour-not-found` (también si no hay traducción en el idioma pedido).' })
  async getTour(@Param('slug') slug: string, @Query() query: LocaleCurrencyQueryDto) {
    const detail = await this.queries.getTour(slug, query.locale, query.currency);
    return { data: presentDetail(detail, query.locale) };
  }

  @Get('tours/:slug/departures')
  @ApiOperation({ summary: 'Calendario de salidas con cupo disponible.' })
  async listDepartures(@Param('slug') slug: string, @Query() query: DeparturesQueryDto) {
    const from = query.from ? assertCalendarDate(query.from, 'from') : undefined;
    const to = query.to ? assertCalendarDate(query.to, 'to') : undefined;
    return { data: await this.queries.listDepartures(slug, from, to) };
  }

  @Get('destinations')
  @ApiOperation({ summary: 'Destinos publicados con cantidad de tours.' })
  async listDestinations(@Query() query: LocaleQueryDto) {
    const entries = await this.queries.listDestinations(query.locale);
    return {
      data: entries.map((e) => ({
        id: e.entity.id,
        slug: e.entity.slug,
        parentId: e.entity.parentId,
        name: e.name,
        description: e.description,
        tourCount: e.tourCount,
      })),
    };
  }

  @Get('categories')
  @ApiOperation({ summary: 'Categorías con cantidad de tours publicados.' })
  async listCategories(@Query() query: LocaleQueryDto) {
    const entries = await this.queries.listCategories(query.locale);
    return {
      data: entries.map((e) => ({ id: e.entity.id, slug: e.entity.slug, name: e.name, description: e.description, tourCount: e.tourCount })),
    };
  }
}
