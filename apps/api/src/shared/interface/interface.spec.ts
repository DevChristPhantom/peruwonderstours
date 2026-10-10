import { NotFoundException, type ArgumentsHost } from '@nestjs/common';
import { lastValueFrom, of } from 'rxjs';
import { validateEnvironment } from '../../config/environment.js';
import { settingsFromEnvironment } from '../../config/app-settings.js';
import { Money } from '../domain/money.js';
import { ConflictError, DomainError } from '../domain/domain-error.js';
import { BigIntSerializerInterceptor, toJsonSafe } from './bigint-serializer.interceptor.js';
import { ProblemDetailsFilter } from './problem-details.filter.js';
import { RequestValidationException, validationExceptionFactory } from './problem-details.js';

function capture(exception: unknown) {
  const sent: { status?: number; type?: string; body?: Record<string, unknown> } = {};
  const response = {
    headersSent: false,
    status(code: number) {
      sent.status = code;
      return this;
    },
    type(t: string) {
      sent.type = t;
      return this;
    },
    send(body: string) {
      sent.body = JSON.parse(body) as Record<string, unknown>;
      return this;
    },
  };
  const request = { headers: { 'x-request-id': 'req-1' }, originalUrl: '/api/v1/x', url: '/api/v1/x', method: 'GET' };
  const host = { switchToHttp: () => ({ getRequest: () => request, getResponse: () => response }) } as unknown as ArgumentsHost;
  new ProblemDetailsFilter('https://example.test/problems').catch(exception, host);
  return sent;
}

describe('RFC 9457 problem+json', () => {
  it('error de dominio => status por categoría, type con código y detalles con bigint serializado', () => {
    const sent = capture(new ConflictError('sold-out', 'Sin cupo', { available: 0n }));
    expect(sent).toMatchObject({ status: 409, type: 'application/problem+json' });
    expect(sent.body).toMatchObject({
      type: 'https://example.test/problems/sold-out',
      title: 'Conflicto',
      status: 409,
      detail: 'Sin cupo',
      code: 'sold-out',
      instance: '/api/v1/x',
      traceId: 'req-1',
      details: { available: 0 },
    });
  });

  it('validación => 400 con lista de campos', () => {
    const exception = validationExceptionFactory([
      { property: 'customer', children: [{ property: 'email', constraints: { isEmail: 'email must be an email' }, children: [] }], constraints: undefined },
    ] as never);
    expect(exception).toBeInstanceOf(RequestValidationException);
    const sent = capture(exception);
    expect(sent.status).toBe(400);
    expect(sent.body?.['errors']).toEqual([{ field: 'customer.email', messages: ['email must be an email'] }]);
  });

  it('HttpException => about:blank; errores desconocidos => 500 sin filtrar detalles internos', () => {
    expect(capture(new NotFoundException('Cannot GET /x')).body).toMatchObject({ type: 'about:blank', status: 404, code: 'not-found' });
    const internal = capture(new Error('password=secreto en stack'));
    expect(internal.status).toBe(500);
    expect(JSON.stringify(internal.body)).not.toContain('secreto');
    expect(capture(new DomainError('x', 'y', 'unavailable')).status).toBe(503);
    expect(capture(new DomainError('x', 'y', 'gone')).status).toBe(410);
    expect(capture(new DomainError('x', 'y', 'unauthorized')).status).toBe(401);
    expect(capture(new DomainError('x', 'y', 'unprocessable')).status).toBe(422);
  });
});

describe('Serializador BigInt', () => {
  it('convierte bigint a number seguro, respeta toJSON y fechas', () => {
    const date = new Date('2026-01-01T00:00:00.000Z');
    expect(toJsonSafe({ a: 1n, m: Money.of(500, 'PEN'), list: [2n], date, map: new Map([['k', 3n]]) })).toEqual({
      a: 1,
      m: { amount: 500, currency: 'PEN' },
      list: [2],
      date,
      map: { k: 3 },
    });
    expect(toJsonSafe(2n ** 60n)).toBe((2n ** 60n).toString());
  });

  it('el interceptor transforma la respuesta', async () => {
    const out = await lastValueFrom(new BigIntSerializerInterceptor().intercept({} as never, { handle: () => of({ total: 10n }) }));
    expect(out).toEqual({ total: 10 });
  });
});

describe('Validación de entorno', () => {
  const base = { SANDBOX_WEBHOOK_SECRET: 'x'.repeat(32) };

  it('aplica valores por defecto y convierte tipos', () => {
    const env = validateEnvironment({ ...base, PORT: '4100', DEMO_PRICING: 'false', HOLD_TTL_MINUTES: '20' });
    expect(env).toMatchObject({ PORT: 4100, DATA_SOURCE: 'seed', DEMO_PRICING: false, HOLD_TTL_MINUTES: 20, DEPOSIT_DEFAULT_PERCENT: 50 });
    const settings = settingsFromEnvironment(env);
    expect(settings.cart.ttlMinutes).toBe(7 * 24 * 60);
    expect(settings.booking.policy).toEqual({ defaultDepositPercent: 50, balanceDueDaysBeforeService: 7, fullPaymentWithinDays: 7, thirdPartyTicketsRequireFull: true });
  });

  it('falla rápido con datos inválidos o inseguros', () => {
    expect(() => validateEnvironment({ ...base, DATA_SOURCE: 'prisma' })).toThrow(/DATABASE_URL/);
    expect(() => validateEnvironment({ ...base, DEPOSIT_DEFAULT_PERCENT: '150' })).toThrow(/DEPOSIT_DEFAULT_PERCENT/);
    expect(() => validateEnvironment({ SANDBOX_WEBHOOK_SECRET: 'corto' })).toThrow(/SANDBOX_WEBHOOK_SECRET/);
    expect(() => validateEnvironment({ ...base, NODE_ENV: 'production', DATA_SOURCE: 'seed' })).toThrow(/producción/);
    expect(() => validateEnvironment({ ...base, DATA_SOURCE: 'prisma', DATABASE_URL: 'postgresql://u@h/db', DEMO_PRICING: 'true' })).toThrow(/DEMO_PRICING/);
  });

  it('H-11: Swagger apagado por defecto en producción y prohibido si se enciende', () => {
    const prod = { ...base, NODE_ENV: 'production', DATA_SOURCE: 'prisma', DATABASE_URL: 'postgresql://u@h/db' };
    const messages = (config: Record<string, unknown>) => {
      try {
        validateEnvironment(config);
        return '';
      } catch (e) {
        return (e as Error).message;
      }
    };
    expect(messages(prod)).not.toMatch(/SWAGGER_ENABLED/);
    expect(messages({ ...prod, SWAGGER_ENABLED: 'true' })).toMatch(/SWAGGER_ENABLED debe ser false/);
    expect(validateEnvironment({ ...base }).SWAGGER_ENABLED).toBe(true); // desarrollo
  });
});
