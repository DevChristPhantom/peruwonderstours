import { InMemoryDataStore } from '../../../persistence/in-memory/in-memory-data-store.js';
import { InMemoryUnitOfWork } from '../../../persistence/in-memory/in-memory-unit-of-work.js';
import { AesGcmPiiCipher, DEVELOPMENT_PII_KEY_BASE64 } from '../../../shared/infrastructure/aes-gcm-pii-cipher.js';
import { FixedClock } from '../../../shared/infrastructure/system.js';
import type { ComplaintDraft } from '../domain/complaint.js';
import { ComplaintNotFoundError, ComplaintUseCases, type ComplaintSettings, type SubmitComplaintInput } from './complaint.use-cases.js';

const SETTINGS: ComplaintSettings = {
  provider: { legalName: 'Peru Wonders Tours E.I.R.L.', ruc: '20000000001', establishmentAddress: 'Jr. Lima 123, Puno', establishmentCode: 'WEB' },
  conformityTextVersion: 'conf-v1',
  privacyNoticeVersion: 'priv-v1',
  idempotencyTtlMinutes: 60,
};

const DRAFT: ComplaintDraft = {
  consumer: { fullName: '  Ana   Quispe ', docType: 'dni', docNumber: '45 678 912', address: 'Jr. Lima 123, Puno', phone: '+51 987 654 321', email: 'Ana@Example.com', isMinor: false },
  guardian: null,
  good: { type: 'service', description: 'Tour Uros y Taquile', claimedAmount: 45_000n, currency: 'PEN' },
  declaredType: null,
  detail: 'El tour no incluyó el almuerzo ofrecido.',
  consumerRequest: 'Devolución parcial.',
  responseChannel: 'email',
  conformityAccepted: true,
};

function setup() {
  const store = new InMemoryDataStore();
  const clock = new FixedClock(new Date('2026-10-07T15:00:00Z'));
  let n = 0;
  const ids = { next: () => `00000000-0000-7000-8000-${String(++n).padStart(12, '0')}` };
  const cipher = AesGcmPiiCipher.fromBase64(DEVELOPMENT_PII_KEY_BASE64);
  const useCases = new ComplaintUseCases(new InMemoryUnitOfWork(store), clock, ids, cipher, SETTINGS);
  const input = (key: string, extra: Partial<SubmitComplaintInput> = {}): SubmitComplaintInput => ({ draft: DRAFT, idempotencyKey: key, ip: '203.0.113.7', ...extra });
  return { store, clock, cipher, useCases, input };
}

describe('Libro de Reclamaciones: registro', () => {
  it('asigna correlativo anual sin huecos, congela proveedor, calcula 15 días hábiles y cifra PII', async () => {
    const { store, useCases, input } = setup();
    const first = await useCases.submit(input('complaint-key-0001'));
    const second = await useCases.submit(input('complaint-key-0002'));
    expect(first.complaint.code).toBe('LR-2026-000001');
    expect(second.complaint.code).toBe('LR-2026-000002');
    const c = first.complaint;
    expect(c).toMatchObject({
      status: 'received',
      channel: 'web',
      type: 'reclamo', // "no sé" => se tramita como reclamo
      declaredType: null,
      provider: SETTINGS.provider,
      conformityTextVersion: 'conf-v1',
      privacyNoticeVersion: 'priv-v1',
      ip: '203.0.113.7',
    });
    expect(c.consumer.fullName).toBe('Ana Quispe');
    expect(c.consumer.email).toBe('ana@example.com');
    expect(c.submittedAt.toISOString()).toBe('2026-10-07T15:00:00.000Z');
    expect(c.conformityAcceptedAt?.toISOString()).toBe('2026-10-07T15:00:00.000Z');
    // 2026-10-07 + 15 hábiles con feriado 8-oct => 29-oct, fin del día en Lima.
    expect(c.responseDueAt.toISOString()).toBe('2026-10-30T04:59:59.999Z');
    // PII cifrada en reposo.
    const stored = JSON.stringify([...store.state.complaints.values()], (_k, v: unknown) => (typeof v === 'bigint' ? v.toString() : v));
    expect(stored).not.toContain('45678912');
    expect(stored).not.toContain('987654321');
    // Outbox para el correo de constancia, sin PII.
    const events = [...store.state.outbox.values()];
    expect(events).toHaveLength(2);
    expect(events[0]).toMatchObject({ aggregateType: 'complaint', aggregateId: c.id, eventType: 'complaint.submitted' });
    expect(JSON.stringify(events[0]!.payload)).not.toContain('ana@example.com');
  });

  it('doble envío con la misma clave: una sola hoja y el mismo número (token rotado)', async () => {
    const { store, useCases, input } = setup();
    const [a, b] = await Promise.all([useCases.submit(input('complaint-key-0003')), useCases.submit(input('complaint-key-0003'))]);
    expect(a.complaint.code).toBe(b.complaint.code);
    expect([a.replayed, b.replayed].filter(Boolean)).toHaveLength(1);
    expect(store.state.complaints.size).toBe(1);
    expect(store.state.complaintSequences.get(2026)).toBe(1);
    const latest = a.replayed ? a : b;
    const earlier = a.replayed ? b : a;
    await expect(useCases.getByCode({ code: earlier.complaint.code, token: earlier.accessToken })).rejects.toBeInstanceOf(ComplaintNotFoundError);
    expect((await useCases.getByCode({ code: latest.complaint.code, token: latest.accessToken })).complaint.id).toBe(a.complaint.id);
    await expect(useCases.submit(input('complaint-key-0003', { draft: { ...DRAFT, detail: 'Otro detalle distinto del original.' } }))).rejects.toMatchObject({
      code: 'idempotency-key-reused',
    });
  });

  it('datos inválidos no consumen correlativo ni crean hoja', async () => {
    const { store, useCases, input } = setup();
    await expect(useCases.submit(input('complaint-key-0004', { draft: { ...DRAFT, consumer: { ...DRAFT.consumer, isMinor: true } } }))).rejects.toMatchObject({
      code: 'validation-failed',
      details: { errors: [{ field: 'guardian' }] },
    });
    await expect(useCases.submit(input('short'))).rejects.toMatchObject({ code: 'idempotency-key-required' });
    expect(store.state.complaints.size).toBe(0);
    expect(store.state.complaintSequences.size).toBe(0);
  });

  it('menor de edad: guarda representante con teléfono cifrado', async () => {
    const { useCases, input } = setup();
    const guardian = { fullName: 'Rosa Mamani', address: 'Jr. Lima 123, Puno', phone: '+51911111111', email: 'Rosa@Example.com' };
    const r = await useCases.submit(input('complaint-key-0005', { draft: { ...DRAFT, consumer: { ...DRAFT.consumer, isMinor: true }, guardian } }));
    const view = await useCases.getByCode({ code: r.complaint.code, token: r.accessToken });
    expect(view.complaint.guardian).toMatchObject({ fullName: 'Rosa Mamani', email: 'rosa@example.com' });
    expect(view.guardianPhone).toBe('+51911111111');
  });
});

describe('Libro de Reclamaciones: consulta con token', () => {
  it('devuelve la hoja descifrada a su titular; token ajeno o código inexistente => mismo 404', async () => {
    const { useCases, input } = setup();
    const r = await useCases.submit(input('complaint-key-0006'));
    const view = await useCases.getByCode({ code: r.complaint.code.toLowerCase(), token: r.accessToken });
    expect(view.consumerDocNumber).toBe('45678912');
    expect(view.consumerPhone).toBe('+51987654321');
    const other = await useCases.submit(input('complaint-key-0007'));
    const wrong = await useCases.getByCode({ code: r.complaint.code, token: other.accessToken }).catch((e: unknown) => e);
    const missing = await useCases.getByCode({ code: 'LR-2099-000001', token: r.accessToken }).catch((e: unknown) => e);
    for (const error of [wrong, missing]) {
      expect(error).toBeInstanceOf(ComplaintNotFoundError);
      expect(error).toMatchObject({ code: 'complaint-not-found', details: {} });
    }
    await expect(useCases.getByCode({ code: r.complaint.code, token: undefined })).rejects.toMatchObject({ code: 'complaint-token-required' });
  });
});

describe('AesGcmPiiCipher', () => {
  it('cifra con IV aleatorio, detecta manipulación y hashea de forma determinista', () => {
    const cipher = AesGcmPiiCipher.fromBase64(DEVELOPMENT_PII_KEY_BASE64);
    const a = cipher.encrypt('45678912');
    const b = cipher.encrypt('45678912');
    expect(Buffer.from(a).equals(Buffer.from(b))).toBe(false);
    expect(cipher.decrypt(a)).toBe('45678912');
    const tampered = Buffer.from(a);
    tampered[tampered.length - 1]! ^= 0xff;
    expect(() => cipher.decrypt(tampered)).toThrow();
    expect(Buffer.from(cipher.hash('dni:45678912')).equals(Buffer.from(cipher.hash('dni:45678912')))).toBe(true);
    expect(() => new AesGcmPiiCipher(Buffer.alloc(16))).toThrow();
  });
});
