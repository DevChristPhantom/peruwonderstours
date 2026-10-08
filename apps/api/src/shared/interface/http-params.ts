import { createParamDecorator, type ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';

function header(ctx: ExecutionContext, name: string): string | undefined {
  const value = ctx.switchToHttp().getRequest<Request>().headers[name];
  return Array.isArray(value) ? value[0] : value;
}

/** Cabecera `Idempotency-Key` (la validación de formato/obligatoriedad la hace el caso de uso). */
export const IdempotencyKey = createParamDecorator((_data: unknown, ctx: ExecutionContext) => header(ctx, 'idempotency-key'));

/** Cabecera `X-Cart-Token` del carrito anónimo. */
export const CartToken = createParamDecorator((_data: unknown, ctx: ExecutionContext) => header(ctx, 'x-cart-token'));

/** Cuerpo crudo (requiere `rawBody: true` al crear la app) para verificar firmas de webhooks. */
export const RawBody = createParamDecorator((_data: unknown, ctx: ExecutionContext): Buffer => {
  const request = ctx.switchToHttp().getRequest<Request & { rawBody?: Buffer }>();
  return request.rawBody ?? Buffer.alloc(0);
});

/** Cabecera `X-Booking-Token`: token de acceso del comprador a su reserva. */
export const BookingToken = createParamDecorator((_data: unknown, ctx: ExecutionContext) => header(ctx, 'x-booking-token'));

/** Cabecera `X-Complaint-Token`: token de consulta de la hoja de reclamación. */
export const ComplaintToken = createParamDecorator((_data: unknown, ctx: ExecutionContext) => header(ctx, 'x-complaint-token'));
