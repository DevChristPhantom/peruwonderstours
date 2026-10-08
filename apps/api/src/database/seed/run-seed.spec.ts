import { demoDepartureId, demoRateId, generateDemoPricing } from '../../modules/catalog/infrastructure/seed/demo-pricing.js';
import { describeError, parseSeedArgs } from './run-seed.js';

describe('CLI del seed: opciones', () => {
  it('reconoce las opciones y acepta el separador de pnpm', () => {
    expect(parseSeedArgs(['--', '--publish', '--demo-pricing'], 'development')).toEqual({
      publish: true,
      refresh: false,
      demoPricing: true,
      removeDemoPricing: false,
    });
    expect(parseSeedArgs(['--remove-demo-pricing'], 'production').removeDemoPricing).toBe(true);
  });

  it('producción rechaza --demo-pricing; opciones excluyentes y desconocidas fallan', () => {
    expect(() => parseSeedArgs(['--publish', '--demo-pricing'], 'production')).toThrow(/prohibido en producción/);
    expect(() => parseSeedArgs(['--demo-pricing', '--remove-demo-pricing'], 'development')).toThrow(/excluyentes/);
    expect(() => parseSeedArgs(['--demo-precios'], 'development')).toThrow(/desconocidas/);
  });

  it('describeError oculta la URL de conexión', () => {
    expect(describeError(new Error('fallo en postgresql://u:clave@host:5433/db'))).not.toContain('clave');
  });
});

describe('Generador de precios DEMO', () => {
  it('ids deterministas: reejecutar produce las mismas filas', () => {
    const tours = [{ id: 't1', slug: 'valle-sagrado', durationDays: 2 }];
    const a = generateDemoPricing(tours, { today: '2026-10-07', departureDays: 120, capacity: 12 });
    const b = generateDemoPricing(tours, { today: '2026-10-07', departureDays: 120, capacity: 12 });
    expect(a).toEqual(b);
    expect(a.rates).toHaveLength(16); // 2 monedas x 2 residencias x 4 tipos de pasajero
    expect(a.departures).toHaveLength(120);
    expect(a.departures[0]).toMatchObject({ id: demoDepartureId('valle-sagrado', '2026-10-07'), capacity: 12, departureDate: '2026-10-07' });
    expect(a.rates.map((r) => r.id)).toContain(demoRateId('valle-sagrado', 'USD', 'foreign', 'adult'));
    // Adulto extranjero USD: 99.00 por día x 2 días.
    expect(a.rates.find((r) => r.currency === 'USD' && r.residency === 'foreign' && r.paxType === 'adult')?.amount).toBe(19_800n);
  });
});
