import { Module } from '@nestjs/common';
import { APP_SETTINGS, type AppSettings } from '../../config/app-settings.js';
import { CLOCK, ID_GENERATOR, PAYMENT_GATEWAY_REGISTRY, UNIT_OF_WORK } from '../../shared/application/tokens.js';
import type { UnitOfWork } from '../../shared/application/unit-of-work.js';
import type { Clock, IdGenerator } from '../../shared/domain/ports.js';
import { PaymentUseCases } from './application/payment.use-cases.js';
import type { PaymentGatewayRegistry } from './domain/payment-gateway.js';
import { SandboxPaymentGateway, StaticPaymentGatewayRegistry } from './infrastructure/sandbox-payment-gateway.js';
import { PaymentsController } from './interface/payments.controller.js';

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
  ],
  exports: [PAYMENT_GATEWAY_REGISTRY],
})
export class PaymentsModule {}
