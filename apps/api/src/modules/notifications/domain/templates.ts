/**
 * Plantillas de correo transaccional en español (es-PE): HTML (tablas + estilos en línea,
 * compatibles con clientes de correo) y texto plano. Funciones puras: todo dato variable se
 * escapa. Fechas en America/Lima; montos en céntimos -> "S/ 1,234.50" / "US$ 1,234.50".
 */

export interface RenderedEmail {
  subject: string;
  html: string;
  text: string;
}

export interface BrandInfo {
  providerLegalName: string;
  providerRuc: string;
  contactEmail: string;
  contactPhone: string;
  publicWebBaseUrl: string;
}

export interface MoneyView {
  amount: bigint;
  currency: 'PEN' | 'USD';
}

const LIMA = 'America/Lima';

export function escapeHtml(value: string | number | null | undefined): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** Texto multilínea escapado con saltos <br>. */
function multiline(value: string): string {
  return escapeHtml(value).replace(/\r?\n/g, '<br>');
}

export function formatMoney(m: MoneyView): string {
  const negative = m.amount < 0n;
  const abs = negative ? -m.amount : m.amount;
  const units = (abs / 100n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  const cents = (abs % 100n).toString().padStart(2, '0');
  return `${negative ? '-' : ''}${m.currency === 'PEN' ? 'S/' : 'US$'} ${units}.${cents}`;
}

export type MailLocale = 'es' | 'en';

const INTL: Record<MailLocale, string> = { es: 'es-PE', en: 'en-US' };

export function formatLimaDateTime(date: Date, locale: MailLocale = 'es'): string {
  const text = new Intl.DateTimeFormat(INTL[locale], { timeZone: LIMA, day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false }).format(date);
  return locale === 'en' ? `${text} (Lima time)` : `${text} (hora de Lima)`;
}

export function formatLimaDate(date: Date, locale: MailLocale = 'es'): string {
  return new Intl.DateTimeFormat(INTL[locale], { timeZone: LIMA, weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(date);
}

/** Fecha de calendario YYYY-MM-DD (sin zona) en texto largo. */
export function formatCalendarDate(date: string, locale: MailLocale = 'es'): string {
  return formatLimaDate(new Date(`${date}T17:00:00Z`), locale);
}

const FOOTER: Record<MailLocale, { support: string; complaints: string; privacy: string }> = {
  es: { support: 'Atención', complaints: 'Libro de Reclamaciones', privacy: 'Política de privacidad' },
  en: { support: 'Customer care', complaints: 'Complaints Book (Libro de Reclamaciones)', privacy: 'Privacy policy' },
};

function layout(params: { title: string; preheader: string; bodyHtml: string; brand: BrandInfo; footerExtraHtml?: string; locale?: MailLocale }): string {
  const { brand } = params;
  const locale = params.locale ?? 'es';
  const f = FOOTER[locale];
  return `<!doctype html>
<html lang="${locale}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(params.title)}</title></head>
<body style="margin:0;padding:0;background:#f4f1ea;font-family:Arial,Helvetica,sans-serif;color:#1f2933">
<span style="display:none;max-height:0;overflow:hidden">${escapeHtml(params.preheader)}</span>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f1ea"><tr><td align="center" style="padding:24px 12px">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#ffffff;border-radius:8px">
<tr><td style="background:#7a2e1d;color:#ffffff;padding:20px 24px;border-radius:8px 8px 0 0;font-size:20px;font-weight:bold">peruwonderstours</td></tr>
<tr><td style="padding:24px;font-size:15px;line-height:1.55">
<h1 style="font-size:20px;margin:0 0 16px">${escapeHtml(params.title)}</h1>
${params.bodyHtml}
</td></tr>
<tr><td style="padding:16px 24px;border-top:1px solid #e5e0d5;font-size:12px;color:#5f6b76;line-height:1.5">
${escapeHtml(brand.providerLegalName)} · RUC ${escapeHtml(brand.providerRuc)}<br>
${f.support}: <a href="mailto:${escapeHtml(brand.contactEmail)}" style="color:#7a2e1d">${escapeHtml(brand.contactEmail)}</a> · ${escapeHtml(brand.contactPhone)}<br>
<a href="${escapeHtml(brand.publicWebBaseUrl)}/es/libro-de-reclamaciones" style="color:#7a2e1d">${f.complaints}</a> ·
<a href="${escapeHtml(brand.publicWebBaseUrl)}/es/politicas/proteccion-de-datos-personales" style="color:#7a2e1d">${f.privacy}</a>
${params.footerExtraHtml ?? ''}
</td></tr></table></td></tr></table></body></html>`;
}

function textFooter(brand: BrandInfo, extra?: string, locale: MailLocale = 'es'): string {
  const f = FOOTER[locale];
  return [
    '--',
    `${brand.providerLegalName} · RUC ${brand.providerRuc}`,
    `${f.support}: ${brand.contactEmail} · ${brand.contactPhone}`,
    `${f.complaints}: ${brand.publicWebBaseUrl}/es/libro-de-reclamaciones`,
    `${f.privacy}: ${brand.publicWebBaseUrl}/es/politicas/proteccion-de-datos-personales`,
    ...(extra ? [extra] : []),
  ].join('\n');
}

function button(url: string, label: string): string {
  return `<p><a href="${escapeHtml(url)}" style="display:inline-block;background:#7a2e1d;color:#fff;padding:10px 18px;border-radius:6px;text-decoration:none">${escapeHtml(label)}</a></p>`;
}

function rows(pairs: Array<[string, string | null | undefined]>): string {
  return `<table role="presentation" width="100%" cellpadding="6" cellspacing="0" style="border-collapse:collapse;font-size:14px;margin:8px 0 16px">${pairs
    .filter(([, v]) => v !== null && v !== undefined && v !== '')
    .map(([k, v]) => `<tr><td style="border-bottom:1px solid #eee;color:#5f6b76;width:42%;vertical-align:top">${escapeHtml(k)}</td><td style="border-bottom:1px solid #eee;vertical-align:top">${multiline(v ?? '')}</td></tr>`)
    .join('')}</table>`;
}

function textRows(pairs: Array<[string, string | null | undefined]>): string {
  return pairs.filter(([, v]) => v !== null && v !== undefined && v !== '').map(([k, v]) => `${k}: ${v}`).join('\n');
}

// =============================================================================
// Reservas (es / en según bookings.locale)
// =============================================================================
export interface BookingMailData {
  code: string;
  customerName: string;
  status: string;
  paymentOption: 'deposit' | 'full';
  items: Array<{ title: string; travelDate: string; paxCount: number; subtotal: MoneyView }>;
  total: MoneyView;
  paid: MoneyView;
  balance: MoneyView;
  balanceDueAt: Date | null;
  /** Enlace mágico de un solo uso (F0): `/{locale}/reserva/acceso?token=` generado al enviar. */
  manageUrl: string;
  /** Horas de vigencia del enlace (texto del correo). */
  linkTtlHours?: number;
  unsubscribeUrl?: string | null;
  locale?: MailLocale;
}

const B = {
  es: {
    service: 'Servicio', date: 'Fecha', pax: 'Pax', subtotal: 'Subtotal', code: 'Código de reserva', total: 'Total', paid: 'Pagado',
    balance: 'Saldo pendiente', noBalance: 'Sin saldo pendiente', balanceDue: 'Vence el saldo', view: 'Ver mi reserva', payBalance: 'Pagar el saldo',
    voucher: 'VOUCHER', unsubscribeQ: '¿No quieres recibir ofertas?', unsubscribe: 'Darte de baja de las comunicaciones comerciales',
    linkNote: (h: number) => `El botón es un enlace personal de un solo uso válido por ${h} horas: no lo reenvíes. Si venció, pide uno nuevo en la web con tu código de reserva y tu correo.`,
    confirmedTitle: (c: string) => `Reserva confirmada ${c}`,
    voucherTitle: (c: string) => `Tu voucher de la reserva ${c}`,
    confirmedIntro: (n: string) => `Hola ${n}, recibimos tu pago y tu reserva está confirmada. Este correo es tu voucher: preséntalo (impreso o en el celular) el día del servicio.`,
    voucherIntro: (n: string) => `Hola ${n}, te reenviamos el voucher de tu reserva. Preséntalo (impreso o en el celular) el día del servicio.`,
    payBefore: 'Recuerda pagar el saldo antes de la fecha indicada para mantener tu reserva.',
    confirmedSubject: (c: string) => `Reserva confirmada ${c} · peruwonderstours`,
    voucherSubject: (c: string) => `Voucher de tu reserva ${c}`,
    paymentTitle: (c: string) => `Pago recibido · ${c}`,
    paymentIntro: (n: string, a: string) => `Hola ${n}, registramos tu pago de ${a}.`,
    fullyPaid: 'Tu reserva está pagada al 100 %. ¡Te esperamos!',
    paymentSubject: (c: string) => `Pago recibido · reserva ${c}`,
    reminderTitle: (c: string) => `Recordatorio: saldo de tu reserva ${c}`,
    reminderIntro: (n: string, a: string, due: string, urgent: boolean) =>
      `Hola ${n}, te recordamos que el saldo de tu reserva (${a}) vence el ${due}${urgent ? '. ¡Quedan menos de 2 días!' : '.'}`,
    reminderDueFallback: 'la fecha indicada en tu reserva',
    reminderNote: 'Si ya pagaste, ignora este mensaje. También puedes pagar en efectivo o por transferencia coordinando con nosotros.',
    reminderSubject: (c: string) => `Recordatorio de saldo · reserva ${c}`,
    cancelledTitle: (c: string) => `Reserva cancelada ${c}`,
    cancelledIntro: (n: string, c: string) => `Hola ${n}, tu reserva ${c} fue cancelada.`,
    refundYes: (a: string) => `Según nuestra política de cancelación te corresponde un reembolso de ${a}. Te contactaremos para coordinarlo por el mismo medio de pago.`,
    refundNo: 'Según nuestra política de cancelación, esta cancelación no genera reembolso.',
    refund: 'Reembolso',
    cancelledNote: 'Si no solicitaste esta cancelación o no estás de acuerdo, responde a este correo o registra tu reclamo en nuestro Libro de Reclamaciones.',
    cancelledSubject: (c: string) => `Cancelación de tu reserva ${c}`,
    accessTitle: (c: string) => `Acceso a tu reserva ${c}`,
    accessIntro: (n: string) => `Hola ${n}, recibimos una solicitud para ver tu reserva. Usa este botón para abrirla:`,
    accessNote: (m: number) => `El enlace es de un solo uso y vence en ${m} minutos. Si no fuiste tú, ignora este correo: nadie puede ver tu reserva sin este enlace.`,
    accessCta: 'Abrir mi reserva',
    accessSubject: (c: string) => `Tu enlace de acceso a la reserva ${c}`,
  },
  en: {
    service: 'Service', date: 'Date', pax: 'Pax', subtotal: 'Subtotal', code: 'Booking code', total: 'Total', paid: 'Paid',
    balance: 'Balance due', noBalance: 'No balance due', balanceDue: 'Balance due by', view: 'View my booking', payBalance: 'Pay the balance',
    voucher: 'VOUCHER', unsubscribeQ: "Don't want to receive offers?", unsubscribe: 'Unsubscribe from marketing emails',
    linkNote: (h: number) => `The button is a personal, single-use link valid for ${h} hours: please do not forward it. If it has expired, request a new one on our website with your booking code and email.`,
    confirmedTitle: (c: string) => `Booking confirmed ${c}`,
    voucherTitle: (c: string) => `Your voucher for booking ${c}`,
    confirmedIntro: (n: string) => `Hi ${n}, we received your payment and your booking is confirmed. This email is your voucher: show it (printed or on your phone) on the day of the service.`,
    voucherIntro: (n: string) => `Hi ${n}, here is your booking voucher again. Show it (printed or on your phone) on the day of the service.`,
    payBefore: 'Please pay the balance before the date shown to keep your booking.',
    confirmedSubject: (c: string) => `Booking confirmed ${c} · peruwonderstours`,
    voucherSubject: (c: string) => `Voucher for your booking ${c}`,
    paymentTitle: (c: string) => `Payment received · ${c}`,
    paymentIntro: (n: string, a: string) => `Hi ${n}, we have recorded your payment of ${a}.`,
    fullyPaid: 'Your booking is fully paid. See you soon!',
    paymentSubject: (c: string) => `Payment received · booking ${c}`,
    reminderTitle: (c: string) => `Reminder: balance for booking ${c}`,
    reminderIntro: (n: string, a: string, due: string, urgent: boolean) =>
      `Hi ${n}, this is a reminder that the balance of your booking (${a}) is due on ${due}${urgent ? '. Less than 2 days left!' : '.'}`,
    reminderDueFallback: 'the date shown in your booking',
    reminderNote: 'If you have already paid, please ignore this message. You can also pay in cash or by bank transfer by contacting us.',
    reminderSubject: (c: string) => `Balance reminder · booking ${c}`,
    cancelledTitle: (c: string) => `Booking cancelled ${c}`,
    cancelledIntro: (n: string, c: string) => `Hi ${n}, your booking ${c} has been cancelled.`,
    refundYes: (a: string) => `Under our cancellation policy you are entitled to a refund of ${a}. We will contact you to arrange it through the same payment method.`,
    refundNo: 'Under our cancellation policy, this cancellation is not eligible for a refund.',
    refund: 'Refund',
    cancelledNote: 'If you did not request this cancellation or disagree with it, reply to this email or file a claim in our Complaints Book.',
    cancelledSubject: (c: string) => `Cancellation of your booking ${c}`,
    accessTitle: (c: string) => `Access to your booking ${c}`,
    accessIntro: (n: string) => `Hi ${n}, we received a request to view your booking. Use this button to open it:`,
    accessNote: (m: number) => `This link can be used once and expires in ${m} minutes. If it was not you, ignore this email: nobody can see your booking without this link.`,
    accessCta: 'Open my booking',
    accessSubject: (c: string) => `Your access link for booking ${c}`,
  },
} as const;

function itemsHtml(items: BookingMailData['items'], locale: MailLocale = 'es'): string {
  const t = B[locale];
  return `<table role="presentation" width="100%" cellpadding="6" cellspacing="0" style="border-collapse:collapse;font-size:14px;margin:8px 0 16px">
<tr style="background:#f4f1ea"><th align="left">${t.service}</th><th align="left">${t.date}</th><th align="right">${t.pax}</th><th align="right">${t.subtotal}</th></tr>
${items
  .map(
    (i) =>
      `<tr><td style="border-bottom:1px solid #eee">${escapeHtml(i.title)}</td><td style="border-bottom:1px solid #eee">${escapeHtml(formatCalendarDate(i.travelDate, locale))}</td><td align="right" style="border-bottom:1px solid #eee">${i.paxCount}</td><td align="right" style="border-bottom:1px solid #eee">${escapeHtml(formatMoney(i.subtotal))}</td></tr>`,
  )
  .join('')}</table>`;
}

function itemsText(items: BookingMailData['items'], locale: MailLocale = 'es'): string {
  return items.map((i) => `- ${i.title} · ${formatCalendarDate(i.travelDate, locale)} · ${i.paxCount} pax · ${formatMoney(i.subtotal)}`).join('\n');
}

function amountsPairs(d: BookingMailData): Array<[string, string | null]> {
  const locale = d.locale ?? 'es';
  const t = B[locale];
  return [
    [t.code, d.code],
    [t.total, formatMoney(d.total)],
    [t.paid, formatMoney(d.paid)],
    [t.balance, d.balance.amount > 0n ? formatMoney(d.balance) : t.noBalance],
    [t.balanceDue, d.balance.amount > 0n && d.balanceDueAt ? formatLimaDateTime(d.balanceDueAt, locale) : null],
  ];
}

function unsubscribeFooter(d: BookingMailData): { html: string; text: string } {
  if (!d.unsubscribeUrl) return { html: '', text: '' };
  const t = B[d.locale ?? 'es'];
  return {
    html: `<br>${t.unsubscribeQ} <a href="${escapeHtml(d.unsubscribeUrl)}" style="color:#7a2e1d">${t.unsubscribe}</a>.`,
    text: `${t.unsubscribe}: ${d.unsubscribeUrl}`,
  };
}

function linkNote(d: BookingMailData): string {
  return `<p style="font-size:13px;color:#5f6b76">${escapeHtml(B[d.locale ?? 'es'].linkNote(d.linkTtlHours ?? 72))}</p>`;
}

/** Confirmación de reserva (primer cobro) o reenvío del voucher. */
export function bookingVoucherEmail(d: BookingMailData, brand: BrandInfo, kind: 'confirmation' | 'voucher'): RenderedEmail {
  const locale = d.locale ?? 'es';
  const t = B[locale];
  const title = kind === 'confirmation' ? t.confirmedTitle(d.code) : t.voucherTitle(d.code);
  const intro = kind === 'confirmation' ? t.confirmedIntro(d.customerName) : t.voucherIntro(d.customerName);
  const unsub = unsubscribeFooter(d);
  const html = layout({
    title,
    locale,
    preheader: `${d.code} · ${formatMoney(d.total)}`,
    brand,
    bodyHtml: `<p>${escapeHtml(intro)}</p>
<div style="border:2px dashed #7a2e1d;border-radius:8px;padding:12px 16px;margin:16px 0">
<p style="margin:0 0 4px;font-size:13px;color:#5f6b76">${t.voucher}</p>
<p style="margin:0;font-size:22px;font-weight:bold;letter-spacing:1px">${escapeHtml(d.code)}</p></div>
${itemsHtml(d.items, locale)}
${rows(amountsPairs(d))}
${d.balance.amount > 0n ? `<p>${escapeHtml(t.payBefore)}</p>` : ''}
${button(d.manageUrl, t.view)}
${linkNote(d)}`,
    footerExtraHtml: unsub.html,
  });
  const text = [title, '', intro, '', `${t.voucher}: ${d.code}`, itemsText(d.items, locale), '', textRows(amountsPairs(d)), '', `${t.view}: ${d.manageUrl}`, '', textFooter(brand, unsub.text || undefined, locale)].join('\n');
  return { subject: kind === 'confirmation' ? t.confirmedSubject(d.code) : t.voucherSubject(d.code), html, text };
}

export function paymentReceivedEmail(d: BookingMailData & { payment: MoneyView }, brand: BrandInfo): RenderedEmail {
  const locale = d.locale ?? 'es';
  const t = B[locale];
  const title = t.paymentTitle(d.code);
  const intro = t.paymentIntro(d.customerName, formatMoney(d.payment));
  const unsub = unsubscribeFooter(d);
  const html = layout({
    title,
    locale,
    preheader: intro,
    brand,
    bodyHtml: `<p>${escapeHtml(intro)}</p>${rows(amountsPairs(d))}${d.balance.amount === 0n ? `<p>${escapeHtml(t.fullyPaid)}</p>` : ''}${button(d.manageUrl, t.view)}${linkNote(d)}`,
    footerExtraHtml: unsub.html,
  });
  const text = [title, '', intro, '', textRows(amountsPairs(d)), '', `${t.view}: ${d.manageUrl}`, '', textFooter(brand, unsub.text || undefined, locale)].join('\n');
  return { subject: t.paymentSubject(d.code), html, text };
}

export function balanceReminderEmail(d: BookingMailData, brand: BrandInfo, daysBefore: number): RenderedEmail {
  const locale = d.locale ?? 'es';
  const t = B[locale];
  const due = d.balanceDueAt ? formatLimaDateTime(d.balanceDueAt, locale) : t.reminderDueFallback;
  const title = t.reminderTitle(d.code);
  const intro = t.reminderIntro(d.customerName, formatMoney(d.balance), due, daysBefore <= 2);
  const html = layout({
    title,
    locale,
    preheader: intro,
    brand,
    bodyHtml: `<p>${escapeHtml(intro)}</p>${itemsHtml(d.items, locale)}${rows(amountsPairs(d))}
${button(d.manageUrl, t.payBalance)}
${linkNote(d)}
<p style="font-size:13px;color:#5f6b76">${escapeHtml(t.reminderNote)}</p>`,
  });
  const text = [title, '', intro, '', itemsText(d.items, locale), '', textRows(amountsPairs(d)), '', `${t.payBalance}: ${d.manageUrl}`, '', textFooter(brand, undefined, locale)].join('\n');
  return { subject: t.reminderSubject(d.code), html, text };
}

export function bookingCancelledEmail(d: BookingMailData & { refundDue: MoneyView; reason: string | null }, brand: BrandInfo): RenderedEmail {
  const locale = d.locale ?? 'es';
  const t = B[locale];
  const title = t.cancelledTitle(d.code);
  const intro = t.cancelledIntro(d.customerName, d.code);
  const refund = d.refundDue.amount > 0n ? t.refundYes(formatMoney(d.refundDue)) : t.refundNo;
  const html = layout({
    title,
    locale,
    preheader: intro,
    brand,
    bodyHtml: `<p>${escapeHtml(intro)}</p>${itemsHtml(d.items, locale)}${rows([
      [t.code, d.code],
      [t.paid, formatMoney(d.paid)],
      [t.refund, formatMoney(d.refundDue)],
    ])}<p>${escapeHtml(refund)}</p>
<p style="font-size:13px;color:#5f6b76">${escapeHtml(t.cancelledNote)}</p>`,
  });
  const text = [title, '', intro, '', itemsText(d.items, locale), '', `${t.paid}: ${formatMoney(d.paid)}`, `${t.refund}: ${formatMoney(d.refundDue)}`, '', refund, '', textFooter(brand, undefined, locale)].join('\n');
  return { subject: t.cancelledSubject(d.code), html, text };
}

/** F0b: enlace mágico pedido desde "recuperar mi reserva" (código + correo). */
export function bookingAccessLinkEmail(d: { code: string; customerName: string; linkUrl: string; ttlMinutes: number; locale: MailLocale }, brand: BrandInfo): RenderedEmail {
  const t = B[d.locale];
  const title = t.accessTitle(d.code);
  const intro = t.accessIntro(d.customerName);
  const note = t.accessNote(d.ttlMinutes);
  const html = layout({ title, locale: d.locale, preheader: title, brand, bodyHtml: `<p>${escapeHtml(intro)}</p>${button(d.linkUrl, t.accessCta)}<p style="font-size:13px;color:#5f6b76">${escapeHtml(note)}</p>` });
  const text = [title, '', intro, d.linkUrl, '', note, '', textFooter(brand, undefined, d.locale)].join('\n');
  return { subject: t.accessSubject(d.code), html, text };
}

// =============================================================================
// Cuenta de cliente sin contraseña (F6) y contacto (F3)
// =============================================================================
const C = {
  es: {
    loginTitle: 'Tu enlace para entrar a "Mis reservas"',
    loginIntro: (n: string) => `Hola ${n}, usa este botón para ver tus reservas en peruwonderstours. No necesitas contraseña.`,
    loginCta: 'Entrar a Mis reservas',
    loginNote: (m: number) => `El enlace es de un solo uso y vence en ${m} minutos. Si no lo pediste, ignora este correo.`,
    ackTitle: 'Recibimos tu mensaje',
    ackIntro: (n: string) => `Hola ${n}, gracias por escribirnos. Te responderemos lo antes posible (normalmente en menos de 24 horas hábiles).`,
    ackSubjectLabel: 'Asunto',
    ackSubject: 'Recibimos tu mensaje · peruwonderstours',
    ackNote: 'Este es un acuse automático: no incluye tu mensaje completo por seguridad. Si no nos escribiste, ignora este correo.',
  },
  en: {
    loginTitle: 'Your link to "My bookings"',
    loginIntro: (n: string) => `Hi ${n}, use this button to see your bookings with peruwonderstours. No password needed.`,
    loginCta: 'Open My bookings',
    loginNote: (m: number) => `This link can be used once and expires in ${m} minutes. If you did not request it, ignore this email.`,
    ackTitle: 'We received your message',
    ackIntro: (n: string) => `Hi ${n}, thank you for contacting us. We will reply as soon as possible (usually within 24 business hours).`,
    ackSubjectLabel: 'Subject',
    ackSubject: 'We received your message · peruwonderstours',
    ackNote: 'This is an automatic acknowledgment: it does not include your full message for security reasons. If you did not contact us, ignore this email.',
  },
} as const;

export function customerLoginLinkEmail(d: { firstName: string; linkUrl: string; ttlMinutes: number; locale: MailLocale }, brand: BrandInfo): RenderedEmail {
  const t = C[d.locale];
  const intro = t.loginIntro(d.firstName);
  const note = t.loginNote(d.ttlMinutes);
  const html = layout({ title: t.loginTitle, locale: d.locale, preheader: t.loginTitle, brand, bodyHtml: `<p>${escapeHtml(intro)}</p>${button(d.linkUrl, t.loginCta)}<p style="font-size:13px;color:#5f6b76">${escapeHtml(note)}</p>` });
  const text = [t.loginTitle, '', intro, d.linkUrl, '', note, '', textFooter(brand, undefined, d.locale)].join('\n');
  return { subject: `${t.loginTitle} · peruwonderstours`, html, text };
}

export function contactAcknowledgmentEmail(d: { name: string; subject: string; locale: MailLocale }, brand: BrandInfo): RenderedEmail {
  const t = C[d.locale];
  const intro = t.ackIntro(d.name);
  const html = layout({ title: t.ackTitle, locale: d.locale, preheader: intro, brand, bodyHtml: `<p>${escapeHtml(intro)}</p>${rows([[t.ackSubjectLabel, d.subject]])}<p style="font-size:13px;color:#5f6b76">${escapeHtml(t.ackNote)}</p>` });
  const text = [t.ackTitle, '', intro, `${t.ackSubjectLabel}: ${d.subject}`, '', t.ackNote, '', textFooter(brand, undefined, d.locale)].join('\n');
  return { subject: t.ackSubject, html, text };
}

/** Aviso interno a la bandeja de la agencia (siempre en español). */
export function contactAgencyEmail(
  d: { id: string; name: string; email: string; phone: string | null; subject: string; message: string; tourSlug: string | null; locale: MailLocale; receivedAt: Date },
  brand: BrandInfo,
): RenderedEmail {
  const title = `Nuevo mensaje de contacto: ${d.subject}`;
  const pairs: Array<[string, string | null]> = [
    ['Nombre', d.name],
    ['Correo', d.email],
    ['Teléfono', d.phone],
    ['Tour de interés', d.tourSlug],
    ['Idioma', d.locale === 'en' ? 'Inglés' : 'Español'],
    ['Recibido', formatLimaDateTime(d.receivedAt)],
    ['Referencia', d.id],
  ];
  const html = layout({
    title,
    preheader: `${d.name} · ${d.subject}`,
    brand,
    bodyHtml: `${rows(pairs)}<div style="background:#f4f1ea;border-radius:6px;padding:12px 16px">${multiline(d.message)}</div>
<p style="font-size:13px;color:#5f6b76">Responde directamente a este correo (Reply-To del cliente) y marca el mensaje como respondido en el panel.</p>`,
  });
  const text = [title, '', textRows(pairs), '', d.message, '', textFooter(brand)].join('\n');
  return { subject: `[Contacto web] ${d.subject}`.slice(0, 200), html, text };
}

// =============================================================================
// Protección de datos: doble opt-in de marketing (H-05)
// =============================================================================
const PURPOSE_LABEL: Record<string, string> = { marketing_email: 'ofertas y novedades por correo electrónico', marketing_whatsapp: 'ofertas y novedades por WhatsApp/SMS' };

export function marketingConfirmationEmail(d: { firstName: string; purposes: string[]; confirmUrl: string }, brand: BrandInfo): RenderedEmail {
  const title = 'Confirma tu suscripción';
  const list = d.purposes.map((p) => PURPOSE_LABEL[p] ?? p);
  const intro = `Hola ${d.firstName}, al reservar se pidió que este correo reciba ${list.join(' y ')} de peruwonderstours.`;
  const how = 'Solo te escribiremos con ofertas si confirmas con el botón. Si no fuiste tú, ignora este mensaje: no recibirás publicidad. El enlace vence en 7 días.';
  const html = layout({
    title,
    preheader: intro,
    brand,
    bodyHtml: `<p>${escapeHtml(intro)}</p><p>${escapeHtml(how)}</p>
<p><a href="${escapeHtml(d.confirmUrl)}" style="display:inline-block;background:#7a2e1d;color:#fff;padding:10px 18px;border-radius:6px;text-decoration:none">Sí, quiero recibir ofertas</a></p>
<p style="font-size:13px;color:#5f6b76">Puedes darte de baja cuando quieras desde cualquier correo comercial (Ley 29733).</p>`,
  });
  const text = [title, '', intro, how, '', `Confirmar: ${d.confirmUrl}`, '', textFooter(brand)].join('\n');
  return { subject: 'Confirma tu suscripción a ofertas de peruwonderstours', html, text };
}

// =============================================================================
// Libro de Reclamaciones
// =============================================================================
export interface ComplaintMailData {
  code: string;
  sheetNumber: string;
  submittedAt: Date;
  responseDueAt: Date;
  channel: 'web' | 'backup_book' | 'office_assisted';
  backupSheetNumber: string | null;
  provider: { legalName: string; ruc: string; establishmentAddress: string; establishmentCode: string };
  consumer: { fullName: string; docType: string; docNumber: string; address: string; phone: string | null; email: string; isMinor: boolean };
  guardian: { fullName: string; address: string; phone: string; email: string } | null;
  good: { type: string; description: string; claimedAmount: MoneyView | null };
  declaredType: string | null;
  type: string;
  detail: string;
  consumerRequest: string;
  responseChannel: 'email' | 'letter';
  legalNotices: readonly string[];
  consultUrl: string;
}

const DOC_LABEL: Record<string, string> = { dni: 'DNI', ce: 'Carné de extranjería', passport: 'Pasaporte', ruc: 'RUC', other: 'Otro' };
const TYPE_LABEL: Record<string, string> = { reclamo: 'Reclamo', queja: 'Queja' };

function sheetPairs(d: ComplaintMailData): Array<[string, string | null]> {
  return [
    ['N.º de hoja', d.sheetNumber],
    ['Código', d.code],
    ['Fecha y hora de registro', formatLimaDateTime(d.submittedAt)],
    ['Proveedor', `${d.provider.legalName} · RUC ${d.provider.ruc}`],
    ['Establecimiento', `${d.provider.establishmentAddress} (código ${d.provider.establishmentCode})`],
    ['Libro de respaldo (hoja física)', d.channel === 'backup_book' ? d.backupSheetNumber : null],
    ['1. Consumidor', d.consumer.fullName],
    ['Documento', `${DOC_LABEL[d.consumer.docType] ?? d.consumer.docType} ${d.consumer.docNumber}`],
    ['Domicilio', d.consumer.address],
    ['Teléfono', d.consumer.phone],
    ['Correo electrónico', d.consumer.email],
    ['Menor de edad', d.consumer.isMinor ? 'Sí' : 'No'],
    ['Padre, madre o representante', d.guardian ? `${d.guardian.fullName} · ${d.guardian.address} · ${d.guardian.phone} · ${d.guardian.email}` : null],
    ['2. Bien contratado', d.good.type === 'product' ? 'Producto' : 'Servicio'],
    ['Monto reclamado', d.good.claimedAmount ? formatMoney(d.good.claimedAmount) : null],
    ['Descripción', d.good.description],
    ['3. Tipo', `${TYPE_LABEL[d.type] ?? d.type}${d.declaredType && d.declaredType !== d.type ? ` (declarado: ${TYPE_LABEL[d.declaredType] ?? d.declaredType})` : ''}`],
    ['Detalle', d.detail],
    ['Pedido', d.consumerRequest],
    ['Respuesta por', d.responseChannel === 'email' ? 'Correo electrónico' : 'Carta al domicilio'],
  ];
}

/**
 * Hoja de reclamación imprimible (constancia del art. 4-B / Anexo I). Se adjunta como HTML;
 * la versión PDF queda pendiente (no hay librería de PDF instalada).
 */
export function complaintSheetDocument(d: ComplaintMailData, brand: BrandInfo): string {
  return layout({
    title: `LIBRO DE RECLAMACIONES · HOJA DE RECLAMACIÓN N.º ${d.sheetNumber}`,
    preheader: d.code,
    brand,
    bodyHtml: `${rows(sheetPairs(d))}
<p style="font-size:13px"><strong>Plazo de respuesta:</strong> a más tardar el ${escapeHtml(formatLimaDateTime(d.responseDueAt))}.</p>
<p style="font-size:12px;color:#5f6b76">Destinatario: consumidor.</p>
${d.legalNotices.map((n) => `<p style="font-size:12px;color:#5f6b76">${escapeHtml(n)}</p>`).join('')}`,
  });
}

/** Constancia al consumidor: fecha y hora, n.º de hoja, código y fecha límite de respuesta. */
export function complaintAcknowledgmentEmail(d: ComplaintMailData, brand: BrandInfo): RenderedEmail {
  const title = `Constancia de tu hoja de reclamación N.º ${d.sheetNumber}`;
  const intro = `Hola ${d.consumer.fullName}, registramos tu ${TYPE_LABEL[d.type]?.toLowerCase() ?? 'reclamo'} en nuestro Libro de Reclamaciones el ${formatLimaDateTime(d.submittedAt)}.`;
  const due = `Te responderemos a más tardar el ${formatLimaDateTime(d.responseDueAt)} (15 días hábiles, plazo improrrogable) por ${d.responseChannel === 'email' ? 'correo electrónico' : 'carta a tu domicilio'}.`;
  const html = layout({
    title,
    preheader: `${d.code} · respuesta hasta ${formatLimaDateTime(d.responseDueAt)}`,
    brand,
    bodyHtml: `<p>${escapeHtml(intro)}</p><p><strong>${escapeHtml(due)}</strong></p>
${rows(sheetPairs(d))}
${d.legalNotices.map((n) => `<p style="font-size:12px;color:#5f6b76">${escapeHtml(n)}</p>`).join('')}
<p style="font-size:13px">Adjuntamos tu hoja en formato imprimible. Consulta el estado y la respuesta con este enlace personal de un solo uso (no lo reenvíes; si venció, pide uno nuevo en la web con tu código y tu correo):</p>
${button(d.consultUrl, 'Consultar mi reclamo')}`,
  });
  const text = [title, '', intro, due, '', textRows(sheetPairs(d)), '', ...d.legalNotices, '', `Consulta: ${d.consultUrl}`, '', textFooter(brand)].join('\n');
  return { subject: `Constancia · Hoja de reclamación N.º ${d.sheetNumber} (${d.code})`, html, text };
}

export function complaintResponseEmail(d: ComplaintMailData & { responseText: string; respondedAt: Date }, brand: BrandInfo): RenderedEmail {
  const title = `Respuesta a tu hoja de reclamación N.º ${d.sheetNumber}`;
  const intro = `Hola ${d.consumer.fullName}, esta es nuestra respuesta a tu ${TYPE_LABEL[d.type]?.toLowerCase() ?? 'reclamo'} ${d.code}, registrado el ${formatLimaDateTime(d.submittedAt)}.`;
  const html = layout({
    title,
    preheader: d.code,
    brand,
    bodyHtml: `<p>${escapeHtml(intro)}</p>
<h2 style="font-size:16px">4. Observaciones y acciones adoptadas por el proveedor</h2>
<div style="background:#f4f1ea;border-radius:6px;padding:12px 16px">${multiline(d.responseText)}</div>
${rows([
  ['Fecha de la respuesta', formatLimaDateTime(d.respondedAt)],
  ['Tu pedido', d.consumerRequest],
])}
${d.legalNotices.slice(0, 1).map((n) => `<p style="font-size:12px;color:#5f6b76">${escapeHtml(n)}</p>`).join('')}`,
  });
  const text = [title, '', intro, '', 'Observaciones y acciones adoptadas:', d.responseText, '', `Fecha de la respuesta: ${formatLimaDateTime(d.respondedAt)}`, '', d.legalNotices[0] ?? '', '', textFooter(brand)].join('\n');
  return { subject: `Respuesta a tu reclamo ${d.code} · peruwonderstours`, html, text };
}

export const SETTLEMENT_ACCEPTANCE_PHRASE = 'ACUERDO ACEPTADO PARA SOLUCIONAR EL RECLAMO';

export function complaintSettlementOfferEmail(d: ComplaintMailData & { offerText: string; expiresAt: Date }, brand: BrandInfo): RenderedEmail {
  const title = `Propuesta de solución para tu reclamo ${d.code}`;
  const intro = `Hola ${d.consumer.fullName}, queremos solucionar tu ${TYPE_LABEL[d.type]?.toLowerCase() ?? 'reclamo'} ${d.code} con la siguiente propuesta (art. 6-A del Reglamento del Libro de Reclamaciones).`;
  const how = `Si estás de acuerdo, responde a este correo hasta el ${formatLimaDateTime(d.expiresAt)} escribiendo: "${SETTLEMENT_ACCEPTANCE_PHRASE}". Si no respondes o no aceptas, te daremos respuesta formal dentro del plazo legal.`;
  const html = layout({
    title,
    preheader: d.code,
    brand,
    bodyHtml: `<p>${escapeHtml(intro)}</p><div style="background:#f4f1ea;border-radius:6px;padding:12px 16px">${multiline(d.offerText)}</div><p><strong>${escapeHtml(how)}</strong></p>`,
  });
  const text = [title, '', intro, '', d.offerText, '', how, '', textFooter(brand)].join('\n');
  return { subject: `Propuesta de solución · reclamo ${d.code}`, html, text };
}

/** F7: enlace mágico para consultar la hoja de reclamación (es / en). */
export function complaintAccessLinkEmail(d: { code: string; consumerName: string; linkUrl: string; ttlMinutes: number; locale: MailLocale }, brand: BrandInfo): RenderedEmail {
  const es = d.locale !== 'en';
  const title = es ? `Consulta de tu hoja de reclamación ${d.code}` : `Check your complaint ${d.code}`;
  const intro = es
    ? `Hola ${d.consumerName}, usa este botón para consultar el estado y la respuesta de tu reclamo:`
    : `Hi ${d.consumerName}, use this button to check the status and answer of your complaint:`;
  const cta = es ? 'Consultar mi reclamo' : 'Check my complaint';
  const note = es
    ? `El enlace es de un solo uso y vence en ${d.ttlMinutes} minutos. Si no lo pediste, ignora este correo.`
    : `This link can be used once and expires in ${d.ttlMinutes} minutes. If you did not request it, ignore this email.`;
  const html = layout({ title, locale: d.locale, preheader: title, brand, bodyHtml: `<p>${escapeHtml(intro)}</p>${button(d.linkUrl, cta)}<p style="font-size:13px;color:#5f6b76">${escapeHtml(note)}</p>` });
  const text = [title, '', intro, d.linkUrl, '', note, '', textFooter(brand, undefined, d.locale)].join('\n');
  return { subject: title, html, text };
}
