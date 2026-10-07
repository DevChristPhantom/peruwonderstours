import { addMinutes, startOfDayInLima, type CalendarDate } from '../../../shared/domain/calendar-date.js';
import { BusinessRuleError, NotFoundError, ValidationError } from '../../../shared/domain/domain-error.js';
import type { CurrencyCode } from '../../../shared/domain/money.js';
import type { CatalogRepository, InventoryRepository } from '../domain/catalog.repository.js';
import { SoldOutError, type Departure } from '../domain/departure.js';
import { quoteTour, type PaxLine, type Quote } from '../domain/pricing.js';
import { isTourPublished, type Tour } from '../domain/tour.js';

export class TourNotFoundError extends NotFoundError {
  constructor(ref: string) {
    super('tour-not-found', 'El tour no existe o no está publicado.', { tour: ref });
  }
}

export interface QuoteRequest {
  tourId: string;
  travelDate: CalendarDate;
  departureId?: string | null;
  currency: CurrencyCode;
  lines: readonly PaxLine[];
  now: Date;
}

export interface QuoteResult {
  tour: Tour;
  quote: Quote;
  departure: Departure | null;
}

/**
 * Cotiza y valida que un tour sea vendible para una fecha: publicado, fuera del cierre de
 * ventas, con salida y cupo (sin retenerlo) y con tarifa vigente en la moneda pedida.
 */
export class TourQuoteService {
  async quote(request: QuoteRequest, deps: { catalog: CatalogRepository; inventory: InventoryRepository }): Promise<QuoteResult> {
    const tour = await deps.catalog.findTourById(request.tourId);
    if (!tour || !isTourPublished(tour)) throw new TourNotFoundError(request.tourId);

    const departure = tour.usesInventory ? await this.resolveDeparture(tour, request, deps.inventory) : null;
    this.assertSalesOpen(tour, request.travelDate, departure, request.now);

    const rates = await deps.catalog.findRates(tour.id);
    const quote = quoteTour({ tour, rates, travelDate: request.travelDate, currency: request.currency, lines: request.lines });

    if (departure && !departure.isSellable(quote.paxCount)) {
      throw new SoldOutError({
        departureId: departure.id,
        tourId: tour.id,
        date: departure.departureDate,
        requested: quote.paxCount,
        available: departure.isClosed ? 0 : departure.available,
      });
    }
    return { tour, quote, departure };
  }

  private async resolveDeparture(tour: Tour, request: QuoteRequest, inventory: InventoryRepository): Promise<Departure> {
    if (request.departureId) {
      const departure = await inventory.findDeparture(request.departureId);
      if (!departure || departure.tourId !== tour.id || departure.departureDate !== request.travelDate) {
        throw new ValidationError('departure-mismatch', 'La salida no corresponde al tour y fecha indicados.');
      }
      return departure;
    }
    const sameDay = await inventory.findDepartures(tour.id, request.travelDate, request.travelDate);
    if (sameDay.length === 0) {
      throw new BusinessRuleError('no-departure', 'No hay salida programada para esa fecha.', {
        tourId: tour.id,
        travelDate: request.travelDate,
      });
    }
    if (sameDay.length > 1) {
      throw new ValidationError('departure-required', 'Hay varias salidas ese día: indica departureId.', {
        departureIds: sameDay.map((d) => d.id),
      });
    }
    return sameDay[0]!;
  }

  private assertSalesOpen(tour: Tour, travelDate: CalendarDate, departure: Departure | null, now: Date): void {
    const [hh, mm] = (departure?.startTime ?? '00:00').split(':').map(Number);
    const serviceStart = addMinutes(startOfDayInLima(travelDate), (hh ?? 0) * 60 + (mm ?? 0));
    const salesCloseAt = addMinutes(serviceStart, -tour.bookingCutoffHours * 60);
    if (now.getTime() >= salesCloseAt.getTime()) {
      throw new BusinessRuleError('sales-closed', 'La venta para esta fecha está cerrada.', {
        travelDate,
        salesCloseAt: salesCloseAt.toISOString(),
      });
    }
  }
}
