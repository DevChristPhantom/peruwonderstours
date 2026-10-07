import { plainToInstance, Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUrl,
  Max,
  Min,
  MinLength,
  ValidateIf,
  validateSync,
} from 'class-validator';

const toBool = ({ value }: { value: unknown }) =>
  typeof value === 'boolean' ? value : typeof value === 'string' ? ['true', '1', 'yes'].includes(value.toLowerCase()) : value;

export type DataSource = 'prisma' | 'seed' | 'memory';

/**
 * Variables de entorno validadas al arrancar (fail fast). Ver `.env.example`.
 * Los valores de la política de pago son SUPUESTOS pendientes del cliente.
 */
export class EnvironmentVariables {
  @IsIn(['development', 'test', 'production'])
  NODE_ENV: 'development' | 'test' | 'production' = 'development';

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(65535)
  PORT = 4000;

  /** prisma = PostgreSQL; seed = memoria cargada desde data/seed; memory = memoria vacía. */
  @IsIn(['prisma', 'seed', 'memory'])
  DATA_SOURCE: DataSource = 'seed';

  @ValidateIf((env: EnvironmentVariables) => env.DATA_SOURCE === 'prisma')
  @IsString()
  @MinLength(10)
  DATABASE_URL?: string;

  @IsString()
  SEED_DATA_DIR = '../../data/seed';

  /** Solo memoria: genera tarifas y salidas FICTICIAS para probar carrito/checkout. */
  @Transform(toBool)
  @IsBoolean()
  DEMO_PRICING = false;

  /** Orígenes CORS separados por coma (el front Next.js). */
  @IsString()
  CORS_ORIGINS = 'http://localhost:3000';

  @Transform(toBool)
  @IsBoolean()
  SWAGGER_ENABLED = true;

  @IsUrl({ require_tld: false, require_protocol: true })
  PROBLEM_TYPE_BASE_URL = 'https://peruwonderstours.com/problems';

  @IsIn(['sandbox'])
  PAYMENT_GATEWAY = 'sandbox' as const;

  @ValidateIf((env: EnvironmentVariables) => env.PAYMENT_GATEWAY === 'sandbox')
  @IsString()
  @MinLength(16)
  SANDBOX_WEBHOOK_SECRET?: string;

  @IsUrl({ require_tld: false, require_protocol: true })
  SANDBOX_CHECKOUT_BASE_URL = 'http://localhost:4000/api/v1/sandbox/checkout';

  @Type(() => Number)
  @IsInt()
  @Min(30)
  WEBHOOK_TOLERANCE_SECONDS = 300;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  DEPOSIT_DEFAULT_PERCENT = 50;

  @Type(() => Number)
  @IsInt()
  @Min(0)
  BALANCE_DUE_DAYS_BEFORE_SERVICE = 7;

  @Type(() => Number)
  @IsInt()
  @Min(0)
  FULL_PAYMENT_WITHIN_DAYS = 7;

  @Transform(toBool)
  @IsBoolean()
  THIRD_PARTY_TICKETS_REQUIRE_FULL = true;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(120)
  HOLD_TTL_MINUTES = 15;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  CART_TTL_DAYS = 7;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  PRICE_LOCK_MINUTES = 30;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  IDEMPOTENCY_TTL_HOURS = 24;

  @IsString()
  TERMS_VERSION = '2026-10-draft';

  @IsString()
  CANCELLATION_POLICY_VERSION = '2026-10-draft';

  @IsOptional()
  @IsString()
  LOG_LEVEL?: string;
}

/** `validate` de ConfigModule: convierte tipos, aplica defaults y falla con todos los errores. */
export function validateEnvironment(config: Record<string, unknown>): EnvironmentVariables {
  const env = plainToInstance(EnvironmentVariables, config, { enableImplicitConversion: true, exposeDefaultValues: true });
  const errors = validateSync(env, { skipMissingProperties: false, whitelist: false });
  const messages = errors.flatMap((e) => Object.values(e.constraints ?? {}).map((m) => `${e.property}: ${m}`));
  if (env.NODE_ENV === 'production') {
    if (env.DATA_SOURCE !== 'prisma') messages.push('DATA_SOURCE debe ser "prisma" en producción.');
    if (env.DEMO_PRICING) messages.push('DEMO_PRICING no se permite en producción.');
    if (env.PAYMENT_GATEWAY === 'sandbox') messages.push('La pasarela sandbox no se permite en producción.');
  }
  if (env.DEMO_PRICING && env.DATA_SOURCE === 'prisma') messages.push('DEMO_PRICING solo aplica a DATA_SOURCE=seed|memory.');
  if (messages.length > 0) {
    throw new Error(`Configuración inválida:\n - ${messages.join('\n - ')}`);
  }
  return env;
}
