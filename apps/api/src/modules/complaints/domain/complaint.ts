import { ValidationError } from '../../../shared/domain/domain-error.js';
import type { CurrencyCode } from '../../../shared/domain/money.js';

/**
 * Hoja de reclamación del Libro de Reclamaciones virtual (Anexo I, D.S. 101-2022-PCM).
 * Requisitos: brain/wiki/normativa/libro-de-reclamaciones.md (secciones 2.3 y 3.1).
 */
export const COMPLAINT_TYPES = ['reclamo', 'queja'] as const;
export type ComplaintType = (typeof COMPLAINT_TYPES)[number];
export const COMPLAINT_STATUSES = ['received', 'in_review', 'answered', 'closed', 'settled'] as const;
export type ComplaintStatus = (typeof COMPLAINT_STATUSES)[number];
export const CONSUMER_DOC_TYPES = ['dni', 'ce', 'passport', 'other'] as const;
export type ConsumerDocType = (typeof CONSUMER_DOC_TYPES)[number] | 'ruc';
export const GOOD_TYPES = ['product', 'service'] as const;
export type GoodType = (typeof GOOD_TYPES)[number];
export const RESPONSE_CHANNELS = ['email', 'letter'] as const;
export type ResponseChannel = (typeof RESPONSE_CHANNELS)[number];
export type ComplaintChannel = 'web' | 'backup_book' | 'office_assisted';

export const COMPLAINT_CODE_PATTERN = /^LR-\d{4}-\d{6}$/;

/** Leyendas obligatorias del pie del Anexo I (se muestran en la constancia y en el PDF). */
export const COMPLAINT_LEGAL_NOTICES = [
  'La formulación del reclamo no impide acudir a otras vías de solución de controversias ni es requisito previo para interponer una denuncia ante el INDECOPI.',
  'El proveedor debe dar respuesta al reclamo o queja en un plazo no mayor a quince (15) días hábiles, el cual es improrrogable.',
] as const;

/** H-19: contexto autenticado (AAD) de los campos cifrados de una hoja. */
export function complaintAad(id: string, column: 'consumer_doc_enc' | 'consumer_phone_enc' | 'guardian_phone_enc'): string {
  return `complaints:${column}:${id}`;
}

export function formatComplaintCode(year: number, sequence: number): string {
  return `LR-${year}-${String(sequence).padStart(6, '0')}`;
}

/** Número de hoja impreso como en el Anexo I: `000000045-2026`. */
export function formatSheetNumber(year: number, sequence: number): string {
  return `${String(sequence).padStart(9, '0')}-${year}`;
}

export interface ProviderSnapshot {
  legalName: string;
  ruc: string;
  establishmentAddress: string;
  establishmentCode: string;
}

/** Datos tal como los ingresa el consumidor (antes de cifrar). */
export interface ComplaintDraft {
  consumer: {
    fullName: string;
    docType: ConsumerDocType;
    docNumber: string;
    address: string;
    phone: string;
    email: string;
    isMinor: boolean;
  };
  guardian: { fullName: string; address: string; phone: string; email: string } | null;
  good: { type: GoodType; description: string; claimedAmount: bigint | null; currency: CurrencyCode | null };
  /** null = "no sé" (se tramita como reclamo, art. 6). */
  declaredType: ComplaintType | null;
  detail: string;
  consumerRequest: string;
  responseChannel: ResponseChannel;
  conformityAccepted: boolean;
}

const DOC_NUMBER_RULES: Record<ConsumerDocType, { pattern: RegExp; message: string }> = {
  dni: { pattern: /^\d{8}$/, message: 'El DNI debe tener 8 dígitos.' },
  ce: { pattern: /^[A-Za-z0-9]{9,12}$/, message: 'El carné de extranjería debe tener de 9 a 12 caracteres alfanuméricos.' },
  passport: { pattern: /^[A-Za-z0-9]{5,20}$/, message: 'El pasaporte debe tener de 5 a 20 caracteres alfanuméricos.' },
  ruc: { pattern: /^(10|15|17|20)\d{9}$/, message: 'El RUC debe tener 11 dígitos.' },
  other: { pattern: /^[A-Za-z0-9-]{3,20}$/, message: 'El documento debe tener de 3 a 20 caracteres.' },
};

export function normalizeDocNumber(docNumber: string): string {
  return docNumber.replace(/[\s.]/g, '').toUpperCase();
}

/**
 * Reglas cruzadas de la hoja (los formatos simples los valida el DTO). Lanza un
 * ValidationError `validation-failed` con la lista de campos (mismo formato que los DTO).
 */
export function assertComplaintRules(draft: ComplaintDraft): void {
  const errors: Array<{ field: string; messages: string[] }> = [];
  const add = (field: string, message: string) => errors.push({ field, messages: [message] });

  const docRule = DOC_NUMBER_RULES[draft.consumer.docType];
  if (!docRule.pattern.test(normalizeDocNumber(draft.consumer.docNumber))) add('consumer.docNumber', docRule.message);

  if (draft.consumer.isMinor && !draft.guardian) {
    add('guardian', 'Si eres menor de edad, indica nombre, domicilio, teléfono y correo de tu padre, madre o representante.');
  }
  if (!draft.consumer.isMinor && draft.guardian) add('guardian', 'Los datos del representante solo se registran para menores de edad.');

  if (draft.declaredType === 'reclamo' && draft.good.claimedAmount === null) {
    add('good.claimedAmount', 'Indica el monto reclamado (puede ser 0 si no hay monto).');
  }
  if ((draft.good.claimedAmount === null) !== (draft.good.currency === null)) {
    add('good.currency', 'El monto reclamado y su moneda van juntos.');
  }
  if (draft.good.claimedAmount !== null && draft.good.claimedAmount < 0n) add('good.claimedAmount', 'El monto no puede ser negativo.');

  if (!draft.conformityAccepted) add('conformityAccepted', 'Debes declarar la conformidad con los datos de la hoja.');

  for (const [field, value] of [
    ['consumer.fullName', draft.consumer.fullName],
    ['consumer.address', draft.consumer.address],
    ['detail', draft.detail],
    ['consumerRequest', draft.consumerRequest],
    ['good.description', draft.good.description],
  ] as const) {
    if (value.trim().length === 0) add(field, 'No puede estar vacío.');
  }

  if (errors.length > 0) {
    throw new ValidationError('validation-failed', 'Revisa los campos indicados.', { errors });
  }
}

/** Hoja persistida (PII sensible ya cifrada). */
export interface ComplaintSnapshot {
  id: string;
  year: number;
  sequence: number;
  code: string;
  type: ComplaintType;
  declaredType: ComplaintType | null;
  status: ComplaintStatus;
  channel: ComplaintChannel;
  bookingId: string | null;
  /** H-17: código de reserva declarado por el consumidor y no verificado (no vincula bookingId). */
  declaredBookingCode?: string | null;
  provider: ProviderSnapshot;
  consumer: {
    fullName: string;
    docType: ConsumerDocType;
    docEnc: Uint8Array;
    docHash: Uint8Array;
    address: string;
    email: string;
    phoneEnc: Uint8Array | null;
    isMinor: boolean;
  };
  guardian: { fullName: string; address: string; phoneEnc: Uint8Array; email: string } | null;
  good: { type: GoodType; description: string; claimedAmount: bigint | null; currency: CurrencyCode | null };
  detail: string;
  consumerRequest: string;
  responseChannel: ResponseChannel;
  conformityAcceptedAt: Date | null;
  conformityTextVersion: string | null;
  privacyNoticeVersion: string | null;
  responseText: string | null;
  responseSentAt: Date | null;
  responseDueAt: Date;
  submittedAt: Date;
  ip: string | null;
  accessTokenHash: string | null;
  /** Libro de respaldo (art. 4-A): n.º de hoja física y fecha de transcripción. */
  backupSheetNumber?: string | null;
  transcribedAt?: Date | null;
  acknowledgmentSentAt?: Date | null;
  acknowledgmentDeliveryRef?: string | null;
  responseDeliveryRef?: string | null;
  respondedAt?: Date | null;
  settlementOfferText?: string | null;
  settlementExpiresAt?: Date | null;
}
