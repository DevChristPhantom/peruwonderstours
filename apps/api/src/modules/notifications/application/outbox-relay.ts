import type { PiiCipher } from '../../../shared/application/pii-cipher.js';
import type { UnitOfWork } from '../../../shared/application/unit-of-work.js';
import type { ClaimedOutboxEvent } from '../../../shared/domain/outbox.js';
import type { Clock, IdGenerator } from '../../../shared/domain/ports.js';
import { MAIL_EVENTS, outboxMessage } from '../domain/mail-events.js';
import type { MailComposer } from './mail-composer.js';
import type { MailTransport } from './mail-transport.js';

export interface RelaySettings {
  batchSize: number;
  maxAttempts: number;
  /** Tiempo que un evento reclamado queda reservado para este proceso. */
  leaseSeconds: number;
  from: string;
  replyTo?: string;
  /** Dominio del Message-ID. */
  messageIdDomain: string;
}

export interface RelayRunResult {
  claimed: number;
  sent: number;
  skipped: number;
  failed: number;
}

/** Backoff exponencial: 30 s, 1 min, 2 min, 4 min... con tope de 1 h. */
export function retryDelaySeconds(attempts: number): number {
  return Math.min(30 * 2 ** Math.max(0, attempts - 1), 3600);
}

/**
 * Relay del outbox -> correo. Garantías:
 *  - Reclamo con lease (FOR UPDATE SKIP LOCKED en PostgreSQL): dos procesos no toman el mismo evento.
 *  - Idempotente: cada correo se registra en `email_deliveries` (UNIQUE evento + plantilla); un
 *    reintento no vuelve a enviar lo ya entregado. Message-ID determinista para dedupe del receptor.
 *  - Reintentos con backoff exponencial; tras `maxAttempts` el evento queda "muerto" (visible en el tablero).
 *  - Entrega al menos una vez: si el proceso cae entre el envío y el registro, puede repetirse un correo.
 */
export class OutboxRelay {
  private running = false;

  constructor(
    private readonly uow: UnitOfWork,
    private readonly clock: Clock,
    private readonly ids: IdGenerator,
    private readonly composer: MailComposer,
    private readonly transport: MailTransport,
    private readonly cipher: PiiCipher,
    private readonly settings: RelaySettings,
  ) {}

  /** Una pasada; si ya hay una en curso en este proceso, no hace nada. */
  async runOnce(): Promise<RelayRunResult> {
    const result: RelayRunResult = { claimed: 0, sent: 0, skipped: 0, failed: 0 };
    if (this.running) return result;
    this.running = true;
    try {
      const now = this.clock.now();
      const events = await this.uow.run((r) => r.outboxQueue.claim(now, this.settings.batchSize, this.settings.leaseSeconds, this.settings.maxAttempts));
      result.claimed = events.length;
      for (const event of events) {
        const outcome = await this.process(event);
        result[outcome] += 1;
      }
      return result;
    } finally {
      this.running = false;
    }
  }

  private async process(event: ClaimedOutboxEvent): Promise<'sent' | 'skipped' | 'failed'> {
    try {
      const composed = await this.uow.run((r) => this.composer.compose(event, r));
      if (composed.kind === 'skip') {
        await this.uow.run((r) => r.outboxQueue.markPublished(event.id, this.clock.now()));
        return 'skipped';
      }
      const messageIds: Record<string, string> = {};
      for (const email of composed.plan.emails) {
        const existing = await this.uow.run((r) => r.emailDeliveries.find(event.id, email.template));
        if (existing) {
          messageIds[email.template] = existing.messageId;
          continue;
        }
        const messageId = `<${event.id}.${email.template}@${this.settings.messageIdDomain}>`;
        const { transportRef } = await this.transport.send({
          template: email.template,
          from: this.settings.from,
          replyTo: this.settings.replyTo,
          to: email.to,
          subject: email.subject,
          html: email.html,
          text: email.text,
          messageId,
          attachments: email.attachments,
        });
        const sentAt = this.clock.now();
        await this.uow.run((r) =>
          r.emailDeliveries.insert({
            id: this.ids.next(),
            outboxEventId: event.id,
            template: email.template,
            status: 'sent',
            messageId,
            recipientHash: this.cipher.hash(email.to.map((t) => t.toLowerCase()).sort().join(',')),
            transportRef: transportRef.slice(0, 300),
            sentAt,
          }),
        );
        messageIds[email.template] = messageId;
      }
      await this.uow.run(async (r) => {
        const now = this.clock.now();
        await composed.plan.after?.(r, now, messageIds);
        await r.outboxQueue.markPublished(event.id, now);
      });
      return 'sent';
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const retryAt = new Date(this.clock.now().getTime() + retryDelaySeconds(event.attempts) * 1000);
      await this.uow.run((r) => r.outboxQueue.markFailed(event.id, `[intento ${event.attempts}] ${message}`, retryAt)).catch(() => undefined);
      return 'failed';
    }
  }
}

export const BALANCE_REMINDER_DAYS = [7, 2] as const;

/**
 * Recordatorios de saldo (7 y 2 días antes del vencimiento). Idempotente: cada umbral se
 * encola una sola vez por reserva (`dedupe_key` UNIQUE). Ventanas: 7d = (2d, 7d], 2d = (0, 2d].
 */
export class BalanceReminderJob {
  constructor(
    private readonly uow: UnitOfWork,
    private readonly clock: Clock,
    private readonly ids: IdGenerator,
  ) {}

  async runOnce(limit = 500): Promise<{ enqueued: number }> {
    const now = this.clock.now();
    const horizon = new Date(now.getTime() + BALANCE_REMINDER_DAYS[0] * 86_400_000);
    return this.uow.run(async (r) => {
      const bookings = await r.bookings.findBalanceDueBetween(now, horizon, limit);
      let enqueued = 0;
      for (const booking of bookings) {
        const dueAt = booking.toSnapshot().balanceDueAt;
        if (!dueAt) continue;
        const remainingMs = dueAt.getTime() - now.getTime();
        const threshold = remainingMs <= 2 * 86_400_000 ? 2 : 7;
        const inserted = await r.outbox.addIfAbsent({
          ...outboxMessage(this.ids, {
            aggregateType: 'booking',
            aggregateId: booking.id,
            eventType: MAIL_EVENTS.bookingBalanceReminder,
            payload: { bookingId: booking.id, bookingCode: booking.code, daysBefore: threshold },
            now,
          }),
          dedupeKey: `balance-reminder:${booking.id}:${threshold}d`,
        });
        if (inserted) enqueued += 1;
      }
      return { enqueued };
    });
  }
}
