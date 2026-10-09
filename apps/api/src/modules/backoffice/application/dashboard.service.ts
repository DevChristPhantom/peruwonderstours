import { addDays, calendarDateFromUtcDate, calendarDateToUtcDate, startOfDayInLima, toLimaCalendarDate } from '../../../shared/domain/calendar-date.js';
import { complaintTrafficLight, type TrafficLight } from '../domain/backoffice-rules.js';
import type { AdminDatabase } from '../infrastructure/admin-database.js';

type Totals = Record<string, { amount: bigint; count: number }>;

function addTo(totals: Totals, currency: string, amount: bigint, count = 1): void {
  totals[currency] ??= { amount: 0n, count: 0 };
  totals[currency].amount += amount;
  totals[currency].count += count;
}

function asList(totals: Totals) {
  return Object.entries(totals).map(([currency, v]) => ({ currency, amount: v.amount, count: v.count }));
}

/** Tablero del backoffice (HU-7.8). Todo en zona America/Lima; montos por moneda (sin conversión). */
export class DashboardService {
  constructor(
    private readonly db: AdminDatabase,
    private readonly outboxMaxAttempts: number,
  ) {}

  async summary() {
    const now = this.db.now();
    const today = toLimaCalendarDate(now);
    const dayStart = startOfDayInLima(today);
    const dayEnd = startOfDayInLima(addDays(today, 1));
    const monthStart = startOfDayInLima(`${today.slice(0, 7)}-01`);
    const in7Days = new Date(now.getTime() + 7 * 24 * 3600 * 1000);
    const holidays = await this.db.holidays(addDays(today, -60), addDays(today, 60));

    return this.db.read(async (prisma) => {
      const [paymentsMonth, statusGroups, dueSoon, overdue, openComplaints, departures, outboxPending, outboxRetrying, outboxDead, dsrOpen] = await Promise.all([
        prisma.payment.findMany({
          where: { status: 'succeeded', succeededAt: { gte: monthStart, lt: dayEnd } },
          select: { amount: true, currency: true, kind: true, succeededAt: true },
        }),
        prisma.booking.groupBy({ by: ['status'], where: { deletedAt: null }, _count: { _all: true } }),
        prisma.booking.findMany({
          where: { status: 'partially_paid', deletedAt: null, balanceDueAt: { gte: now, lte: in7Days } },
          select: { code: true, totalAmount: true, paidAmount: true, currency: true, balanceDueAt: true },
          orderBy: { balanceDueAt: 'asc' },
          take: 200,
        }),
        prisma.booking.findMany({
          where: { status: 'partially_paid', deletedAt: null, balanceDueAt: { lt: now } },
          select: { totalAmount: true, paidAmount: true, currency: true },
          take: 1000,
        }),
        prisma.complaint.findMany({
          where: { status: { in: ['received', 'in_review'] } },
          select: { status: true, responseSentAt: true, responseDueAt: true, settlementOfferedAt: true, settlementExpiresAt: true, settlementAcceptedAt: true, settlementRejectedAt: true },
          take: 2000,
        }),
        prisma.departure.findMany({
          where: { departureDate: { gte: calendarDateToUtcDate(today), lte: calendarDateToUtcDate(addDays(today, 14)) } },
          include: { tour: { select: { code: true, translations: { where: { locale: 'es' }, select: { title: true } } } } },
          orderBy: [{ departureDate: 'asc' }, { startTime: 'asc' }],
          take: 100,
        }),
        prisma.outboxEvent.count({ where: { publishedAt: null, attempts: 0 } }),
        prisma.outboxEvent.count({ where: { publishedAt: null, attempts: { gt: 0, lt: this.outboxMaxAttempts } } }),
        prisma.outboxEvent.count({ where: { publishedAt: null, attempts: { gte: this.outboxMaxAttempts } } }),
        prisma.dataSubjectRequest.findMany({ where: { status: { in: ['received', 'in_progress'] } }, select: { dueAt: true } }),
      ]);

      const salesToday: Totals = {};
      const salesMonth: Totals = {};
      const refundsMonth: Totals = {};
      for (const p of paymentsMonth) {
        if (p.kind === 'refund') {
          addTo(refundsMonth, p.currency, p.amount);
          continue;
        }
        addTo(salesMonth, p.currency, p.amount);
        if (p.succeededAt && p.succeededAt.getTime() >= dayStart.getTime()) addTo(salesToday, p.currency, p.amount);
      }

      const balancesDue: Totals = {};
      for (const b of dueSoon) addTo(balancesDue, b.currency, b.totalAmount - b.paidAmount);
      const balancesOverdue: Totals = {};
      for (const b of overdue) addTo(balancesOverdue, b.currency, b.totalAmount - b.paidAmount);

      const lights: Record<TrafficLight, number> = { green: 0, yellow: 0, red: 0, overdue: 0, suspended: 0, done: 0 };
      for (const c of openComplaints) {
        const { light } = complaintTrafficLight({
          status: c.status,
          responseSentAt: c.responseSentAt,
          responseDueAt: c.responseDueAt,
          settlementOfferedAt: c.settlementOfferedAt,
          settlementExpiresAt: c.settlementExpiresAt,
          settlementResolved: c.settlementAcceptedAt !== null || c.settlementRejectedAt !== null,
          now,
          holidays,
        });
        lights[light] += 1;
      }

      return {
        generatedAt: now,
        timezone: 'America/Lima',
        sales: {
          today: asList(salesToday),
          month: asList(salesMonth),
          refundsMonth: asList(refundsMonth),
          note: 'Cobros exitosos (adelantos, pagos totales y saldos) por fecha de cobro; reembolsos aparte.',
        },
        bookingsByStatus: Object.fromEntries(statusGroups.map((g) => [g.status, g._count._all])),
        balances: {
          dueNext7Days: { totals: asList(balancesDue), bookings: dueSoon.map((b) => ({ code: b.code, balance: { amount: b.totalAmount - b.paidAmount, currency: b.currency }, balanceDueAt: b.balanceDueAt })) },
          overdue: asList(balancesOverdue),
        },
        complaints: {
          open: openComplaints.length,
          dueSoon: lights.yellow + lights.red,
          byTrafficLight: { green: lights.green, yellow: lights.yellow, red: lights.red, overdue: lights.overdue, suspended: lights.suspended },
        },
        upcomingDepartures: departures.map((d) => ({
          departureId: d.id,
          tourId: d.tourId,
          tourCode: d.tour.code,
          tourTitle: d.tour.translations[0]?.title ?? null,
          departureDate: calendarDateFromUtcDate(d.departureDate),
          startTime: d.startTime.toISOString().slice(11, 16),
          capacity: d.capacity,
          booked: d.booked,
          held: d.held,
          occupancyPercent: d.capacity > 0 ? Math.round(((d.booked + d.held) / d.capacity) * 100) : 0,
          isClosed: d.isClosed,
        })),
        privacyRequests: { open: dsrOpen.length, overdue: dsrOpen.filter((r) => r.dueAt.getTime() < now.getTime()).length },
        emailOutbox: { pending: outboxPending, retrying: outboxRetrying, failed: outboxDead },
      };
    });
  }
}
