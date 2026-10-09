import { COMPLAINT_LEGAL_NOTICES } from '../../complaints/domain/complaint.js';
import { signUnsubscribeToken, verifyUnsubscribeToken } from '../../privacy/domain/consent.js';
import {
  bookingCancelledEmail,
  complaintResponseEmail,
  complaintSettlementOfferEmail,
  complaintSheetDocument,
  escapeHtml,
  formatMoney,
  SETTLEMENT_ACCEPTANCE_PHRASE,
  type BookingMailData,
  type ComplaintMailData,
} from './templates.js';

const BRAND = { providerLegalName: 'PWT E.I.R.L.', providerRuc: '20000000001', contactEmail: 'r@pwt.test', contactPhone: '+51 1', publicWebBaseUrl: 'https://pwt.test' };

const COMPLAINT: ComplaintMailData = {
  code: 'LR-2026-000007',
  sheetNumber: '000000007-2026',
  submittedAt: new Date('2026-10-07T15:00:00Z'),
  responseDueAt: new Date('2026-10-30T04:59:59.999Z'),
  channel: 'backup_book',
  backupSheetNumber: 'F-0042',
  provider: { legalName: 'PWT E.I.R.L.', ruc: '20000000001', establishmentAddress: 'Jr. Lima 123, Puno', establishmentCode: 'PUNO' },
  consumer: { fullName: 'Ana "Q" <Quispe>', docType: 'dni', docNumber: '45678912', address: 'Puno', phone: '+51987654321', email: 'ana@example.com', isMinor: true },
  guardian: { fullName: 'Rosa Mamani', address: 'Puno', phone: '+51900000000', email: 'rosa@example.com' },
  good: { type: 'service', description: 'Tour', claimedAmount: { amount: 123_456n, currency: 'PEN' } },
  declaredType: 'queja',
  type: 'reclamo',
  detail: 'Detalle',
  consumerRequest: 'Pedido',
  responseChannel: 'email',
  legalNotices: COMPLAINT_LEGAL_NOTICES,
  consultUrl: 'https://pwt.test/es/libro-de-reclamaciones',
};

describe('Plantillas de correo', () => {
  it('formatea montos en céntimos y escapa HTML', () => {
    expect(formatMoney({ amount: 123_456n, currency: 'PEN' })).toBe('S/ 1,234.56');
    expect(formatMoney({ amount: 5n, currency: 'USD' })).toBe('US$ 0.05');
    expect(formatMoney({ amount: 100_000_000n, currency: 'USD' })).toBe('US$ 1,000,000.00');
    expect(escapeHtml(`<script>"x"&'y'</script>`)).toBe('&lt;script&gt;&quot;x&quot;&amp;&#39;y&#39;&lt;/script&gt;');
  });

  it('la hoja imprimible incluye los campos del Anexo I, el representante del menor, la reclasificación y las leyendas', () => {
    const html = complaintSheetDocument(COMPLAINT, BRAND);
    for (const expected of [
      '000000007-2026', 'LR-2026-000007', 'RUC 20000000001', 'Jr. Lima 123, Puno (código PUNO)', 'F-0042', 'DNI 45678912',
      'Rosa Mamani', 'S/ 1,234.56', 'Reclamo (declarado: Queja)', '7 de octubre de 2026 a las 10:00 (hora de Lima)', '29 de octubre de 2026',
      'no impide acudir a otras vías', 'improrrogable', 'Destinatario: consumidor',
    ]) {
      expect(html).toContain(expected);
    }
    expect(html).toContain('Ana &quot;Q&quot; &lt;Quispe&gt;');
    expect(html).not.toContain('<Quispe>');
  });

  it('respuesta y oferta de solución directa', () => {
    const response = complaintResponseEmail({ ...COMPLAINT, responseText: 'Devolveremos S/ 100.\nGracias.', respondedAt: new Date('2026-10-12T15:00:00Z') }, BRAND);
    expect(response.html).toContain('Devolveremos S/ 100.<br>Gracias.');
    expect(response.text).toContain('Fecha de la respuesta: 12 de octubre de 2026 a las 10:00 (hora de Lima)');
    const offer = complaintSettlementOfferEmail({ ...COMPLAINT, offerText: 'Cupón', expiresAt: new Date('2026-10-17T04:59:59.999Z') }, BRAND);
    expect(offer.text).toContain(SETTLEMENT_ACCEPTANCE_PHRASE);
    expect(offer.text).toContain('16 de octubre de 2026');
  });

  it('cancelación con y sin reembolso', () => {
    const base: BookingMailData = {
      code: 'PWT-2026-000001', customerName: 'Ana', status: 'cancelled', paymentOption: 'deposit',
      items: [{ title: 'Valle Sagrado', travelDate: '2026-11-10', paxCount: 2, subtotal: { amount: 24_000n, currency: 'USD' } }],
      total: { amount: 24_000n, currency: 'USD' }, paid: { amount: 12_000n, currency: 'USD' }, balance: { amount: 12_000n, currency: 'USD' },
      balanceDueAt: null, manageUrl: 'https://pwt.test/es/reserva/PWT-2026-000001',
    };
    expect(bookingCancelledEmail({ ...base, refundDue: { amount: 6_000n, currency: 'USD' }, reason: null }, BRAND).text).toContain('reembolso de US$ 60.00');
    expect(bookingCancelledEmail({ ...base, refundDue: { amount: 0n, currency: 'USD' }, reason: null }, BRAND).text).toContain('no genera reembolso');
    expect(bookingCancelledEmail({ ...base, refundDue: { amount: 0n, currency: 'USD' }, reason: null }, BRAND).text).toContain('martes, 10 de noviembre de 2026');
  });
});

describe('Token de baja de marketing', () => {
  const secret = 'unit-marketing-secret-0123456789-abcdef';
  const claims = { subjectHash: 'a'.repeat(64), purposes: ['marketing_email' as const], issuedAt: 1_700_000_000 };

  it('firma y verifica; rechaza firma, secreto o contenido alterados', () => {
    const token = signUnsubscribeToken(claims, secret);
    expect(verifyUnsubscribeToken(token, secret)).toEqual(claims);
    expect(verifyUnsubscribeToken(token, `${secret}x`)).toBeNull();
    const [body, sig] = token.split('.');
    const forged = Buffer.from(JSON.stringify({ v: 1, s: 'b'.repeat(64), p: ['marketing_email'], iat: 1 })).toString('base64url');
    expect(verifyUnsubscribeToken(`${forged}.${sig}`, secret)).toBeNull();
    expect(verifyUnsubscribeToken(`${body}`, secret)).toBeNull();
    expect(verifyUnsubscribeToken('x'.repeat(2000), secret)).toBeNull();
    const noPurposes = signUnsubscribeToken({ ...claims, purposes: [] }, secret);
    expect(verifyUnsubscribeToken(noPurposes, secret)).toBeNull();
  });
});
