import { ApiProperty } from '@nestjs/swagger';
import type { Money } from '../domain/money.js';

/** Monto en céntimos (entero) + moneda ISO 4217. */
export class MoneyDto {
  @ApiProperty({ example: 49950, description: 'Monto en céntimos (entero; nunca decimales).', type: 'integer', format: 'int64' })
  amount: number;

  @ApiProperty({ enum: ['PEN', 'USD'], example: 'USD' })
  currency: 'PEN' | 'USD';
}

export class PageMetaDto {
  @ApiProperty() page: number;
  @ApiProperty() pageSize: number;
  @ApiProperty() total: number;
  @ApiProperty() totalPages: number;
}

/** Los montos salen como `bigint`; el interceptor global los convierte a número JSON. */
export function money(value: Money): { amount: bigint; currency: 'PEN' | 'USD' } {
  return { amount: value.amount, currency: value.currency };
}

export function pageMeta(page: number, pageSize: number, total: number): PageMetaDto {
  return { page, pageSize, total, totalPages: Math.ceil(total / pageSize) };
}
