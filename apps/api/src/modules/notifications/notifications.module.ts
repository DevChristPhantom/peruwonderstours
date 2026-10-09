import { Inject, Injectable, Logger, Module, type OnApplicationBootstrap, type OnApplicationShutdown } from '@nestjs/common';
import { APP_SETTINGS, type AppSettings } from '../../config/app-settings.js';
import type { PiiCipher } from '../../shared/application/pii-cipher.js';
import { CLOCK, ID_GENERATOR, MAIL_TRANSPORT, PII_CIPHER, UNIT_OF_WORK } from '../../shared/application/tokens.js';
import type { UnitOfWork } from '../../shared/application/unit-of-work.js';
import type { Clock, IdGenerator } from '../../shared/domain/ports.js';
import { PrivacyUseCases } from '../privacy/application/privacy.use-cases.js';
import { MailComposer } from './application/mail-composer.js';
import type { MailTransport } from './application/mail-transport.js';
import { BalanceReminderJob, OutboxRelay } from './application/outbox-relay.js';
import { DisabledMailTransport, FileMailTransport, MemoryMailTransport, SmtpMailTransport } from './infrastructure/mail-transports.js';

export function createMailTransport(settings: AppSettings): MailTransport {
  switch (settings.mail.transport) {
    case 'smtp':
      return new SmtpMailTransport({ host: settings.mail.smtp.host!, port: settings.mail.smtp.port, secure: settings.mail.smtp.secure, user: settings.mail.smtp.user, password: settings.mail.smtp.password });
    case 'memory':
      return new MemoryMailTransport();
    case 'disabled':
      return new DisabledMailTransport();
    default:
      return new FileMailTransport(settings.mail.outboxDir);
  }
}

function addressDomain(from: string): string {
  return /@([A-Za-z0-9.-]+)/.exec(from)?.[1] ?? 'peruwonderstours.com';
}

/**
 * Jobs en proceso con intervalo (sin cola externa todavía): relay del outbox y recordatorios
 * de saldo. Las pasadas no se solapan; los timers no retienen el cierre del proceso.
 */
@Injectable()
export class NotificationsScheduler implements OnApplicationBootstrap, OnApplicationShutdown {
  private readonly logger = new Logger('Notifications');
  private timers: NodeJS.Timeout[] = [];
  private reminderRunning = false;

  constructor(
    @Inject(OutboxRelay) private readonly relay: OutboxRelay,
    @Inject(BalanceReminderJob) private readonly reminders: BalanceReminderJob,
    @Inject(MAIL_TRANSPORT) private readonly transport: MailTransport,
    @Inject(APP_SETTINGS) private readonly settings: AppSettings,
  ) {}

  onApplicationBootstrap(): void {
    if (!this.settings.outbox.relayEnabled || this.transport.kind === 'disabled') {
      this.logger.log('Relay del outbox deshabilitado (OUTBOX_RELAY_ENABLED=false o MAIL_TRANSPORT=disabled).');
      return;
    }
    const relayTimer = setInterval(() => void this.tickRelay(), this.settings.outbox.intervalMs);
    const reminderTimer = setInterval(() => void this.tickReminders(), this.settings.outbox.reminderIntervalMs);
    relayTimer.unref();
    reminderTimer.unref();
    this.timers = [relayTimer, reminderTimer];
    this.logger.log(`Relay del outbox cada ${this.settings.outbox.intervalMs} ms (transporte: ${this.transport.kind}).`);
  }

  onApplicationShutdown(): void {
    for (const t of this.timers) clearInterval(t);
    this.timers = [];
  }

  private async tickRelay(): Promise<void> {
    try {
      const r = await this.relay.runOnce();
      if (r.claimed > 0) this.logger.log(`Outbox: ${r.sent} enviados, ${r.skipped} omitidos, ${r.failed} con error (de ${r.claimed}).`);
    } catch (error) {
      this.logger.error(`Relay del outbox falló: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  private async tickReminders(): Promise<void> {
    if (this.reminderRunning) return;
    this.reminderRunning = true;
    try {
      const r = await this.reminders.runOnce();
      if (r.enqueued > 0) this.logger.log(`Recordatorios de saldo encolados: ${r.enqueued}.`);
    } catch (error) {
      this.logger.error(`Job de recordatorios falló: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      this.reminderRunning = false;
    }
  }
}

@Module({
  providers: [
    { provide: MAIL_TRANSPORT, inject: [APP_SETTINGS], useFactory: (s: AppSettings) => createMailTransport(s) },
    {
      provide: MailComposer,
      inject: [APP_SETTINGS, PII_CIPHER, PrivacyUseCases],
      useFactory: (s: AppSettings, cipher: PiiCipher, privacy: PrivacyUseCases) =>
        new MailComposer({
          brand: {
            providerLegalName: s.complaints.provider.legalName,
            providerRuc: s.complaints.provider.ruc,
            contactEmail: s.mail.contactEmail,
            contactPhone: s.mail.contactPhone,
            publicWebBaseUrl: s.mail.publicWebBaseUrl,
          },
          cipher,
          unsubscribeUrl: (repos, email) => privacy.unsubscribeUrlIfGranted(repos, email),
          marketingConfirmationUrl: (email, purposes) => privacy.buildConfirmationUrl(email, purposes),
        }),
    },
    {
      provide: OutboxRelay,
      inject: [UNIT_OF_WORK, CLOCK, ID_GENERATOR, MailComposer, MAIL_TRANSPORT, PII_CIPHER, APP_SETTINGS],
      useFactory: (uow: UnitOfWork, clock: Clock, ids: IdGenerator, composer: MailComposer, transport: MailTransport, cipher: PiiCipher, s: AppSettings) =>
        new OutboxRelay(uow, clock, ids, composer, transport, cipher, {
          batchSize: s.outbox.batchSize,
          maxAttempts: s.outbox.maxAttempts,
          leaseSeconds: 120,
          from: s.mail.from,
          replyTo: s.mail.replyTo,
          messageIdDomain: addressDomain(s.mail.from),
        }),
    },
    {
      provide: BalanceReminderJob,
      inject: [UNIT_OF_WORK, CLOCK, ID_GENERATOR],
      useFactory: (uow: UnitOfWork, clock: Clock, ids: IdGenerator) => new BalanceReminderJob(uow, clock, ids),
    },
    NotificationsScheduler,
  ],
  exports: [OutboxRelay, BalanceReminderJob, MAIL_TRANSPORT],
})
export class NotificationsModule {}
