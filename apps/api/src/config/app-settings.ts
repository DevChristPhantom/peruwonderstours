import type { ConfigService } from '@nestjs/config';
import type { BookingSettings } from '../modules/booking/application/booking.use-cases.js';
import type { CartSettings } from '../modules/cart/application/cart.use-cases.js';
import type { ComplaintSettings } from '../modules/complaints/application/complaint.use-cases.js';
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
  /** Valor para `app.set('trust proxy', …)`. */
  trustProxy: boolean | number | string;
  bodyLimitKb: number;
  throttle: { ttlSeconds: number; limit: number; strictLimit: number };
  swaggerEnabled: boolean;
  problemTypeBaseUrl: string;
  sandbox: { webhookSecret: string; checkoutBaseUrl: string; webhookToleranceSeconds: number };
  booking: BookingSettings;
  cart: CartSettings;
  complaints: ComplaintSettings;
  /** Clave maestra base64 para PII; undefined => clave de desarrollo (prohibido en producción). */
  piiEncryptionKey?: string;
}

/** "false"/"true" => booleano; "2" => saltos; otro texto => lista/alias de Express. */
export function parseTrustProxy(value: string): boolean | number | string {
  const v = value.trim();
  if (v === '' || v.toLowerCase() === 'false') return false;
  if (v.toLowerCase() === 'true') return true;
  if (/^\d+$/.test(v)) return Number(v);
  return v;
}

export function settingsFromEnvironment(env: EnvironmentVariables): AppSettings {
  return {
    nodeEnv: env.NODE_ENV,
    port: env.PORT,
    dataSource: env.DATA_SOURCE,
    databaseUrl: env.DATABASE_URL,
    seedDataDir: env.SEED_DATA_DIR,
    demoPricing: env.DEMO_PRICING,
    corsOrigins: env.WEB_ORIGIN.split(',').map((o) => o.trim().replace(/\/$/, '')).filter(Boolean),
    trustProxy: parseTrustProxy(env.TRUST_PROXY),
    bodyLimitKb: env.BODY_LIMIT_KB,
    throttle: { ttlSeconds: env.THROTTLE_TTL_SECONDS, limit: env.THROTTLE_LIMIT, strictLimit: env.THROTTLE_STRICT_LIMIT },
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
    complaints: {
      provider: {
        legalName: env.PROVIDER_LEGAL_NAME,
        ruc: env.PROVIDER_RUC,
        establishmentAddress: env.ESTABLISHMENT_ADDRESS,
        establishmentCode: env.ESTABLISHMENT_CODE,
      },
      conformityTextVersion: env.COMPLAINT_CONFORMITY_TEXT_VERSION,
      privacyNoticeVersion: env.PRIVACY_NOTICE_VERSION,
      idempotencyTtlMinutes: env.IDEMPOTENCY_TTL_HOURS * 60,
    },
    piiEncryptionKey: env.PII_ENCRYPTION_KEY,
  };
}

/** Lee la configuración ya validada por ConfigModule (`validateEnvironment`). */
export function settingsFromConfigService(config: ConfigService): AppSettings {
  const keys = [
    'NODE_ENV', 'PORT', 'DATA_SOURCE', 'DATABASE_URL', 'SEED_DATA_DIR', 'DEMO_PRICING', 'WEB_ORIGIN', 'TRUST_PROXY', 'BODY_LIMIT_KB',
    'THROTTLE_TTL_SECONDS', 'THROTTLE_LIMIT', 'THROTTLE_STRICT_LIMIT', 'SWAGGER_ENABLED',
    'PROBLEM_TYPE_BASE_URL', 'PAYMENT_GATEWAY', 'SANDBOX_WEBHOOK_SECRET', 'SANDBOX_CHECKOUT_BASE_URL', 'WEBHOOK_TOLERANCE_SECONDS',
    'DEPOSIT_DEFAULT_PERCENT', 'BALANCE_DUE_DAYS_BEFORE_SERVICE', 'FULL_PAYMENT_WITHIN_DAYS', 'THIRD_PARTY_TICKETS_REQUIRE_FULL',
    'HOLD_TTL_MINUTES', 'CART_TTL_DAYS', 'PRICE_LOCK_MINUTES', 'IDEMPOTENCY_TTL_HOURS', 'TERMS_VERSION', 'CANCELLATION_POLICY_VERSION',
    'PROVIDER_LEGAL_NAME', 'PROVIDER_RUC', 'ESTABLISHMENT_ADDRESS', 'ESTABLISHMENT_CODE', 'COMPLAINT_CONFORMITY_TEXT_VERSION',
    'PRIVACY_NOTICE_VERSION', 'PII_ENCRYPTION_KEY',
  ] as const;
  const env = Object.fromEntries(keys.map((k) => [k, config.get<unknown>(k)])) as unknown as EnvironmentVariables;
  return settingsFromEnvironment(env);
}
