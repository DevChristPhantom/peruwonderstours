import { Inject, Injectable, Logger, Module, type OnApplicationBootstrap, type OnApplicationShutdown } from '@nestjs/common';
import { APP_SETTINGS, type AppSettings } from '../../config/app-settings.js';
import { CLOCK, ID_GENERATOR, PAYMENT_GATEWAY_REGISTRY, UNIT_OF_WORK } from '../../shared/application/tokens.js';
import type { UnitOfWork } from '../../shared/application/unit-of-work.js';
import type { Clock, IdGenerator } from '../../shared/domain/ports.js';
import { PaymentUseCases } from './application/payment.use-cases.js';
import type { PaymentGatewayRegistry } from './domain/payment-gateway.js';
import { SandboxPaymentGateway, StaticPaymentGatewayRegistry } from './infrastructure/sandbox-payment-gateway.js';
import { PaymentsController } from './interface/payments.controller.js';

/**
 * H-01: conciliación periódica de intentos de cobro no terminales (consulta a la pasarela;
 * aplica, reembolsa o expira). Mismo interruptor que el relay del outbox.
 */
@Injectable()
export class PaymentReconciliationScheduler implements OnApplicationBootstrap, OnApplicationShutdown {
  private timer: NodeJS.Timeout | null = null;
  private running = false;
  private readonly logger = new Logger('Payments');

  constructor(
    @Inject(PaymentUseCases) private readonly payments: PaymentUseCases,
    @Inject(APP_SETTINGS) private readonly settings: AppSettings,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  onApplicationBootstrap(): void {
    if (!this.settings.outbox.relayEnabled) return;
    this.timer = setInterval(() => void this.tick(), 5 * 60_000);
    this.timer.unref();
  }

  onApplicationShutdown(): void {
    if (this.timer) clearInterval(this.timer);
  }

  private async tick(): Promise<void> {
    if (this.running) return;
    this.running = true;
    try {
      const now = this.clock.now().getTime();
      const r = await this.payments.reconcileStalePayments({ staleBefore: new Date(now - 30 * 60_000), expireBefore: new Date(now - 24 * 3600_000) });
      if (r.checked > 0) this.logger.log(`Conciliación: ${r.synced} sincronizados, ${r.expired} expirados, ${r.failed} con error (de ${r.checked}).`);
    } catch (error) {
      this.logger.error(`Conciliación de pagos falló: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      this.running = false;
    }
  }
}

@Module({
  controllers: [PaymentsController],
  providers: [
    {
      provide: PAYMENT_GATEWAY_REGISTRY,
      inject: [APP_SETTINGS, CLOCK],
      useFactory: (settings: AppSettings, clock: Clock): PaymentGatewayRegistry => {
        // Adaptadores reales (Izipay/Niubiz/Mercado Pago/Culqi) se registran aquí cuando exista el ADR de pasarela.
        const sandbox = new SandboxPaymentGateway(settings.sandbox, clock);
        return new StaticPaymentGatewayRegistry([sandbox], sandbox);
      },
    },
    {
      provide: PaymentUseCases,
      inject: [UNIT_OF_WORK, CLOCK, ID_GENERATOR, PAYMENT_GATEWAY_REGISTRY],
      useFactory: (uow: UnitOfWork, clock: Clock, ids: IdGenerator, gateways: PaymentGatewayRegistry) => new PaymentUseCases(uow, clock, ids, gateways),
    },
    PaymentReconciliationScheduler,
  ],
  exports: [PAYMENT_GATEWAY_REGISTRY, PaymentUseCases],
})
export class PaymentsModule {}
