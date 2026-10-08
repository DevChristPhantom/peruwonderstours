import { PERU_NATIONAL_HOLIDAYS } from '../infrastructure/peru-national-holidays.js';
import { addBusinessDays, complaintResponseDue, isBusinessDay, isWeekend } from './business-days.js';
import { assertComplaintRules, formatComplaintCode, formatSheetNumber, type ComplaintDraft } from './complaint.js';

const HOLIDAYS = new Set(PERU_NATIONAL_HOLIDAYS);
const NONE = new Set<string>();

describe('Días hábiles (15 días hábiles improrrogables, America/Lima)', () => {
  it('fines de semana y feriados no son hábiles', () => {
    expect(isWeekend('2026-10-10')).toBe(true); // sábado
    expect(isWeekend('2026-10-11')).toBe(true); // domingo
    expect(isWeekend('2026-10-12')).toBe(false); // lunes
    expect(isBusinessDay('2026-10-08', HOLIDAYS)).toBe(false); // Combate de Angamos (jueves)
    expect(isBusinessDay('2026-10-09', HOLIDAYS)).toBe(true);
  });

  it('cuenta desde el día siguiente y salta fines de semana', () => {
    // Lunes 2026-10-05 + 5 hábiles (sin feriados) = lunes 2026-10-12.
    expect(addBusinessDays('2026-10-05', 5, NONE)).toBe('2026-10-12');
    // Registro en sábado: el 1.er hábil es el lunes.
    expect(addBusinessDays('2026-10-10', 1, NONE)).toBe('2026-10-12');
    expect(() => addBusinessDays('2026-10-10', 0, NONE)).toThrow(RangeError);
  });

  it('excluye feriados del calendario', () => {
    // Miércoles 2026-10-07: sin feriados, 15 hábiles => miércoles 2026-10-28.
    expect(addBusinessDays('2026-10-07', 15, NONE)).toBe('2026-10-28');
    // Con el 8 de octubre feriado se corre un día => jueves 2026-10-29.
    expect(addBusinessDays('2026-10-07', 15, HOLIDAYS)).toBe('2026-10-29');
    // Semana Santa 2026 (jue 2 y vie 3 de abril) + fin de semana.
    expect(addBusinessDays('2026-04-01', 1, HOLIDAYS)).toBe('2026-04-06');
    // Fin de año: 24-dic (jue) + 1 hábil salta Navidad (vie) y el fin de semana.
    expect(addBusinessDays('2026-12-24', 1, HOLIDAYS)).toBe('2026-12-28');
  });

  it('vence al final del 15.º día hábil en hora de Lima (UTC-5) y usa la fecha de Lima del registro', () => {
    // 2026-10-08 03:00Z = 2026-10-07 22:00 en Lima: se cuenta desde el 7 (no desde el 8).
    const late = complaintResponseDue(new Date('2026-10-08T03:00:00Z'), HOLIDAYS);
    expect(late.dueDate).toBe('2026-10-29');
    expect(late.dueAt.toISOString()).toBe('2026-10-30T04:59:59.999Z');
    // 2026-10-08 06:00Z = 01:00 del 8 en Lima (feriado): se cuenta desde el 8.
    expect(complaintResponseDue(new Date('2026-10-08T06:00:00Z'), HOLIDAYS).dueDate).toBe('2026-10-29');
    expect(complaintResponseDue(new Date('2026-10-09T15:00:00Z'), HOLIDAYS).dueDate).toBe('2026-10-30');
  });
});

describe('Hoja de reclamación: formato y reglas', () => {
  const base: ComplaintDraft = {
    consumer: { fullName: 'Ana Quispe', docType: 'dni', docNumber: '45678912', address: 'Jr. Lima 123, Puno', phone: '+51987654321', email: 'ana@example.com', isMinor: false },
    guardian: null,
    good: { type: 'service', description: 'Tour Uros', claimedAmount: 45_000n, currency: 'PEN' },
    declaredType: 'reclamo',
    detail: 'El tour no incluyó el almuerzo ofrecido.',
    consumerRequest: 'Devolución parcial.',
    responseChannel: 'email',
    conformityAccepted: true,
  };
  const errorsOf = (draft: ComplaintDraft): string[] => {
    try {
      assertComplaintRules(draft);
      return [];
    } catch (error) {
      return ((error as { details: { errors: Array<{ field: string }> } }).details.errors ?? []).map((e) => e.field);
    }
  };

  it('formatea el código interno y el número de hoja del Anexo I', () => {
    expect(formatComplaintCode(2026, 45)).toBe('LR-2026-000045');
    expect(formatSheetNumber(2026, 45)).toBe('000000045-2026');
  });

  it('acepta una hoja válida', () => {
    expect(errorsOf(base)).toEqual([]);
    expect(errorsOf({ ...base, declaredType: null, good: { ...base.good, claimedAmount: null, currency: null } })).toEqual([]);
  });

  it('valida el documento según su tipo', () => {
    expect(errorsOf({ ...base, consumer: { ...base.consumer, docNumber: '1234567' } })).toEqual(['consumer.docNumber']);
    expect(errorsOf({ ...base, consumer: { ...base.consumer, docType: 'ce', docNumber: '001234567' } })).toEqual([]);
    expect(errorsOf({ ...base, consumer: { ...base.consumer, docType: 'passport', docNumber: 'AB12' } })).toEqual(['consumer.docNumber']);
  });

  it('menor de edad exige representante; un adulto no lo lleva', () => {
    expect(errorsOf({ ...base, consumer: { ...base.consumer, isMinor: true } })).toEqual(['guardian']);
    const guardian = { fullName: 'Rosa Mamani', address: 'Jr. Lima 123, Puno', phone: '+51911111111', email: 'rosa@example.com' };
    expect(errorsOf({ ...base, consumer: { ...base.consumer, isMinor: true }, guardian })).toEqual([]);
    expect(errorsOf({ ...base, guardian })).toEqual(['guardian']);
  });

  it('reclamo exige monto; monto y moneda van juntos; conformidad obligatoria', () => {
    expect(errorsOf({ ...base, good: { ...base.good, claimedAmount: null, currency: null } })).toEqual(['good.claimedAmount']);
    expect(errorsOf({ ...base, declaredType: 'queja', good: { ...base.good, currency: null } })).toEqual(['good.currency']);
    expect(errorsOf({ ...base, conformityAccepted: false })).toEqual(['conformityAccepted']);
    expect(errorsOf({ ...base, detail: '   ' })).toEqual(['detail']);
  });
});
