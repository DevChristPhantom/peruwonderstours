import type { ConfigService } from '@nestjs/config';
import type { BookingSettings } from '../modules/booking/application/booking.use-cases.js';
import type { CartSettings } from '../modules/cart/application/cart.use-cases.js';
import type { DataSource, EnvironmentVariables } from './environment.js';

export const APP_SETTINGS = Symbol('APP_SETTINGS');

export interface AppSettings {
  nodeEnv: EnvironmentVariables['NODE_ENV'];
  port: number;
  dataSource: DataSource;
  databaseUrl?: string;
  seedDataDir: string;
  demoPricing: boolean;
  corsOrigins: string[];
  swaggerEnabled: boolean;
  problemTypeBaseUrl: string;
  sandbox: { webhookSecret: string; checkoutBaseUrl: string; webhookToleranceSeconds: number };
  booking: BookingSettings;
  cart: CartSettings;
}

export function settingsFromEnvironment(env: EnvironmentVariables): AppSettings {
  return {
    nodeEnv: env.NODE_ENV,
    port: env.PORT,
    dataSource: env.DATA_SOURCE,
    databaseUrl: env.DATABASE_URL,
    seedDataDir: env.SEED_DATA_DIR,
    demoPricing: env.DEMO_PRICING,
    corsOrigins: env.CORS_ORIGINS.split(',').map((o) => o.trim()).filter(Boolean),
    swaggerEnabled: env.SWAGGER_ENABLED,
    problemTypeBaseUrl: env.PROBLEM_TYPE_BASE_URL.replace(/\/$/, ''),
    sandbox: {
      webhookSecret: env.SANDBOX_WEBHOOK_SECRET ?? '',
      checkoutBaseUrl: env.SANDBOX_CHECKOUT_BASE_URL,
      webhookToleranceSeconds: env.WEBHOOK_TOLERANCE_SECONDS,
    },
    booking: {
      policy: {
        defaultDepositPercent: env.DEPOSIT_DEFAULT_PERCENT,
        balanceDueDaysBeforeService: env.BALANCE_DUE_DAYS_BEFORE_SERVICE,
        fullPaymentWithinDays: env.FULL_PAYMENT_WITHIN_DAYS,
        thirdPartyTicketsRequireFull: env.THIRD_PARTY_TICKETS_REQUIRE_FULL,
      },
      holdTtlMinutes: env.HOLD_TTL_MINUTES,
      termsVersion: env.TERMS_VERSION,
      cancellationPolicyVersion: env.CANCELLATION_POLICY_VERSION,
      idempotencyTtlMinutes: env.IDEMPOTENCY_TTL_HOURS * 60,
    },
    cart: { ttlMinutes: env.CART_TTL_DAYS * 24 * 60, priceLockMinutes: env.PRICE_LOCK_MINUTES },
  };
}

/** Lee la configuración ya validada por ConfigModule (`validateEnvironment`). */
export function settingsFromConfigService(config: ConfigService): AppSettings {
  const keys = [
    'NODE_ENV', 'PORT', 'DATA_SOURCE', 'DATABASE_URL', 'SEED_DATA_DIR', 'DEMO_PRICING', 'CORS_ORIGINS', 'SWAGGER_ENABLED',
    'PROBLEM_TYPE_BASE_URL', 'PAYMENT_GATEWAY', 'SANDBOX_WEBHOOK_SECRET', 'SANDBOX_CHECKOUT_BASE_URL', 'WEBHOOK_TOLERANCE_SECONDS',
    'DEPOSIT_DEFAULT_PERCENT', 'BALANCE_DUE_DAYS_BEFORE_SERVICE', 'FULL_PAYMENT_WITHIN_DAYS', 'THIRD_PARTY_TICKETS_REQUIRE_FULL',
    'HOLD_TTL_MINUTES', 'CART_TTL_DAYS', 'PRICE_LOCK_MINUTES', 'IDEMPOTENCY_TTL_HOURS', 'TERMS_VERSION', 'CANCELLATION_POLICY_VERSION',
  ] as const;
  const env = Object.fromEntries(keys.map((k) => [k, config.get<unknown>(k)])) as unknown as EnvironmentVariables;
  return settingsFromEnvironment(env);
}
