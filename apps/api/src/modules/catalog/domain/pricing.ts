import type { CalendarDate } from '../../../shared/domain/calendar-date.js';
import { BusinessRuleError, ValidationError } from '../../../shared/domain/domain-error.js';
import { Money, type CurrencyCode } from '../../../shared/domain/money.js';
import type { PaxType, Residency, Tour } from './tour.js';

/** Tarifa por persona (céntimos) para tour x pasajero x residencia x moneda x vigencia. */
export interface Rate {
  id: string;
  tourId: string;
  paxType: PaxType;
  residency: Residency;
  currency: CurrencyCode;
  amount: bigint;
  validFrom: CalendarDate;
  validTo: CalendarDate;
  minGroupSize: number;
  maxGroupSize: number | null;
  isActive: boolean;
  /** Prioridad de la temporada asociada (null = tarifa base sin temporada). */
  seasonPriority: number | null;
}

export interface PaxLine {
  paxType: PaxType;
  residency: Residency;
  quantity: number;
}

export interface QuotedLine extends PaxLine {
  rateId: string;
  unitAmount: Money;
  lineAmount: Money;
}

export interface Quote {
  tourId: string;
  travelDate: CalendarDate;
  currency: CurrencyCode;
  lines: QuotedLine[];
  subtotal: Money;
  paxCount: number;
}

export const MAX_QUANTITY_PER_LINE = 50;

/** Reglas de composición de pasajeros (HU-2.2, RN-18). */
export function validatePaxLines(tour: Tour, lines: readonly PaxLine[]): number {
  if (lines.length === 0) {
    throw new ValidationError('pax-required', 'Indica al menos un pasajero.');
  }
  const seen = new Set<string>();
  for (const line of lines) {
    if (!Number.isInteger(line.quantity) || line.quantity < 1 || line.quantity > MAX_QUANTITY_PER_LINE) {
      throw new ValidationError('invalid-pax-quantity', 'La cantidad de pasajeros por tipo debe ser un entero entre 1 y 50.', {
        paxType: line.paxType,
      });
    }
    const key = `${line.paxType}:${line.residency}`;
    if (seen.has(key)) {
      throw new ValidationError('duplicate-pax-line', 'Cada combinación de tipo de pasajero y residencia debe aparecer una sola vez.', {
        paxType: line.paxType,
        residency: line.residency,
      });
    }
    seen.add(key);
  }
  const total = lines.reduce((sum, l) => sum + l.quantity, 0);
  const hasChild = lines.some((l) => l.paxType === 'child');
  const hasGrownUp = lines.some((l) => l.paxType !== 'child');
  if (hasChild && !hasGrownUp) {
    throw new BusinessRuleError('minor-without-adult', 'Los menores deben viajar con al menos un adulto.');
  }
  if (total < tour.minPax) {
    // RN-18: el suplemento individual está pendiente del cliente; mientras tanto se bloquea.
    throw new BusinessRuleError('below-min-pax', `Este tour requiere un mínimo de ${tour.minPax} pasajeros.`, {
      minPax: tour.minPax,
      requested: total,
    });
  }
  if (tour.maxPax !== null && total > tour.maxPax) {
    throw new BusinessRuleError('above-max-pax', `Este tour admite como máximo ${tour.maxPax} pasajeros.`, {
      maxPax: tour.maxPax,
      requested: total,
    });
  }
  return total;
}

function rateApplies(rate: Rate, line: PaxLine, currency: CurrencyCode, date: CalendarDate, groupSize: number): boolean {
  return (
    rate.isActive &&
    rate.paxType === line.paxType &&
    rate.residency === line.residency &&
    rate.currency === currency &&
    rate.validFrom <= date &&
    date <= rate.validTo &&
    groupSize >= rate.minGroupSize &&
    (rate.maxGroupSize === null || groupSize <= rate.maxGroupSize)
  );
}

/**
 * Elige la tarifa aplicable: gana la de temporada con mayor prioridad; si no hay, la base.
 * (El EXCLUDE de la base impide solapes dentro de la misma temporada.)
 */
export function selectRate(
  rates: readonly Rate[],
  line: PaxLine,
  currency: CurrencyCode,
  date: CalendarDate,
  groupSize: number,
): Rate | undefined {
  return rates
    .filter((r) => rateApplies(r, line, currency, date, groupSize))
    .sort((a, b) => (b.seasonPriority ?? -1) - (a.seasonPriority ?? -1) || (a.amount < b.amount ? -1 : 1))[0];
}

/** Cotiza un tour para una fecha y composición de pasajeros en la moneda pedida. */
export function quoteTour(params: {
  tour: Tour;
  rates: readonly Rate[];
  travelDate: CalendarDate;
  currency: CurrencyCode;
  lines: readonly PaxLine[];
}): Quote {
  const { tour, rates, travelDate, currency, lines } = params;
  const paxCount = validatePaxLines(tour, lines);
  const quoted: QuotedLine[] = lines.map((line) => {
    const rate = selectRate(rates, line, currency, travelDate, paxCount);
    if (!rate) {
      throw new BusinessRuleError('rate-not-available', 'No hay tarifa vigente para esta fecha, tipo de pasajero y moneda.', {
        tourId: tour.id,
        travelDate,
        currency,
        paxType: line.paxType,
        residency: line.residency,
      });
    }
    const unitAmount = Money.of(rate.amount, currency);
    return { ...line, rateId: rate.id, unitAmount, lineAmount: unitAmount.multiply(line.quantity) };
  });
  return {
    tourId: tour.id,
    travelDate,
    currency,
    lines: quoted,
    subtotal: Money.sum(quoted.map((l) => l.lineAmount)),
    paxCount,
  };
}

/**
 * "Precio desde" para tarjetas y ficha: menor tarifa activa de adulto (o de cualquier
 * pasajero si no hay de adulto) vigente desde `today`. Null = "Consultar precio".
 */
export function priceFrom(rates: readonly Rate[], currency: CurrencyCode, today: CalendarDate): Money | null {
  const usable = rates.filter((r) => r.isActive && r.currency === currency && r.validTo >= today);
  const adults = usable.filter((r) => r.paxType === 'adult');
  const pool = adults.length > 0 ? adults : usable;
  if (pool.length === 0) return null;
  const min = pool.reduce((acc, r) => (r.amount < acc ? r.amount : acc), pool[0]!.amount);
  return Money.of(min, currency);
}
