import { addDays, type CalendarDate } from '../../../../shared/domain/calendar-date.js';
import type { CurrencyCode } from '../../../../shared/domain/money.js';
import type { DepartureSnapshot } from '../../domain/departure.js';
import type { Rate } from '../../domain/pricing.js';
import type { PaxType, Residency, Tour } from '../../domain/tour.js';
import { deterministicUuid } from './seed-mapper.js';

/**
 * DATOS FICTICIOS para el modo demo (`DEMO_PRICING=true`). El cliente aún no entregó
 * precios ni cupos (0 de 41 tours con precio): nada de esto se carga en PostgreSQL.
 */
export interface DemoPricingOptions {
  today: CalendarDate;
  departureDays: number;
  capacity: number;
}

const PAX_FACTORS: Record<PaxType, number> = { adult: 100, child: 70, student: 80, senior: 90 };
const BASE_PER_DAY: Record<CurrencyCode, Record<Residency, bigint>> = {
  USD: { foreign: 9_900n, national: 7_900n },
  PEN: { foreign: 36_900n, national: 29_900n },
};

export function generateDemoPricing(tours: readonly Tour[], options: DemoPricingOptions): { rates: Rate[]; departures: DepartureSnapshot[] } {
  const rates: Rate[] = [];
  const departures: DepartureSnapshot[] = [];
  const validFrom = addDays(options.today, -30);
  const validTo = addDays(options.today, 400);
  for (const tour of tours) {
    const days = BigInt(tour.durationDays ?? 1);
    for (const currency of ['USD', 'PEN'] as const) {
      for (const residency of ['foreign', 'national'] as const) {
        for (const paxType of Object.keys(PAX_FACTORS) as PaxType[]) {
          const amount = (BASE_PER_DAY[currency][residency] * days * BigInt(PAX_FACTORS[paxType])) / 100n;
          rates.push({
            id: deterministicUuid('demo-rate', `${tour.slug}:${currency}:${residency}:${paxType}`),
            tourId: tour.id,
            paxType,
            residency,
            currency,
            amount,
            validFrom,
            validTo,
            minGroupSize: 1,
            maxGroupSize: null,
            isActive: true,
            seasonPriority: null,
          });
        }
      }
    }
    for (let i = 0; i < options.departureDays; i += 1) {
      const date = addDays(options.today, i);
      departures.push({
        id: deterministicUuid('demo-departure', `${tour.slug}:${date}`),
        tourId: tour.id,
        departureDate: date,
        startTime: '00:00',
        capacity: options.capacity,
        booked: 0,
        held: 0,
        isClosed: false,
        version: 0,
      });
    }
  }
  return { rates, departures };
}
