import { CurrencyMismatchError, InvalidMoneyError, Money } from './money.js';

describe('Money', () => {
  it('crea montos en céntimos desde bigint, entero o string de dígitos', () => {
    expect(Money.of(12_345n, 'PEN').amount).toBe(12_345n);
    expect(Money.of(12_345, 'USD').amount).toBe(12_345n);
    expect(Money.of('12345', 'USD').amount).toBe(12_345n);
  });

  it('rechaza floats, decimales y valores no seguros (nunca float para dinero)', () => {
    expect(() => Money.of(10.5, 'PEN')).toThrow(InvalidMoneyError);
    expect(() => Money.of('10.50', 'PEN')).toThrow(InvalidMoneyError);
    expect(() => Money.of(Number.MAX_SAFE_INTEGER + 1, 'PEN')).toThrow(InvalidMoneyError);
    expect(() => Money.of(Number.NaN, 'PEN')).toThrow(InvalidMoneyError);
  });

  it('rechaza monedas no soportadas', () => {
    expect(() => Money.of(1, 'EUR')).toThrow(/Moneda no soportada/);
  });

  it('suma y resta en la misma moneda', () => {
    const a = Money.of(1_000, 'USD');
    expect(a.add(Money.of(250, 'USD')).amount).toBe(1_250n);
    expect(a.subtract(Money.of(1_250, 'USD')).amount).toBe(-250n);
    expect(Money.sum([a, a, a]).amount).toBe(3_000n);
  });

  it('rechaza combinar monedas distintas', () => {
    expect(() => Money.of(1, 'USD').add(Money.of(1, 'PEN'))).toThrow(CurrencyMismatchError);
    expect(() => Money.sum([Money.of(1, 'USD'), Money.of(1, 'PEN')])).toThrow(CurrencyMismatchError);
    expect(() => Money.of(1, 'USD').compare(Money.of(1, 'PEN'))).toThrow(CurrencyMismatchError);
  });

  it('suma de lista vacía no tiene moneda', () => {
    expect(() => Money.sum([])).toThrow(InvalidMoneyError);
  });

  it('multiplica por cantidades enteras', () => {
    expect(Money.of(9_000, 'USD').multiply(3).amount).toBe(27_000n);
    expect(() => Money.of(9_000, 'USD').multiply(1.5)).toThrow(InvalidMoneyError);
  });

  it.each([
    [10_000n, 50, 5_000n],
    [10_001n, 50, 5_001n], // céntimo impar: ceil
    [1n, 50, 1n],
    [99n, 33, 33n], // 32.67 -> 33
    [100n, 100, 100n],
    [0n, 50, 0n],
    [12_345n, 1, 124n], // 123.45 -> 124
  ])('percentCeil(%s, %s%%) = %s', (amount, pct, expected) => {
    expect(Money.of(amount, 'PEN').percentCeil(pct).amount).toBe(expected);
  });

  it('percentCeil valida el porcentaje y el signo', () => {
    expect(() => Money.of(100, 'PEN').percentCeil(50.5)).toThrow(InvalidMoneyError);
    expect(() => Money.of(100, 'PEN').percentCeil(101)).toThrow(InvalidMoneyError);
    expect(() => Money.of(-100, 'PEN').percentCeil(50)).toThrow(InvalidMoneyError);
  });

  it('compara y formatea sin floats', () => {
    const a = Money.of(5_001, 'USD');
    const b = Money.of(5_000, 'USD');
    expect(a.greaterThan(b)).toBe(true);
    expect(b.lessThan(a)).toBe(true);
    expect(a.min(b)).toBe(b);
    expect(a.equals(Money.of(5_001n, 'USD'))).toBe(true);
    expect(a.equals(Money.of(5_001n, 'PEN'))).toBe(false);
    expect(a.toDecimalString()).toBe('50.01');
    expect(Money.of(-5, 'USD').toDecimalString()).toBe('-0.05');
    expect(a.toString()).toBe('USD 50.01');
    expect(a.toJSON()).toEqual({ amount: 5_001n, currency: 'USD' });
    expect(Money.zero('PEN').isZero()).toBe(true);
    expect(Money.of(-1, 'PEN').isNegative()).toBe(true);
  });
});
