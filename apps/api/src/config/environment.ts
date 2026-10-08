import { plainToInstance, Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsBase64,
  IsUrl,
  Length,
  Matches,
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
  PORT = 3001;

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

  /**
   * Allowlist CORS: orígenes exactos separados por coma (el front Next.js). El front llama
   * a la API desde su servidor, así que CORS solo afecta a llamadas desde el navegador.
   */
  @IsString()
  @Matches(/^https?:\/\/[^\s,/]+(,\s*https?:\/\/[^\s,/]+)*$/, { message: 'WEB_ORIGIN: lista de orígenes http(s)://host[:puerto] separados por coma.' })
  WEB_ORIGIN = 'http://localhost:3000';

  /**
   * `trust proxy` de Express: false | true | número de saltos | lista de IPs/subredes o
   * loopback/linklocal/uniquelocal. Define de dónde sale `req.ip` (rate limiting).
   */
  @IsString()
  TRUST_PROXY = 'loopback';

  /** Límite del cuerpo JSON/urlencoded en KiB (413 si se supera). */
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(10240)
  BODY_LIMIT_KB = 100;

  /** Ventana del rate limiting (segundos). */
  @Type(() => Number)
  @IsInt()
  @Min(1)
  THROTTLE_TTL_SECONDS = 60;

  /** Peticiones por IP y ventana en toda la API. */
  @Type(() => Number)
  @IsInt()
  @Min(1)
  THROTTLE_LIMIT = 300;

  /** Peticiones por IP y ventana en escrituras sensibles (checkout, pagos, reclamaciones). */
  @Type(() => Number)
  @IsInt()
  @Min(1)
  THROTTLE_STRICT_LIMIT = 10;

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
  SANDBOX_CHECKOUT_BASE_URL = 'http://localhost:3001/api/v1/sandbox/checkout';

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

  // --- Libro de Reclamaciones: proveedor y establecimiento (se congelan en cada hoja) ---
  /** Razón social del proveedor. POR CONFIRMAR con el cliente. */
  @IsString()
  @Length(1, 200)
  PROVIDER_LEGAL_NAME = 'POR CONFIRMAR';

  /** RUC (11 dígitos). POR CONFIRMAR con el cliente. */
  @IsString()
  @Length(1, 20)
  PROVIDER_RUC = 'POR CONFIRMAR';

  /** Domicilio del establecimiento donde está el libro (la web: domicilio fiscal u oficina). */
  @IsString()
  @Length(1, 300)
  ESTABLISHMENT_ADDRESS = 'POR CONFIRMAR';

  /** Código de identificación del establecimiento (arts. 7 y 8; un libro por establecimiento). */
  @IsString()
  @Length(1, 20)
  ESTABLISHMENT_CODE = 'WEB';

  /** Versión del texto de conformidad que reemplaza la firma del consumidor. */
  @IsString()
  @Length(1, 40)
  COMPLAINT_CONFORMITY_TEXT_VERSION = '2026-10-draft';

  /** Versión de la cláusula de privacidad mostrada en el formulario. */
  @IsString()
  @Length(1, 40)
  PRIVACY_NOTICE_VERSION = '2026-10-draft';

  /** Clave maestra AES-256 (32 bytes en base64) para datos personales cifrados. Obligatoria en producción. */
  @Transform(({ value }: { value: unknown }) => (value === '' ? undefined : value))
  @IsOptional()
  @IsBase64()
  PII_ENCRYPTION_KEY?: string;
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
    if (!env.PII_ENCRYPTION_KEY) messages.push('PII_ENCRYPTION_KEY es obligatoria en producción.');
    if (!/^\d{11}$/.test(env.PROVIDER_RUC)) messages.push('PROVIDER_RUC debe tener 11 dígitos en producción.');
    for (const key of ['PROVIDER_LEGAL_NAME', 'ESTABLISHMENT_ADDRESS'] as const) {
      if (/POR CONFIRMAR/i.test(env[key])) messages.push(`${key} no puede quedar "POR CONFIRMAR" en producción.`);
    }
  }
  if (env.DEMO_PRICING && env.DATA_SOURCE === 'prisma') messages.push('DEMO_PRICING solo aplica a DATA_SOURCE=seed|memory.');
  if (env.PII_ENCRYPTION_KEY && Buffer.from(env.PII_ENCRYPTION_KEY, 'base64').length !== 32) {
    messages.push('PII_ENCRYPTION_KEY debe decodificar a 32 bytes (base64).');
  }
  if (messages.length > 0) {
    throw new Error(`Configuración inválida:\n - ${messages.join('\n - ')}`);
  }
  return env;
}
