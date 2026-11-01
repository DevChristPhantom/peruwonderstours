import { createHash, createHmac, randomInt, timingSafeEqual } from 'node:crypto';
import { DomainError } from '../../../shared/domain/domain-error.js';
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

export type IzipayEnvironment = 'sandbox' | 'production';

export const IZIPAY_API_BASE_URLS: Readonly<Record<IzipayEnvironment, string>> = {
  sandbox: 'https://sandbox-api-pw.izipay.pe',
  production: 'https://api-pw.izipay.pe',
};
export const IZIPAY_SDK_URLS: Readonly<Record<IzipayEnvironment, string>> = {
  sandbox: 'https://sandbox-checkout.izipay.pe/payments/v1/js/index.js',
  production: 'https://checkout.izipay.pe/payments/v1/js/index.js',
};

export interface IzipayGatewayOptions {
  environment: IzipayEnvironment;
  /** Código de comercio que entrega Izipay en la afiliación. */
  merchantCode: string;
  /** «Clave API» del panel: autentica la generación de tokens de sesión. Secreta. */
  apiKey: string;
  /** «keyRSA» del panel: la usa el SDK en el navegador (pública). */
  rsaPublicKey: string;
  /** «claveHash» del panel: firma HMAC-SHA256 de respuestas e IPN. Secreta. */
  hashKey: string;
  /** RUC del comercio (lo exige la API de devoluciones). */
  ruc: string;
  /** URL pública de `POST /api/v1/payments/webhooks/izipay`. */
  ipnUrl: string;
  timeoutMs?: number;
}

/** Respuesta común de la API y del SDK de Izipay (`code` "00" = aprobado). */
interface IzipayEnvelope {
  code?: unknown;
  message?: unknown;
  messageUser?: unknown;
  transactionId?: unknown;
  response?: {
    token?: unknown;
    order?: Array<Record<string, unknown>>;
    result?: Record<string, unknown>;
  };
  payloadHttp?: unknown;
  signature?: unknown;
}

/** Sin respuesta definitiva del autorizador: se reconsulta más tarde (conciliación). */
const UNKNOWN_RESULT_CODES = new Set(['021', 'COMMUNICATION_ERROR']);

/**
 * Pasarela Izipay (SDK web «Web Core» + API REST `api-pw.izipay.pe`).
 * - `createIntent` genera un token de sesión y devuelve al navegador lo que necesita el SDK;
 *   el formulario de tarjeta/Yape/Plin es el de Izipay (PCI DSS SAQ-A).
 * - La respuesta del SDK y la IPN traen `payloadHttp` firmado: HMAC-SHA256 en base64 con la
 *   claveHash. Solo se confía en el contenido de `payloadHttp` tras verificar esa firma.
 * - `providerPaymentId` es el `orderNumber` de Izipay, derivado de la clave de idempotencia:
 *   reintentos del mismo pago reutilizan el mismo pedido.
 */
export class IzipayPaymentGateway implements PaymentGateway {
  readonly provider = 'izipay' as const;
  private readonly baseUrl: string;
  private readonly refunds = new Map<string, RefundResult>();

  constructor(
    private readonly options: IzipayGatewayOptions,
    private readonly clock: Clock,
    private readonly fetchFn: typeof fetch = globalThis.fetch,
  ) {
    for (const [name, value] of [['IZIPAY_MERCHANT_CODE', options.merchantCode], ['IZIPAY_API_KEY', options.apiKey], ['IZIPAY_RSA_PUBLIC_KEY', options.rsaPublicKey], ['IZIPAY_IPN_URL', options.ipnUrl]] as const) {
      if (!value) throw new Error(`${name} es obligatoria para la pasarela Izipay.`);
    }
    if (options.hashKey.length < 16) throw new Error('IZIPAY_HASH_KEY debe tener al menos 16 caracteres.');
    this.baseUrl = IZIPAY_API_BASE_URLS[options.environment];
  }

  /** `orderNumber` estable de 15 caracteres alfanuméricos (límite de Izipay: 5–15). */
  static orderNumberFor(idempotencyKey: string): string {
    return `PW${createHash('sha256').update(idempotencyKey).digest('hex').slice(0, 13).toUpperCase()}`;
  }

  async createIntent(input: CreateIntentInput): Promise<PaymentIntent> {
    const orderNumber = IzipayPaymentGateway.orderNumberFor(input.idempotencyKey);
    const transactionId = this.transactionId();
    const amount = input.amount.toDecimalString();
    const token = await this.sessionToken(transactionId, orderNumber, amount, 'ECOMMERCE');
    return {
      providerPaymentId: orderNumber,
      status: 'requires_action',
      nextAction: {
        type: 'sdk',
        token,
        params: {
          scriptUrl: IZIPAY_SDK_URLS[this.options.environment],
          keyRSA: this.options.rsaPublicKey,
          transactionId,
          merchantCode: this.options.merchantCode,
          orderNumber,
          amount,
          currency: input.amount.currency,
          processType: 'AT',
          urlIPN: this.options.ipnUrl,
        },
      },
    };
  }

  /**
   * `confirmation` = `{ payloadHttp, signature }` tal como los entrega el SDK. Sin firma (p. ej.
   * error de comunicación del SDK) se consulta el estado servidor a servidor.
   */
  async confirm(providerPaymentId: string, confirmation: Record<string, string>): Promise<ProviderPaymentState> {
    const { payloadHttp, signature } = confirmation;
    if (!payloadHttp && !signature) return this.getStatus(providerPaymentId);
    if (!payloadHttp || !signature || !this.validSignature(payloadHttp, signature)) {
      throw new DomainError('invalid-confirmation', 'La respuesta de la pasarela no tiene una firma válida.', 'validation');
    }
    const body = this.parsePayload(payloadHttp);
    const state = this.stateFrom(body, providerPaymentId);
    if (state.providerPaymentId !== providerPaymentId) {
      throw new DomainError('invalid-confirmation', 'La respuesta de la pasarela corresponde a otro pedido.', 'validation');
    }
    return state;
  }

  async getStatus(providerPaymentId: string): Promise<ProviderPaymentState> {
    const transactionId = this.transactionId();
    const token = await this.sessionToken(transactionId, providerPaymentId, '0.00', 'ECOMMERCE');
    const body = await this.post('/orderinfo/v1/Transaction/Search', transactionId, token, {
      merchantCode: this.options.merchantCode,
      numberOrden: providerPaymentId,
      language: 'ESP',
    }, true);
    return this.stateFrom(body, providerPaymentId);
  }

  async refund(input: RefundInput): Promise<RefundResult> {
    const previous = this.refunds.get(input.idempotencyKey);
    if (previous) return previous;
    const order = await this.paidOrder(input.providerPaymentId);
    const paid = toMoney(order['amount'], order['currency']);
    if (!paid || paid.currency !== input.amount.currency || input.amount.greaterThan(paid)) {
      throw new PaymentGatewayError('El reembolso supera el pago o usa otra moneda (Izipay).');
    }
    const transactionId = this.transactionId();
    const refundAmount = input.amount.toDecimalString();
    const token = await this.sessionToken(transactionId, input.providerPaymentId, refundAmount, 'REFUND');
    const body = await this.post('/refund/v1/Transaction/Refund', transactionId, token, {
      merchantCode: this.options.merchantCode,
      ruc: this.options.ruc,
      idUnique: text(order['uniqueId']),
      order: {
        authorizationCode: text(order['codeAuth']),
        referenceNumber: text(order['referenceNumber']),
        currency: input.amount.currency,
        refundAmount,
        totalAmount: paid.toDecimalString(),
        transactionDate: text(order['dateTransaction']),
      },
      language: 'ESP',
    });
    const refundId = body.response?.result?.['refundTransactionId'];
    if (body.code !== '00' || typeof refundId !== 'string' || !refundId) {
      throw new PaymentGatewayError('Izipay no registró la devolución.', { code: body.code, message: body.message });
    }
    // «La devolución fue registrada»: Izipay la liquida con el banco emisor.
    const result: RefundResult = { providerRefundId: `izp_ref_${refundId}`, status: 'succeeded' };
    this.refunds.set(input.idempotencyKey, result);
    return result;
  }

  /**
   * IPN: JSON con `payloadHttp` + `signature`. No trae marca de tiempo propia: el anti-replay
   * es la idempotencia por `eventId` (transactionId + uniqueId) y los estados terminales.
   */
  verifyWebhook(rawBody: Buffer, _headers: WebhookHeaders): WebhookEvent {
    let envelope: IzipayEnvelope;
    try {
      envelope = JSON.parse(rawBody.toString('utf8')) as IzipayEnvelope;
    } catch {
      throw new DomainError('invalid-webhook-payload', 'Cuerpo del webhook inválido.', 'validation');
    }
    const { payloadHttp, signature } = envelope;
    if (typeof payloadHttp !== 'string' || typeof signature !== 'string') throw new InvalidWebhookSignatureError('missing_signature');
    if (!this.validSignature(payloadHttp, signature)) throw new InvalidWebhookSignatureError('signature_mismatch');

    const body = this.parsePayload(payloadHttp);
    const order = body.response?.order?.[0] ?? {};
    const orderNumber = typeof order['orderNumber'] === 'string' ? order['orderNumber'] : null;
    const transactionId = typeof body.transactionId === 'string' ? body.transactionId : '';
    if (!transactionId || transactionId.length > 40) throw new DomainError('invalid-webhook-payload', 'Notificación sin transactionId.', 'validation');
    const state = orderNumber ? this.stateFrom(body, orderNumber) : null;
    return {
      eventId: `${transactionId}:${text(order['uniqueId']) || text(body.code)}`.slice(0, 160),
      type: `izipay.${text(body.code) || 'unknown'}`.slice(0, 80),
      providerPaymentId: orderNumber,
      status: state?.status ?? null,
      amount: state?.amount ?? null,
      occurredAt: this.clock.now(),
      // Sin datos del comprador ni de la tarjeta (solo lo necesario para conciliar).
      payload: {
        transactionId,
        code: body.code,
        orderNumber,
        uniqueId: order['uniqueId'],
        stateMessage: order['stateMessage'],
        amount: order['amount'],
        currency: order['currency'],
      },
    };
  }

  /** Firma como Izipay (tests y herramientas locales). */
  sign(payloadHttp: string): string {
    return createHmac('sha256', Buffer.from(this.options.hashKey, 'utf8')).update(payloadHttp, 'utf8').digest('base64');
  }

  private validSignature(payloadHttp: string, signature: string): boolean {
    const expected = Buffer.from(this.sign(payloadHttp), 'base64');
    const actual = Buffer.from(signature, 'base64');
    return actual.length === expected.length && timingSafeEqual(actual, expected);
  }

  private parsePayload(payloadHttp: string): IzipayEnvelope {
    try {
      return JSON.parse(payloadHttp) as IzipayEnvelope;
    } catch {
      throw new DomainError('invalid-confirmation', 'Respuesta de la pasarela ilegible.', 'validation');
    }
  }

  private stateFrom(body: IzipayEnvelope, providerPaymentId: string): ProviderPaymentState {
    const code = typeof body.code === 'string' ? body.code : '';
    const order = body.response?.order?.[0];
    const orderNumber = typeof order?.['orderNumber'] === 'string' ? order['orderNumber'] : providerPaymentId;
    const amount = order ? toMoney(order['amount'], order['currency']) : null;
    let status: PaymentStatus;
    if (code === '00' && order) status = 'succeeded';
    // Pedido aún sin transacción (el comprador no terminó) o resultado desconocido: sigue abierto.
    else if (UNKNOWN_RESULT_CODES.has(code) || (!order && /no encontrada|not found/i.test(text(body.message)))) status = 'requires_action';
    else status = 'failed';
    return {
      providerPaymentId: orderNumber,
      status,
      amount,
      failureCode: status === 'failed' ? `izipay_${code || 'unknown'}` : null,
      failureMessage: status === 'failed' ? (typeof body.messageUser === 'string' && body.messageUser ? body.messageUser : 'El pago fue rechazado. Prueba otra tarjeta o medio.') : null,
    };
  }

  private async paidOrder(orderNumber: string): Promise<Record<string, unknown>> {
    const transactionId = this.transactionId();
    const token = await this.sessionToken(transactionId, orderNumber, '0.00', 'ECOMMERCE');
    const body = await this.post('/orderinfo/v1/Transaction/Search', transactionId, token, {
      merchantCode: this.options.merchantCode,
      numberOrden: orderNumber,
      language: 'ESP',
    });
    const order = body.response?.order?.[0];
    if (body.code !== '00' || !order) throw new PaymentGatewayError('Solo se reembolsan pagos aprobados (Izipay).', { orderNumber });
    return order;
  }

  private async sessionToken(transactionId: string, orderNumber: string, amount: string, requestSource: 'ECOMMERCE' | 'REFUND'): Promise<string> {
    const body = await this.post('/security/v1/Token/Generate', transactionId, null, {
      requestSource,
      merchantCode: this.options.merchantCode,
      orderNumber,
      publicKey: this.options.apiKey,
      amount,
    });
    const token = body.response?.token;
    if (body.code !== '00' || typeof token !== 'string' || !token) {
      throw new PaymentGatewayError('Izipay no generó el token de sesión.', { code: body.code, message: body.message });
    }
    return token;
  }

  /** POST JSON. `acceptClientErrors`: una 4xx con cuerpo de Izipay (p. ej. «no encontrada») es respuesta, no fallo. */
  private async post(path: string, transactionId: string, token: string | null, payload: unknown, acceptClientErrors = false): Promise<IzipayEnvelope> {
    let response: Response;
    try {
      response = await this.fetchFn(`${this.baseUrl}${path}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', accept: 'application/json', transactionId, ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(this.options.timeoutMs ?? 15_000),
      });
    } catch (error) {
      throw new PaymentGatewayError('Izipay no respondió.', { path, reason: error instanceof Error ? error.name : 'unknown' });
    }
    const text = await response.text();
    let body: IzipayEnvelope | null = null;
    try {
      body = JSON.parse(text) as IzipayEnvelope;
    } catch {
      body = null;
    }
    if (body && (response.ok || (acceptClientErrors && response.status >= 400 && response.status < 500))) return body;
    throw new PaymentGatewayError('Respuesta inesperada de Izipay.', { path, status: response.status, code: body?.code });
  }

  /** Id de correlación por llamada (Izipay: 5–40 caracteres). */
  private transactionId(): string {
    return `${this.clock.now().getTime()}${randomInt(0, 1_000_000).toString().padStart(6, '0')}`;
  }
}

/** Campo de texto de Izipay (string o número); cualquier otra cosa cuenta como vacío. */
function text(value: unknown): string {
  return typeof value === 'string' || typeof value === 'number' ? String(value) : '';
}

/** "149.00" + "PEN" → Money en céntimos, sin floats; null si no es un monto válido. */
function toMoney(amount: unknown, currency: unknown): Money | null {
  if (typeof amount !== 'string' || !isCurrencyCode(currency)) return null;
  const match = /^(\d+)(?:\.(\d{1,2}))?$/.exec(amount.trim());
  if (!match) return null;
  return Money.of(BigInt(match[1]!) * 100n + BigInt((match[2] ?? '').padEnd(2, '0')), currency);
}
