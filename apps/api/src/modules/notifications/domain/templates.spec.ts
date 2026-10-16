import { COMPLAINT_LEGAL_NOTICES } from '../../complaints/domain/complaint.js';
import { signUnsubscribeToken, verifyUnsubscribeToken } from '../../privacy/domain/consent.js';
import {
  balanceReminderEmail,
  complaintAccessLinkEmail,
  contactAcknowledgmentEmail,
  marketingConfirmationEmail,
  bookingAccessLinkEmail,
  bookingVoucherEmail,
  contactAgencyEmail,
  customerLoginLinkEmail,
  paymentReceivedEmail,
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

describe('Plantillas en inglés y enlaces mágicos (Sprint 3)', () => {
  const data = {
    code: 'PWT-2026-000009',
    customerName: 'Sam',
    status: 'partially_paid',
    paymentOption: 'deposit' as const,
    items: [{ title: 'Sacred Valley', travelDate: '2026-11-10', paxCount: 2, subtotal: { amount: 20_000n, currency: 'USD' as const } }],
    total: { amount: 20_000n, currency: 'USD' as const },
    paid: { amount: 10_000n, currency: 'USD' as const },
    balance: { amount: 10_000n, currency: 'USD' as const },
    balanceDueAt: new Date('2026-11-03T05:00:00Z'),
    manageUrl: 'https://pwt.test/en/reserva/acceso?token=abc',
    linkTtlHours: 72,
    locale: 'en' as const,
  };

  it('voucher, recordatorio y pago recibido en inglés con el enlace de un solo uso', () => {
    const voucher = bookingVoucherEmail(data, BRAND, 'confirmation');
    expect(voucher.subject).toBe('Booking confirmed PWT-2026-000009 · peruwonderstours');
    expect(voucher.html).toContain('<html lang="en">');
    expect(voucher.text).toContain('View my booking: https://pwt.test/en/reserva/acceso?token=abc');
    expect(voucher.text).toContain('Tuesday, November 10, 2026');
    expect(voucher.html).toContain('single-use link valid for 72 hours');
    expect(balanceReminderEmail(data, BRAND, 2).text).toContain('Less than 2 days left!');
    expect(paymentReceivedEmail({ ...data, payment: { amount: 10_000n, currency: 'USD' } }, BRAND).subject).toBe('Payment received · booking PWT-2026-000009');
    expect(bookingVoucherEmail({ ...data, locale: 'es' }, BRAND, 'voucher').subject).toBe('Voucher de tu reserva PWT-2026-000009');
  });

  it('enlace de acceso, login de cliente y contacto', () => {
    const access = bookingAccessLinkEmail({ code: data.code, customerName: 'Sam', linkUrl: 'https://pwt.test/en/reserva/acceso?token=t', ttlMinutes: 30, locale: 'en' }, BRAND);
    expect(access.text).toContain('expires in 30 minutes');
    expect(customerLoginLinkEmail({ firstName: 'Ana', linkUrl: 'https://x/es/cuenta/acceso?token=t', ttlMinutes: 30, locale: 'es' }, BRAND).text).toContain('vence en 30 minutos');
    const agency = contactAgencyEmail({ id: 'm1', name: '<Leo>', email: 'leo@x.com', phone: null, subject: 'Hola', message: 'Linea 1\nLinea 2', tourSlug: null, locale: 'en', receivedAt: new Date('2026-10-09T15:00:00Z') }, BRAND);
    expect(agency.html).toContain('&lt;Leo&gt;');
    expect(agency.html).toContain('Linea 1<br>Linea 2');
  });
});

describe('Correios transacionais em Português Brasil', () => {
  const data: BookingMailData = {
    code: 'PWT-2026-000010', customerName: 'João <Silva>', status: 'paid', paymentOption: 'full',
    items: [{ title: 'Vale Sagrado', travelDate: '2026-11-10', paxCount: 2, subtotal: { amount: 20000n, currency: 'PEN' } }],
    total: { amount: 20000n, currency: 'PEN' }, paid: { amount: 20000n, currency: 'PEN' }, balance: { amount: 0n, currency: 'PEN' },
    balanceDueAt: null, manageUrl: 'https://pwt.test/pt/reserva/acesso?token=abc', locale: 'pt',
  };
  it('renders voucher, money, dates, safety and legal links explicitly in Portuguese', () => {
    const mail = bookingVoucherEmail(data, BRAND, 'confirmation');
    expect(mail.html).toContain('<html lang="pt-BR">');
    expect(mail.html).toContain('João &lt;Silva&gt;');
    expect(mail.text).toContain('Ver minha reserva: https://pwt.test/pt/reserva/acesso?token=abc');
    expect(mail.text).toContain('novembro');
    expect(mail.text).toContain('S/ 200.00');
    expect(mail.html).toContain('/pt/livro-de-reclamacoes');
    expect(mail.html).toContain('/pt/politicas/protecao-de-dados-pessoais');
    expect(mail.text).not.toContain('/es/');
    expect(paymentReceivedEmail({ ...data, payment: data.paid }, BRAND).subject).toContain('Pagamento recebido');
    expect(bookingCancelledEmail({ ...data, refundDue: data.paid, reason: null }, BRAND).text).toContain('política de cancelamento');
  });
  it('renders personal access, complaint access, contact and marketing without Spanish fallback', () => {
    const access = bookingAccessLinkEmail({ code: data.code, customerName: 'João', linkUrl: data.manageUrl, ttlMinutes: 30, locale: 'pt' }, BRAND);
    expect(access.text).toContain('uso único e expira em 30 minutos');
    const customer = customerLoginLinkEmail({ firstName: 'João', linkUrl: 'https://pwt.test/pt/conta/acesso?token=t', ttlMinutes: 30, locale: 'pt' }, BRAND);
    expect(customer.text).toContain('Minhas reservas');
    const complaint = complaintAccessLinkEmail({ code: 'LR-2026-000010', consumerName: 'João', linkUrl: 'https://pwt.test/pt/livro-de-reclamacoes/consulta?token=t', ttlMinutes: 30, locale: 'pt' }, BRAND);
    expect(complaint.html).toContain('Consultar minha reclamação');
    expect(complaint.text).toContain('/pt/livro-de-reclamacoes/consulta?token=t');
    expect(complaint.text).not.toContain('/pt/libro-de-reclamaciones');
    expect(complaint.subject).toContain('sua reclamação');
    expect(contactAcknowledgmentEmail({ name: 'João', subject: 'Passeio', locale: 'pt' }, BRAND).subject).toContain('Recebemos sua mensagem');
    const marketing = marketingConfirmationEmail({ firstName: 'João', purposes: ['marketing_email'], confirmUrl: 'https://pwt.test/pt/privacidade/confirmar?token=t', locale: 'pt' }, BRAND);
    expect(marketing.html).toContain('Só enviaremos ofertas se você confirmar');
    expect(marketing.text).toContain('/pt/privacidade/confirmar?token=t');
  });
});
