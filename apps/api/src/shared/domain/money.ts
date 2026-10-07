import { DomainError, ValidationError } from './domain-error.js';

/** Monedas admitidas en el MVP (alineado con `is_supported_currency()` en constraints.sql). */
export const SUPPORTED_CURRENCIES = ['PEN', 'USD'] as const;
export type CurrencyCode = (typeof SUPPORTED_CURRENCIES)[number];

export function isCurrencyCode(value: unknown): value is CurrencyCode {
  return typeof value === 'string' && (SUPPORTED_CURRENCIES as readonly string[]).includes(value);
}

export function assertCurrencyCode(value: unknown): CurrencyCode {
  if (!isCurrencyCode(value)) {
    throw new ValidationError('unsupported-currency', `Moneda no soportada: ${String(value)}`, {
      currency: value,
      supported: SUPPORTED_CURRENCIES,
    });
  }
  return value;
}

export class CurrencyMismatchError extends DomainError {
  constructor(left: CurrencyCode, right: CurrencyCode) {
    super(
      'currency-mismatch',
      `No se pueden combinar montos en ${left} y ${right}.`,
      'unprocessable',
      { left, right },
    );
  }
}

export class InvalidMoneyError extends ValidationError {
  constructor(message: string, details: Record<string, unknown> = {}) {
    super('invalid-money', message, details);
  }
}

/**
 * Valor monetario inmutable en unidades menores (céntimos) como `bigint`.
 * Nunca usa `number` de punto flotante: los porcentajes se aplican con aritmética entera.
 */
export class Money {
  private constructor(
    readonly amount: bigint,
    readonly currency: CurrencyCode,
  ) {}

  /**
   * Crea un monto en céntimos. Acepta `bigint`, un entero seguro de JS o un string de
   * dígitos ("12345"). Rechaza decimales ("12.5", 12.5) para evitar errores de redondeo.
   */
  static of(amount: bigint | number | string, currency: string): Money {
    return new Money(Money.toMinorUnits(amount), assertCurrencyCode(currency));
  }

  static zero(currency: string): Money {
    return new Money(0n, assertCurrencyCode(currency));
  }

  /** Suma una lista no vacía de montos de la misma moneda. */
  static sum(values: readonly Money[]): Money {
    const [first, ...rest] = values;
    if (!first) {
      throw new InvalidMoneyError('No se puede sumar una lista vacía sin moneda.');
    }
    return rest.reduce((acc, value) => acc.add(value), first);
  }

  private static toMinorUnits(amount: bigint | number | string): bigint {
    if (typeof amount === 'bigint') return amount;
    if (typeof amount === 'number') {
      if (!Number.isSafeInteger(amount)) {
        throw new InvalidMoneyError('El monto debe ser un entero en céntimos.', { amount });
      }
      return BigInt(amount);
    }
    if (!/^-?\d+$/.test(amount)) {
      throw new InvalidMoneyError('El monto debe ser un entero en céntimos.', { amount });
    }
    return BigInt(amount);
  }

  add(other: Money): Money {
    this.assertSameCurrency(other);
    return new Money(this.amount + other.amount, this.currency);
  }

  subtract(other: Money): Money {
    this.assertSameCurrency(other);
    return new Money(this.amount - other.amount, this.currency);
  }

  multiply(factor: bigint | number): Money {
    const f = typeof factor === 'bigint' ? factor : Money.toMinorUnits(factor);
    return new Money(this.amount * f, this.currency);
  }

  /**
   * Porcentaje entero redondeado hacia arriba al céntimo: ceil(amount * percent / 100).
   * Solo para montos no negativos (el redondeo "a favor del adelanto" es un supuesto de negocio).
   */
  percentCeil(percent: number): Money {
    if (!Number.isInteger(percent) || percent < 0 || percent > 100) {
      throw new InvalidMoneyError('El porcentaje debe ser un entero entre 0 y 100.', { percent });
    }
    if (this.amount < 0n) {
      throw new InvalidMoneyError('No se aplica porcentaje a montos negativos.');
    }
    const numerator = this.amount * BigInt(percent);
    const quotient = numerator / 100n;
    const rounded = numerator % 100n === 0n ? quotient : quotient + 1n;
    return new Money(rounded, this.currency);
  }

  isZero(): boolean {
    return this.amount === 0n;
  }

  isNegative(): boolean {
    return this.amount < 0n;
  }

  isPositive(): boolean {
    return this.amount > 0n;
  }

  equals(other: Money): boolean {
    return this.currency === other.currency && this.amount === other.amount;
  }

  compare(other: Money): -1 | 0 | 1 {
    this.assertSameCurrency(other);
    if (this.amount === other.amount) return 0;
    return this.amount < other.amount ? -1 : 1;
  }

  greaterThan(other: Money): boolean {
    return this.compare(other) === 1;
  }

  lessThan(other: Money): boolean {
    return this.compare(other) === -1;
  }

  min(other: Money): Money {
    return this.lessThan(other) ? this : other;
  }

  /** "1234.50" — representación decimal exacta (sin floats), útil para pasarelas y logs. */
  toDecimalString(): string {
    const negative = this.amount < 0n;
    const abs = negative ? -this.amount : this.amount;
    const units = abs / 100n;
    const cents = (abs % 100n).toString().padStart(2, '0');
    return `${negative ? '-' : ''}${units.toString()}.${cents}`;
  }

  toJSON(): { amount: bigint; currency: CurrencyCode } {
    return { amount: this.amount, currency: this.currency };
  }

  toString(): string {
    return `${this.currency} ${this.toDecimalString()}`;
  }

  private assertSameCurrency(other: Money): void {
    if (this.currency !== other.currency) {
      throw new CurrencyMismatchError(this.currency, other.currency);
    }
  }
}
