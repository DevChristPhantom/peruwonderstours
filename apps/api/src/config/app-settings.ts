import type { ConfigService } from '@nestjs/config';
import type { BookingSettings } from '../modules/booking/application/booking.use-cases.js';
import type { CartSettings } from '../modules/cart/application/cart.use-cases.js';
import type { ComplaintSettings } from '../modules/complaints/application/complaint.use-cases.js';
import { parseRefundTiersJson, type RefundTier } from '../modules/backoffice/domain/cancellation-policy.js';
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
  auth: StaffAuthSettings;
  mail: MailSettings;
  outbox: OutboxSettings;
  privacy: PrivacySettings;
  backoffice: { refundTiers: RefundTier[]; cancellationPolicyVersion: string };
}

export interface StaffAuthSettings {
  /** undefined => secreto efímero de desarrollo (prohibido en producción). */
  jwtSecret?: string;
  issuer: string;
  accessTokenTtlSeconds: number;
  refreshIdleTtlSeconds: number;
  refreshAbsoluteTtlSeconds: number;
  lockout: { threshold: number; baseSeconds: number; maxSeconds: number };
  mfaIssuer: string;
}

export interface MailSettings {
  transport: 'file' | 'smtp' | 'memory' | 'disabled';
  outboxDir: string;
  from: string;
  replyTo?: string;
  smtp: { host?: string; port: number; secure: boolean; user?: string; password?: string };
  publicWebBaseUrl: string;
  contactEmail: string;
  contactPhone: string;
}

export interface OutboxSettings {
  relayEnabled: boolean;
  intervalMs: number;
  maxAttempts: number;
  batchSize: number;
  reminderIntervalMs: number;
}

export interface PrivacySettings {
  /** undefined => secreto efímero de desarrollo. */
  marketingLinkSecret?: string;
  marketingConsentVersion: string;
  privacyNoticeVersion: string;
  termsVersion: string;
  cancellationPolicyVersion: string;
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
    auth: {
      jwtSecret: env.JWT_ACCESS_SECRET,
      issuer: env.JWT_ISSUER,
      accessTokenTtlSeconds: env.ACCESS_TOKEN_TTL_SECONDS,
      refreshIdleTtlSeconds: env.REFRESH_IDLE_TTL_HOURS * 3600,
      refreshAbsoluteTtlSeconds: env.REFRESH_ABSOLUTE_TTL_HOURS * 3600,
      lockout: { threshold: env.LOGIN_LOCK_THRESHOLD, baseSeconds: env.LOGIN_LOCK_BASE_SECONDS, maxSeconds: env.LOGIN_LOCK_MAX_SECONDS },
      mfaIssuer: env.MFA_ISSUER,
    },
    mail: {
      transport: env.MAIL_TRANSPORT,
      outboxDir: env.MAIL_OUTBOX_DIR,
      from: env.MAIL_FROM,
      replyTo: env.MAIL_REPLY_TO || undefined,
      smtp: { host: env.SMTP_HOST, port: env.SMTP_PORT, secure: env.SMTP_SECURE, user: env.SMTP_USER || undefined, password: env.SMTP_PASSWORD || undefined },
      publicWebBaseUrl: env.PUBLIC_WEB_BASE_URL.replace(/\/$/, ''),
      contactEmail: env.CONTACT_EMAIL,
      contactPhone: env.CONTACT_PHONE,
    },
    outbox: {
      relayEnabled: env.OUTBOX_RELAY_ENABLED,
      intervalMs: env.OUTBOX_RELAY_INTERVAL_MS,
      maxAttempts: env.OUTBOX_MAX_ATTEMPTS,
      batchSize: env.OUTBOX_BATCH_SIZE,
      reminderIntervalMs: env.REMINDER_JOB_INTERVAL_MS,
    },
    privacy: {
      marketingLinkSecret: env.MARKETING_LINK_SECRET,
      marketingConsentVersion: env.MARKETING_CONSENT_VERSION,
      privacyNoticeVersion: env.PRIVACY_NOTICE_VERSION,
      termsVersion: env.TERMS_VERSION,
      cancellationPolicyVersion: env.CANCELLATION_POLICY_VERSION,
    },
    backoffice: { refundTiers: parseRefundTiersJson(env.CANCELLATION_REFUND_TIERS), cancellationPolicyVersion: env.CANCELLATION_POLICY_VERSION },
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
    'JWT_ACCESS_SECRET', 'JWT_ISSUER', 'ACCESS_TOKEN_TTL_SECONDS', 'REFRESH_IDLE_TTL_HOURS', 'REFRESH_ABSOLUTE_TTL_HOURS',
    'LOGIN_LOCK_THRESHOLD', 'LOGIN_LOCK_BASE_SECONDS', 'LOGIN_LOCK_MAX_SECONDS', 'MFA_ISSUER',
    'MAIL_TRANSPORT', 'MAIL_OUTBOX_DIR', 'MAIL_FROM', 'MAIL_REPLY_TO', 'SMTP_HOST', 'SMTP_PORT', 'SMTP_SECURE', 'SMTP_USER', 'SMTP_PASSWORD',
    'OUTBOX_RELAY_ENABLED', 'OUTBOX_RELAY_INTERVAL_MS', 'OUTBOX_MAX_ATTEMPTS', 'OUTBOX_BATCH_SIZE', 'REMINDER_JOB_INTERVAL_MS',
    'PUBLIC_WEB_BASE_URL', 'CONTACT_EMAIL', 'CONTACT_PHONE', 'MARKETING_LINK_SECRET', 'MARKETING_CONSENT_VERSION', 'CANCELLATION_REFUND_TIERS',
  ] as const;
  const env = Object.fromEntries(keys.map((k) => [k, config.get<unknown>(k)])) as unknown as EnvironmentVariables;
  return settingsFromEnvironment(env);
}
