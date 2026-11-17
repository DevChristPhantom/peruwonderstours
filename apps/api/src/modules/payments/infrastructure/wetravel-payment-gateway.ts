import { createHash, createHmac, timingSafeEqual } from 'node:crypto';
import { isCurrencyCode, Money } from '../../../shared/domain/money.js';
import type { Clock } from '../../../shared/domain/ports.js';
import type { PaymentStatus } from '../domain/payment.js';
import {
  InvalidWebhookSignatureError,
  PaymentGatewayError,
  type CreateIntentInput,
  type PaymentGateway,
  type PaymentIntent,
  type ProviderPaymentState,
  type RefundInput,
  type RefundResult,
  type WebhookEvent,
  type WebhookHeaders,
} from '../domain/payment-gateway.js';

export type WeTravelEnvironment = 'sandbox' | 'production';

export const WETRAVEL_API_BASE_URLS: Readonly<Record<WeTravelEnvironment, string>> = {
  sandbox: 'https://api.demo.wetravel.to',
  production: 'https://api.wetravel.com',
};

export interface WeTravelGatewayOptions {
  environment: WeTravelEnvironment;
  /** «Public API Key» del panel de WeTravel: es un refresh token (solo sirve para pedir tokens de 1 h). Secreta. */
  apiKey: string;
  /** Secreto `whsec_…` del endpoint en «Manage Webhooks» (Svix). Sin él se rechazan los webhooks. */
  webhookSecret?: string;
  webhookToleranceSeconds: number;
  timeoutMs?: number;
}

/** Estados de transacción de WeTravel (la doc solo muestra "processed" como ejemplo; el resto, por prudencia). */
const PAID_STATUSES = new Set(['processed', 'succeeded', 'successful', 'paid', 'completed', 'settled']);
const FAILED_STATUSES = new Set(['failed', 'declined', 'canceled', 'cancelled', 'voided']);

interface WeTravelTransaction {
  amount?: unknown;
  customer_facing_amount?: unknown;
  refunded_amount?: unknown;
  currency?: unknown;
  status?: unknown;
  type?: unknown;
}

/**
 * Pasarela WeTravel (Partner API, «Payment Links»).
 * - `createIntent` crea un enlace de pago de un solo uso con el monto exacto de la reserva y devuelve
 *   `redirect` a la página de pago de WeTravel. El `trip.uuid` del enlace es el `providerPaymentId`.
 * - WeTravel no informa el pago en la respuesta del enlace: el estado se obtiene listando las
 *   transacciones del viaje (`POST /v2/transactions` filtrado por `trip_uuids`). Se usa en «Ya pagué»
 *   (`confirm`), en la conciliación periódica y tras cada webhook.
 * - Los webhooks (Svix) solo avisan; nunca se confía en su contenido: se verifica la firma y se vuelve a
 *   consultar el estado a la API.
 * - `participant_fees: "none"`: el viajero paga exactamente el precio de la web (la comisión la asume la
 *   agencia), como exige mostrar el precio final.
 * - Los montos de transacciones se interpretan en céntimos. Si WeTravel los informara en unidades, la
 *   validación de monto (H-10) rechaza el pago en vez de darlo por pagado: verificar con un pago de prueba.
 */
export class WeTravelPaymentGateway implements PaymentGateway {
  readonly provider = 'wetravel' as const;
  private readonly baseUrl: string;
  private accessToken: { value: string; expiresAt: number } | null = null;
  /** Reintentos del mismo cobro (misma clave de idempotencia) reutilizan el enlace ya creado. */
  private readonly links = new Map<string, { tripUuid: string; url: string; at: number }>();

  constructor(
    private readonly options: WeTravelGatewayOptions,
    private readonly clock: Clock,
    private readonly fetchFn: typeof fetch = globalThis.fetch,
  ) {
    if (!options.apiKey || options.apiKey.length < 16) throw new Error('WETRAVEL_API_KEY es obligatoria para la pasarela WeTravel.');
    this.baseUrl = WETRAVEL_API_BASE_URLS[options.environment];
  }

  /** Referencia interna del enlace (no la ve el viajero): estable por clave de idempotencia. */
  static tripIdFor(idempotencyKey: string): string {
    return `PWT-${createHash('sha256').update(idempotencyKey).digest('hex').slice(0, 16).toUpperCase()}`;
  }

  async createIntent(input: CreateIntentInput): Promise<PaymentIntent> {
    const now = this.clock.now().getTime();
    for (const [key, link] of this.links) if (now - link.at > 24 * 3600_000) this.links.delete(key);
    const cached = this.links.get(input.idempotencyKey);
    if (cached) return { providerPaymentId: cached.tripUuid, status: 'requires_action', nextAction: { type: 'redirect', url: cached.url } };

    const today = this.clock.now().toISOString().slice(0, 10);
    const body = {
      data: {
        trip: {
          title: input.description.slice(0, 120),
          trip_id: WeTravelPaymentGateway.tripIdFor(input.idempotencyKey),
          start_date: today,
          end_date: today,
          currency: input.amount.currency,
          participant_fees: 'none',
        },
        pricing: { price: Number(input.amount.toDecimalString()) },
      },
    };
    const res = await this.api<{ data?: { trip?: { uuid?: unknown; url?: unknown } } }>('POST', '/v2/payment_links?publish_immediately=true', body);
    const tripUuid = res.data?.trip?.uuid;
    const url = res.data?.trip?.url;
    if (typeof tripUuid !== 'string' || !tripUuid || typeof url !== 'string' || !url.startsWith('https://')) {
      throw new PaymentGatewayError('WeTravel no devolvió el enlace de pago.');
    }
    this.links.set(input.idempotencyKey, { tripUuid, url, at: now });
    return { providerPaymentId: tripUuid, status: 'requires_action', nextAction: { type: 'redirect', url } };
  }

  /** «Ya pagué»: no hay respuesta firmada del formulario; se consulta el estado a WeTravel. */
  confirm(providerPaymentId: string): Promise<ProviderPaymentState> {
    return this.getStatus(providerPaymentId);
  }

  async getStatus(providerPaymentId: string): Promise<ProviderPaymentState> {
    const res = await this.api<{ data?: WeTravelTransaction[] }>('POST', '/v2/transactions', {
      page: 1,
      per_page: 100,
      filters: { trip_uuids: [providerPaymentId] },
    });
    const transactions = Array.isArray(res.data) ? res.data : [];
    const payments = transactions.filter((t) => text(t.type).toLowerCase() === 'payment');
    const paid = payments.filter((t) => PAID_STATUSES.has(text(t.status).toLowerCase()));
    if (paid.length > 0) {
      const currency = text(paid[0]!.currency).toUpperCase();
      const cents = paid.reduce((sum, t) => sum + toCents(t.customer_facing_amount ?? t.amount) - toCents(t.refunded_amount), 0n);
      const amount = isCurrencyCode(currency) && cents > 0n ? Money.of(cents, currency) : null;
      return { providerPaymentId, status: amount ? 'succeeded' : 'failed', amount, failureCode: amount ? null : 'refunded_or_unknown_amount' };
    }
    const status: PaymentStatus = payments.some((t) => FAILED_STATUSES.has(text(t.status).toLowerCase())) ? 'failed' : 'requires_action';
    return { providerPaymentId, status, amount: null, failureCode: status === 'failed' ? 'payment_failed' : null };
  }

  /** La Partner API no expone devoluciones: se hacen desde el panel de WeTravel. */
  async refund(_input: RefundInput): Promise<RefundResult> {
    throw new PaymentGatewayError('Los reembolsos de WeTravel se hacen desde el panel de WeTravel (Payments > Transactions).');
  }

  /**
   * Firma Svix: HMAC-SHA256 (clave = base64 tras `whsec_`) de `${id}.${timestamp}.${cuerpo}`, en base64,
   * en `svix-signature` (o `webhook-signature`) como lista "v1,<firma>". Devuelve el `trip.uuid` sin
   * estado: el caso de uso consulta el estado real con `getStatus`.
   */
  verifyWebhook(rawBody: Buffer, headers: WebhookHeaders): WebhookEvent {
    const secret = this.options.webhookSecret;
    if (!secret?.startsWith('whsec_')) throw new InvalidWebhookSignatureError('webhook_secret_not_configured');
    const header = (name: string) => {
      const v = headers[`svix-${name}`] ?? headers[`webhook-${name}`];
      return Array.isArray(v) ? v[0] : v;
    };
    const id = header('id');
    const timestamp = header('timestamp');
    const signatures = header('signature');
    if (!id || !timestamp || !signatures) throw new InvalidWebhookSignatureError('missing_headers');
    const ts = Number(timestamp);
    const nowSeconds = Math.floor(this.clock.now().getTime() / 1000);
    if (!Number.isInteger(ts) || Math.abs(nowSeconds - ts) > this.options.webhookToleranceSeconds) {
      throw new InvalidWebhookSignatureError('timestamp_out_of_tolerance');
    }
    const key = Buffer.from(secret.slice('whsec_'.length), 'base64');
    const expected = createHmac('sha256', key).update(`${id}.${timestamp}.`).update(rawBody).digest();
    const valid = signatures.split(' ').some((entry) => {
      const [version, sig] = entry.split(',');
      if (version !== 'v1' || !sig) return false;
      const given = Buffer.from(sig, 'base64');
      return given.length === expected.length && timingSafeEqual(given, expected);
    });
    if (!valid) throw new InvalidWebhookSignatureError('signature_mismatch');

    let payload: Record<string, unknown>;
    try {
      payload = JSON.parse(rawBody.toString('utf8')) as Record<string, unknown>;
    } catch {
      throw new InvalidWebhookSignatureError('invalid_json');
    }
    const type = typeof payload.type === 'string' ? payload.type : typeof payload.event === 'string' ? payload.event : 'unknown';
    return {
      eventId: id,
      type,
      providerPaymentId: findTripUuid(payload),
      status: null,
      amount: null,
      occurredAt: new Date(ts * 1000),
      payload: { type, tripUuid: findTripUuid(payload) },
    };
  }

  private async token(): Promise<string> {
    const now = this.clock.now().getTime();
    if (this.accessToken && this.accessToken.expiresAt - 60_000 > now) return this.accessToken.value;
    const res = await this.request<{ access_token?: unknown }>('POST', '/v2/auth/tokens/access', undefined, this.options.apiKey);
    if (typeof res.access_token !== 'string' || !res.access_token) throw new PaymentGatewayError('WeTravel no entregó el token de acceso.');
    this.accessToken = { value: res.access_token, expiresAt: now + 55 * 60_000 };
    return res.access_token;
  }

  private async api<T>(method: 'GET' | 'POST', path: string, body?: unknown): Promise<T> {
    try {
      return await this.request<T>(method, path, body, await this.token());
    } catch (error) {
      // Token revocado o vencido antes de tiempo: se pide uno nuevo una sola vez.
      if (error instanceof PaymentGatewayError && error.details?.status === 401) {
        this.accessToken = null;
        return this.request<T>(method, path, body, await this.token());
      }
      throw error;
    }
  }

  private async request<T>(method: 'GET' | 'POST', path: string, body: unknown, bearer: string): Promise<T> {
    let res: Response;
    try {
      res = await this.fetchFn(`${this.baseUrl}${path}`, {
        method,
        headers: { authorization: `Bearer ${bearer}`, accept: 'application/json', ...(body === undefined ? {} : { 'content-type': 'application/json' }) },
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: AbortSignal.timeout(this.options.timeoutMs ?? 15_000),
      });
    } catch (error) {
      throw new PaymentGatewayError('WeTravel no respondió.', { reason: error instanceof Error ? error.name : 'network' });
    }
    if (!res.ok) {
      // Nunca se registra el cuerpo completo: podría traer datos del viajero.
      throw new PaymentGatewayError('WeTravel rechazó la solicitud.', { status: res.status, path: path.split('?')[0] });
    }
    return (await res.json()) as T;
  }
}

/** Campo de texto de WeTravel; cualquier otro tipo cuenta como vacío. */
function text(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

/** Montos de WeTravel (enteros en céntimos) → bigint; cualquier otra cosa cuenta como 0. */
function toCents(value: unknown): bigint {
  if (typeof value === 'number' && Number.isSafeInteger(value)) return BigInt(value);
  if (typeof value === 'string' && /^\d+$/.test(value)) return BigInt(value);
  return 0n;
}

/** Busca el uuid del viaje (= enlace de pago) en las formas conocidas del payload de WeTravel. */
function findTripUuid(payload: Record<string, unknown>): string | null {
  const data = (payload.data && typeof payload.data === 'object' ? payload.data : payload) as Record<string, unknown>;
  const trip = data.trip && typeof data.trip === 'object' ? (data.trip as Record<string, unknown>) : null;
  const candidates = [trip?.uuid, data.trip_uuid, data.tripUuid];
  const found = candidates.find((v) => typeof v === 'string' && /^[A-Za-z0-9-]{6,64}$/.test(v));
  return typeof found === 'string' ? found : null;
}
