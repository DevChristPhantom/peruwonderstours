import type { PrismaClient } from '../../generated/prisma/client.js';
import {
  demoDepartureId,
  generateDemoPricing,
} from '../../modules/catalog/infrastructure/seed/demo-pricing.js';
import type { PrismaTx } from '../../persistence/prisma/prisma-client.js';
import {
  addDays,
  calendarDateFromUtcDate,
  calendarDateToUtcDate,
  toLimaCalendarDate,
} from '../../shared/domain/calendar-date.js';

/**
 * Tarifas y salidas FICTICIAS en PostgreSQL para probar la reserva de punta a punta
 * mientras el cliente no entrega precios (`db:seed -- --demo-pricing`).
 * Marca inequívoca:
 * - Tarifas: `season_id` = temporada `DEMO`, cuyo nombre lo dice expresamente.
 * - Salidas: id UUID v5 determinista del espacio `demo-departure` (slug + fecha);
 *   el esquema no tiene campo de notas en `departures`.
 * Nunca toca tarifas reales: si un tour ya tiene tarifas fuera de la temporada DEMO, se omite.
 */
export const DEMO_SEASON_CODE = 'DEMO';
export const DEMO_MARK =
  'DEMO — precio ficticio, reemplazar con tarifas del cliente';

export interface DemoPricingSeedOptions {
  now: Date;
  /** Días de salidas desde hoy (Lima). */
  departureDays?: number;
  /** Cupo por salida (grupo turístico típico). */
  capacity?: number;
}

export interface DemoPricingReport {
  season: 'created' | 'updated';
  tours: number;
  toursSkippedWithRealRates: string[];
  rates: { created: number; updated: number };
  departures: { created: number; existing: number };
}

export interface DemoPricingRemovalReport {
  rates: number;
  departures: number;
  season: number;
}

export class DemoPricingInUseError extends Error {
  constructor(readonly usage: Record<string, number>) {
    super(
      `No se eliminó nada: las tarifas/salidas DEMO tienen datos asociados ${JSON.stringify(usage)}. ` +
        'Cancela o reasigna esas reservas/carritos antes de quitar los precios de demostración.',
    );
    this.name = 'DemoPricingInUseError';
  }
}

export function seedDemoPricing(
  prisma: PrismaClient,
  options: DemoPricingSeedOptions,
): Promise<DemoPricingReport> {
  return prisma.$transaction((tx) => applyDemoPricing(tx, options), {
    timeout: 120_000,
    maxWait: 10_000,
  });
}

/** Igual que seedDemoPricing dentro de una transacción ya abierta. */
export async function applyDemoPricing(
  tx: PrismaTx,
  options: DemoPricingSeedOptions,
): Promise<DemoPricingReport> {
  const today = toLimaCalendarDate(options.now);
  const departureDays = options.departureDays ?? 120;
  const capacity = options.capacity ?? 12;

  const seasonWindow = {
    startDate: calendarDateToUtcDate(addDays(today, -30)),
    endDate: calendarDateToUtcDate(addDays(today, 400)),
  };
  const existingSeason = await tx.season.findUnique({
    where: { code: DEMO_SEASON_CODE },
  });
  const season = await tx.season.upsert({
    where: { code: DEMO_SEASON_CODE },
    create: {
      code: DEMO_SEASON_CODE,
      name: DEMO_MARK,
      priority: 0,
      ...seasonWindow,
    },
    update: { name: DEMO_MARK, ...seasonWindow },
  });

  const tours = await tx.tour.findMany({
    where: { deletedAt: null },
    select: { id: true, slug: true, durationDays: true },
    orderBy: { slug: 'asc' },
  });
  const withRealRates = await tx.rate.findMany({
    where: {
      deletedAt: null,
      OR: [{ seasonId: null }, { seasonId: { not: season.id } }],
    },
    select: { tourId: true },
    distinct: ['tourId'],
  });
  const skip = new Set(withRealRates.map((r) => r.tourId));
  const eligible = tours.filter((t) => !skip.has(t.id));
  const demo = generateDemoPricing(eligible, {
    today,
    departureDays,
    capacity,
  });

  const report: DemoPricingReport = {
    season: existingSeason ? 'updated' : 'created',
    tours: eligible.length,
    toursSkippedWithRealRates: tours
      .filter((t) => skip.has(t.id))
      .map((t) => t.slug),
    rates: { created: 0, updated: 0 },
    departures: { created: 0, existing: 0 },
  };

  const existingRateIds = new Set(
    (
      await tx.rate.findMany({
        where: { id: { in: demo.rates.map((r) => r.id) } },
        select: { id: true },
      })
    ).map((r) => r.id),
  );
  for (const r of demo.rates) {
    const data = {
      amount: r.amount,
      validFrom: calendarDateToUtcDate(r.validFrom),
      validTo: calendarDateToUtcDate(r.validTo),
      isActive: true,
      deletedAt: null,
      seasonId: season.id,
    };
    if (existingRateIds.has(r.id)) {
      await tx.rate.update({ where: { id: r.id }, data });
      report.rates.updated += 1;
    } else {
      await tx.rate.create({
        data: {
          id: r.id,
          tourId: r.tourId,
          paxType: r.paxType,
          residency: r.residency,
          currency: r.currency,
          minGroupSize: r.minGroupSize,
          ...data,
        },
      });
      report.rates.created += 1;
    }
  }

  // Salidas: solo inserta las que faltan; no toca cupos ya vendidos/retenidos.
  const created = await tx.departure.createMany({
    data: demo.departures.map((d) => ({
      id: d.id,
      tourId: d.tourId,
      departureDate: calendarDateToUtcDate(d.departureDate),
      capacity: d.capacity,
    })),
    skipDuplicates: true,
  });
  report.departures.created = created.count;
  report.departures.existing = demo.departures.length - created.count;
  return report;
}

/** Ids de las filas DEMO actuales (tarifas por temporada; salidas por id determinista). */
async function findDemoRows(tx: PrismaTx): Promise<{
  seasonId: string | null;
  rateIds: string[];
  departureIds: string[];
}> {
  const season = await tx.season.findUnique({
    where: { code: DEMO_SEASON_CODE },
  });
  const rateIds = season
    ? (
        await tx.rate.findMany({
          where: { seasonId: season.id },
          select: { id: true },
        })
      ).map((r) => r.id)
    : [];
  const departures = await tx.departure.findMany({
    select: { id: true, departureDate: true, tour: { select: { slug: true } } },
  });
  const departureIds = departures
    .filter(
      (d) =>
        d.id ===
        demoDepartureId(d.tour.slug, calendarDateFromUtcDate(d.departureDate)),
    )
    .map((d) => d.id);
  return { seasonId: season?.id ?? null, rateIds, departureIds };
}

/**
 * Elimina SOLO lo marcado como DEMO. Si alguna reserva o carrito usa esas tarifas o salidas,
 * aborta sin borrar nada (DemoPricingInUseError).
 */
export function removeDemoPricing(
  prisma: PrismaClient,
): Promise<DemoPricingRemovalReport> {
  return prisma.$transaction((tx) => deleteDemoPricing(tx), {
    timeout: 120_000,
    maxWait: 10_000,
  });
}

/** Igual que removeDemoPricing dentro de una transacción ya abierta. */
export async function deleteDemoPricing(
  tx: PrismaTx,
): Promise<DemoPricingRemovalReport> {
  const { seasonId, rateIds, departureIds } = await findDemoRows(tx);
  const usage = {
    bookingItems: await tx.bookingItem.count({
      where: { departureId: { in: departureIds } },
    }),
    bookingItemLines: await tx.bookingItemLine.count({
      where: { rateId: { in: rateIds } },
    }),
    cartItems: await tx.cartItem.count({
      where: { departureId: { in: departureIds } },
    }),
    cartItemLines: await tx.cartItemLine.count({
      where: { rateId: { in: rateIds } },
    }),
    inventoryHolds: await tx.inventoryHold.count({
      where: { departureId: { in: departureIds } },
    }),
  };
  const inUse = Object.fromEntries(
    Object.entries(usage).filter(([, n]) => n > 0),
  );
  if (Object.keys(inUse).length > 0) throw new DemoPricingInUseError(inUse);

  const rates = await tx.rate.deleteMany({
    where: { id: { in: rateIds } },
  });
  const departures = await tx.departure.deleteMany({
    where: { id: { in: departureIds } },
  });
  const season = seasonId
    ? await tx.season.deleteMany({ where: { id: seasonId } })
    : { count: 0 };
  return {
    rates: rates.count,
    departures: departures.count,
    season: season.count,
  };
}
