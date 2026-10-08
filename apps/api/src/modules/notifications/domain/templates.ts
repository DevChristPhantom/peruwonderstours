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

export function formatLimaDateTime(date: Date): string {
  const text = new Intl.DateTimeFormat('es-PE', { timeZone: LIMA, day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false }).format(date);
  return `${text} (hora de Lima)`;
}

export function formatLimaDate(date: Date): string {
  return new Intl.DateTimeFormat('es-PE', { timeZone: LIMA, weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(date);
}

/** Fecha de calendario YYYY-MM-DD (sin zona) en texto largo. */
export function formatCalendarDate(date: string): string {
  return formatLimaDate(new Date(`${date}T17:00:00Z`));
}

function layout(params: { title: string; preheader: string; bodyHtml: string; brand: BrandInfo; footerExtraHtml?: string }): string {
  const { brand } = params;
  return `<!doctype html>
<html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(params.title)}</title></head>
<body style="margin:0;padding:0;background:#f4f1ea;font-family:Arial,Helvetica,sans-serif;color:#1f2933">
<span style="display:none;max-height:0;overflow:hidden">${escapeHtml(params.preheader)}</span>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f1ea"><tr><td align="center" style="padding:24px 12px">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#ffffff;border-radius:8px">
<tr><td style="background:#7a2e1d;color:#ffffff;padding:20px 24px;border-radius:8px 8px 0 0;font-size:20px;font-weight:bold">Peru Wonders Tours</td></tr>
<tr><td style="padding:24px;font-size:15px;line-height:1.55">
<h1 style="font-size:20px;margin:0 0 16px">${escapeHtml(params.title)}</h1>
${params.bodyHtml}
</td></tr>
<tr><td style="padding:16px 24px;border-top:1px solid #e5e0d5;font-size:12px;color:#5f6b76;line-height:1.5">
${escapeHtml(brand.providerLegalName)} · RUC ${escapeHtml(brand.providerRuc)}<br>
Atención: <a href="mailto:${escapeHtml(brand.contactEmail)}" style="color:#7a2e1d">${escapeHtml(brand.contactEmail)}</a> · ${escapeHtml(brand.contactPhone)}<br>
<a href="${escapeHtml(brand.publicWebBaseUrl)}/es/libro-de-reclamaciones" style="color:#7a2e1d">Libro de Reclamaciones</a> ·
<a href="${escapeHtml(brand.publicWebBaseUrl)}/es/politicas/proteccion-de-datos-personales" style="color:#7a2e1d">Política de privacidad</a>
${params.footerExtraHtml ?? ''}
</td></tr></table></td></tr></table></body></html>`;
}

function textFooter(brand: BrandInfo, extra?: string): string {
  return [
    '--',
    `${brand.providerLegalName} · RUC ${brand.providerRuc}`,
    `Atención: ${brand.contactEmail} · ${brand.contactPhone}`,
    `Libro de Reclamaciones: ${brand.publicWebBaseUrl}/es/libro-de-reclamaciones`,
    `Política de privacidad: ${brand.publicWebBaseUrl}/es/politicas/proteccion-de-datos-personales`,
    ...(extra ? [extra] : []),
  ].join('\n');
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
// Reservas
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
  manageUrl: string;
  unsubscribeUrl?: string | null;
}

function itemsHtml(items: BookingMailData['items']): string {
  return `<table role="presentation" width="100%" cellpadding="6" cellspacing="0" style="border-collapse:collapse;font-size:14px;margin:8px 0 16px">
<tr style="background:#f4f1ea"><th align="left">Servicio</th><th align="left">Fecha</th><th align="right">Pax</th><th align="right">Subtotal</th></tr>
${items
  .map(
    (i) =>
      `<tr><td style="border-bottom:1px solid #eee">${escapeHtml(i.title)}</td><td style="border-bottom:1px solid #eee">${escapeHtml(formatCalendarDate(i.travelDate))}</td><td align="right" style="border-bottom:1px solid #eee">${i.paxCount}</td><td align="right" style="border-bottom:1px solid #eee">${escapeHtml(formatMoney(i.subtotal))}</td></tr>`,
  )
  .join('')}</table>`;
}

function itemsText(items: BookingMailData['items']): string {
  return items.map((i) => `- ${i.title} · ${formatCalendarDate(i.travelDate)} · ${i.paxCount} pax · ${formatMoney(i.subtotal)}`).join('\n');
}

function amountsPairs(d: BookingMailData): Array<[string, string | null]> {
  return [
    ['Código de reserva', d.code],
    ['Total', formatMoney(d.total)],
    ['Pagado', formatMoney(d.paid)],
    ['Saldo pendiente', d.balance.amount > 0n ? formatMoney(d.balance) : 'Sin saldo pendiente'],
    ['Vence el saldo', d.balance.amount > 0n && d.balanceDueAt ? formatLimaDateTime(d.balanceDueAt) : null],
  ];
}

function unsubscribeFooter(d: BookingMailData): { html: string; text: string } {
  if (!d.unsubscribeUrl) return { html: '', text: '' };
  return {
    html: `<br>¿No quieres recibir ofertas? <a href="${escapeHtml(d.unsubscribeUrl)}" style="color:#7a2e1d">Darte de baja de las comunicaciones comerciales</a>.`,
    text: `Darte de baja de las comunicaciones comerciales: ${d.unsubscribeUrl}`,
  };
}

/** Confirmación de reserva (primer cobro) o reenvío del voucher. */
export function bookingVoucherEmail(d: BookingMailData, brand: BrandInfo, kind: 'confirmation' | 'voucher'): RenderedEmail {
  const title = kind === 'confirmation' ? `Reserva confirmada ${d.code}` : `Tu voucher de la reserva ${d.code}`;
  const intro =
    kind === 'confirmation'
      ? `Hola ${d.customerName}, recibimos tu pago y tu reserva está confirmada. Este correo es tu voucher: preséntalo (impreso o en el celular) el día del servicio.`
      : `Hola ${d.customerName}, te reenviamos el voucher de tu reserva. Preséntalo (impreso o en el celular) el día del servicio.`;
  const unsub = unsubscribeFooter(d);
  const html = layout({
    title,
    preheader: `${d.code} · ${formatMoney(d.total)}`,
    brand,
    bodyHtml: `<p>${escapeHtml(intro)}</p>
<div style="border:2px dashed #7a2e1d;border-radius:8px;padding:12px 16px;margin:16px 0">
<p style="margin:0 0 4px;font-size:13px;color:#5f6b76">VOUCHER</p>
<p style="margin:0;font-size:22px;font-weight:bold;letter-spacing:1px">${escapeHtml(d.code)}</p></div>
${itemsHtml(d.items)}
${rows(amountsPairs(d))}
${d.balance.amount > 0n ? `<p>Recuerda pagar el saldo antes de la fecha indicada para mantener tu reserva.</p>` : ''}
<p><a href="${escapeHtml(d.manageUrl)}" style="display:inline-block;background:#7a2e1d;color:#fff;padding:10px 18px;border-radius:6px;text-decoration:none">Ver mi reserva</a></p>
<p style="font-size:13px;color:#5f6b76">Para consultar tu reserva necesitas el enlace de acceso que recibiste al reservar. Si lo perdiste, escríbenos indicando tu código.</p>`,
    footerExtraHtml: unsub.html,
  });
  const text = [
    title,
    '',
    intro,
    '',
    `VOUCHER: ${d.code}`,
    itemsText(d.items),
    '',
    textRows(amountsPairs(d)),
    '',
    `Ver mi reserva: ${d.manageUrl}`,
    '',
    textFooter(brand, unsub.text || undefined),
  ].join('\n');
  return { subject: kind === 'confirmation' ? `Reserva confirmada ${d.code} · Peru Wonders Tours` : `Voucher de tu reserva ${d.code}`, html, text };
}

export function paymentReceivedEmail(d: BookingMailData & { payment: MoneyView }, brand: BrandInfo): RenderedEmail {
  const title = `Pago recibido · ${d.code}`;
  const intro = `Hola ${d.customerName}, registramos tu pago de ${formatMoney(d.payment)}.`;
  const unsub = unsubscribeFooter(d);
  const html = layout({
    title,
    preheader: intro,
    brand,
    bodyHtml: `<p>${escapeHtml(intro)}</p>${rows(amountsPairs(d))}${
      d.balance.amount === 0n ? '<p>Tu reserva está pagada al 100 %. ¡Te esperamos!</p>' : ''
    }<p><a href="${escapeHtml(d.manageUrl)}" style="color:#7a2e1d">Ver mi reserva</a></p>`,
    footerExtraHtml: unsub.html,
  });
  const text = [title, '', intro, '', textRows(amountsPairs(d)), '', `Ver mi reserva: ${d.manageUrl}`, '', textFooter(brand, unsub.text || undefined)].join('\n');
  return { subject: `Pago recibido · reserva ${d.code}`, html, text };
}

export function balanceReminderEmail(d: BookingMailData, brand: BrandInfo, daysBefore: number): RenderedEmail {
  const due = d.balanceDueAt ? formatLimaDateTime(d.balanceDueAt) : 'la fecha indicada en tu reserva';
  const title = `Recordatorio: saldo de tu reserva ${d.code}`;
  const intro = `Hola ${d.customerName}, te recordamos que el saldo de tu reserva (${formatMoney(d.balance)}) vence el ${due}${daysBefore <= 2 ? '. ¡Quedan menos de 2 días!' : '.'}`;
  const html = layout({
    title,
    preheader: intro,
    brand,
    bodyHtml: `<p>${escapeHtml(intro)}</p>${itemsHtml(d.items)}${rows(amountsPairs(d))}
<p><a href="${escapeHtml(d.manageUrl)}" style="display:inline-block;background:#7a2e1d;color:#fff;padding:10px 18px;border-radius:6px;text-decoration:none">Pagar el saldo</a></p>
<p style="font-size:13px;color:#5f6b76">Si ya pagaste, ignora este mensaje. También puedes pagar en efectivo o por transferencia coordinando con nosotros.</p>`,
  });
  const text = [title, '', intro, '', itemsText(d.items), '', textRows(amountsPairs(d)), '', `Pagar el saldo: ${d.manageUrl}`, '', textFooter(brand)].join('\n');
  return { subject: `Recordatorio de saldo · reserva ${d.code}`, html, text };
}

export function bookingCancelledEmail(d: BookingMailData & { refundDue: MoneyView; reason: string | null }, brand: BrandInfo): RenderedEmail {
  const title = `Reserva cancelada ${d.code}`;
  const intro = `Hola ${d.customerName}, tu reserva ${d.code} fue cancelada.`;
  const refund =
    d.refundDue.amount > 0n
      ? `Según nuestra política de cancelación te corresponde un reembolso de ${formatMoney(d.refundDue)}. Te contactaremos para coordinarlo por el mismo medio de pago.`
      : 'Según nuestra política de cancelación, esta cancelación no genera reembolso.';
  const html = layout({
    title,
    preheader: intro,
    brand,
    bodyHtml: `<p>${escapeHtml(intro)}</p>${itemsHtml(d.items)}${rows([
      ['Código de reserva', d.code],
      ['Pagado', formatMoney(d.paid)],
      ['Reembolso', formatMoney(d.refundDue)],
    ])}<p>${escapeHtml(refund)}</p>
<p style="font-size:13px;color:#5f6b76">Si no solicitaste esta cancelación o no estás de acuerdo, responde a este correo o registra tu reclamo en nuestro Libro de Reclamaciones.</p>`,
  });
  const text = [title, '', intro, '', itemsText(d.items), '', `Pagado: ${formatMoney(d.paid)}`, `Reembolso: ${formatMoney(d.refundDue)}`, '', refund, '', textFooter(brand)].join('\n');
  return { subject: `Cancelación de tu reserva ${d.code}`, html, text };
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
<p style="font-size:13px">Adjuntamos tu hoja en formato imprimible. Consulta el estado con el enlace que recibiste al registrarla: <a href="${escapeHtml(d.consultUrl)}" style="color:#7a2e1d">${escapeHtml(d.consultUrl)}</a></p>`,
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
  return { subject: `Respuesta a tu reclamo ${d.code} · Peru Wonders Tours`, html, text };
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
