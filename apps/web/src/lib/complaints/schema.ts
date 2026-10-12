import { z } from "zod";

/**
 * Hoja de Reclamación virtual (D.S. 011-2011-PCM y modificatorias; Anexo I del D.S. 101-2022-PCM).
 * Orden de campos = orden del Anexo I (brain/wiki/normativa/libro-de-reclamaciones.md §3.1).
 * Las reglas replican las del backend (apps/api/src/modules/complaints/domain/complaint.ts) para
 * avisar ANTES de enviar: sin nombre, documento, domicilio, correo o detalle la hoja no se envía.
 * Los mensajes son claves de `formErrors` (traducidas por `form-fields.tsx`); `clave|n` pasa `n`.
 */

export const DOC_TYPES = [
  { value: "dni", label: "DNI" },
  { value: "ce", label: "Carné de extranjería" },
  { value: "passport", label: "Pasaporte" },
  { value: "other", label: "Otro documento" },
] as const;

const DOC_RULES: Record<(typeof DOC_TYPES)[number]["value"], { re: RegExp; message: string }> = {
  dni: { re: /^\d{8}$/, message: "dniInvalid" },
  ce: { re: /^[A-Z0-9]{9,12}$/, message: "ceInvalid" },
  passport: { re: /^[A-Z0-9]{5,20}$/, message: "passportInvalid" },
  other: { re: /^[A-Z0-9-]{3,20}$/, message: "otherDocInvalid" },
};

export function normalizeDoc(value: string): string {
  return value.replace(/[\s.]/g, "").toUpperCase();
}

/** Teléfono a E.164: acepta "987 654 321" (Perú) o "+56 9 1234 5678". */
export function normalizePhone(value: string): string {
  const trimmed = value.trim();
  const digits = trimmed.replace(/\D/g, "");
  if (trimmed.startsWith("+")) return `+${digits}`;
  if (/^9\d{8}$/.test(digits)) return `+51${digits}`;
  return digits ? `+${digits}` : "";
}

const phone = z
  .string()
  .trim()
  .refine((v) => /^\+\d{8,15}$/.test(normalizePhone(v)), "phoneIntl");
const email = z.string().trim().max(254).email("emailInvalid");
const text = (min: number, max: number, message: string) => z.string().trim().min(min, message).max(max, `maxChars|${max}`);

export const complaintSchema = z
  .object({
    // Sección 1 — Identificación del consumidor reclamante
    fullName: text(3, 200, "fullNameRequired"),
    docType: z.enum(["dni", "ce", "passport", "other"]),
    docNumber: z.string().trim().min(1, "docNumberRequired"),
    address: text(5, 300, "addressRequired"),
    phone,
    email,
    emailConfirm: z.string().trim(),
    isMinor: z.boolean(),
    guardianFullName: z.string().trim().max(200),
    guardianAddress: z.string().trim().max(300),
    guardianPhone: z.string().trim(),
    guardianEmail: z.string().trim().max(254),
    // Sección 2 — Identificación del bien contratado
    goodType: z.enum(["service", "product"]),
    claimedAmount: z.string().trim(),
    currency: z.enum(["PEN", "USD"]),
    goodDescription: text(5, 500, "goodDescriptionRequired"),
    bookingCode: z
      .string()
      .trim()
      .toUpperCase()
      .refine((v) => v === "" || /^PWT-\d{4}-\d{6}$/.test(v), "bookingCodeFormat"),
    // Sección 3 — Detalle de la reclamación y pedido del consumidor
    declaredType: z.enum(["reclamo", "queja", "unknown"], { error: "declaredTypeRequired" }),
    detail: text(10, 5000, "detailRequired"),
    consumerRequest: text(5, 2000, "consumerRequestRequired"),
    responseChannel: z.enum(["email", "letter"]),
    conformityAccepted: z.boolean().refine((v) => v, "conformityRequired"),
  })
  .superRefine((v, ctx) => {
    const rule = DOC_RULES[v.docType];
    if (v.docNumber && !rule.re.test(normalizeDoc(v.docNumber))) {
      ctx.addIssue({ code: "custom", path: ["docNumber"], message: rule.message });
    }
    if (v.emailConfirm.toLowerCase() !== v.email.toLowerCase()) {
      ctx.addIssue({ code: "custom", path: ["emailConfirm"], message: "emailMismatch" });
    }
    if (v.isMinor) {
      if (v.guardianFullName.length < 3) ctx.addIssue({ code: "custom", path: ["guardianFullName"], message: "guardianFullNameRequired" });
      if (v.guardianAddress.length < 5) ctx.addIssue({ code: "custom", path: ["guardianAddress"], message: "guardianAddressRequired" });
      if (!/^\+\d{8,15}$/.test(normalizePhone(v.guardianPhone))) ctx.addIssue({ code: "custom", path: ["guardianPhone"], message: "guardianPhoneRequired" });
      if (!z.string().email().safeParse(v.guardianEmail).success) ctx.addIssue({ code: "custom", path: ["guardianEmail"], message: "guardianEmailRequired" });
    }
    const amount = v.claimedAmount.replace(",", ".");
    if (amount && !/^\d{1,9}(\.\d{1,2})?$/.test(amount)) {
      ctx.addIssue({ code: "custom", path: ["claimedAmount"], message: "amountFormat" });
    }
    if (v.declaredType === "reclamo" && !amount) {
      ctx.addIssue({ code: "custom", path: ["claimedAmount"], message: "amountRequired" });
    }
  });

export type ComplaintValues = z.infer<typeof complaintSchema>;

export const EMPTY_COMPLAINT: ComplaintValues = {
  fullName: "",
  docType: "dni",
  docNumber: "",
  address: "",
  phone: "",
  email: "",
  emailConfirm: "",
  isMinor: false,
  guardianFullName: "",
  guardianAddress: "",
  guardianPhone: "",
  guardianEmail: "",
  goodType: "service",
  claimedAmount: "",
  currency: "PEN",
  goodDescription: "",
  bookingCode: "",
  declaredType: "reclamo",
  detail: "",
  consumerRequest: "",
  responseChannel: "email",
  conformityAccepted: false,
};

/** "450.5" → 45050 céntimos (entero, sin floats). Cadena vacía → null. */
export function amountToCents(value: string): number | null {
  const v = value.trim().replace(",", ".");
  if (!v) return null;
  const [soles, cents = ""] = v.split(".");
  return Number(soles) * 100 + Number(cents.padEnd(2, "0").slice(0, 2));
}

export const COMPLAINT_DEFINITIONS = {
  reclamo: "Reclamo: disconformidad relacionada con los productos o servicios.",
  queja: "Queja: disconformidad no relacionada con los productos o servicios; o malestar o descontento respecto a la atención al público.",
} as const;

export const COMPLAINT_LEGENDS = [
  "La formulación del reclamo no impide acudir a otras vías de solución de controversias ni es requisito previo para interponer una denuncia ante el INDECOPI.",
  "El proveedor debe dar respuesta al reclamo o queja en un plazo no mayor a quince (15) días hábiles, el cual es improrrogable.",
] as const;

/** Texto versionado de la declaración que sustituye a la firma (art. 5). [A VALIDAR CON ASESOR LEGAL] */
export const CONFORMITY_TEXT =
  "Declaro que los datos consignados en esta hoja son verdaderos y que estoy conforme con su contenido. Esta declaración reemplaza a mi firma.";

/** Constancia que se muestra (e imprime) al registrar la hoja. */
export interface ComplaintReceipt {
  code: string;
  sheetNumber: string | null;
  submittedAt: string;
  responseDueAt: string;
  provider: { legalName: string | null; ruc: string | null; establishmentAddress: string | null; establishmentCode: string | null };
  values: Omit<ComplaintValues, "emailConfirm" | "conformityAccepted">;
}

/**
 * Rótulos LEGALES de la hoja (Anexo I del D.S. 101-2022-PCM). Se muestran SIEMPRE en español, también
 * en `/en`; allí cada rótulo lleva debajo una ayuda en inglés (`complaints.form.help.*`).
 */
export const COMPLAINT_LABELS = {
  sheet: "Hoja de reclamación",
  sheetNumber: "N.º de hoja",
  date: "Fecha",
  provider: "Proveedor (razón social) / RUC",
  establishment: "Domicilio del establecimiento / código",
  section1: "Identificación del consumidor reclamante",
  section2: "Identificación del bien contratado",
  section3: "Detalle de la reclamación y pedido del consumidor",
  fullName: "Nombres y apellidos",
  docType: "Tipo de documento",
  docNumber: "Número de documento",
  address: "Domicilio",
  phone: "Teléfono",
  email: "Correo electrónico",
  emailConfirm: "Confirma tu correo",
  isMinor: "Soy menor de edad (se piden los datos de mi padre, madre o representante).",
  guardian: "Padre, madre o representante",
  guardianFullName: "Nombres y apellidos del representante",
  guardianAddress: "Domicilio del representante",
  guardianPhone: "Teléfono del representante",
  guardianEmail: "Correo del representante",
  goodType: "Bien contratado",
  service: "Servicio",
  product: "Producto",
  claimedAmount: "Monto reclamado",
  claimedAmountOptional: "Monto reclamado (opcional)",
  currency: "Moneda",
  goodDescription: "Descripción del servicio o producto",
  bookingCode: "Código de reserva (opcional)",
  declaredType: "Tipo",
  reclamo: "Reclamo",
  queja: "Queja",
  unknown: "No estoy seguro",
  detail: "Detalle",
  consumerRequest: "Pedido",
  responseChannel: "¿Cómo quieres recibir la respuesta?",
  channelEmail: "Por correo electrónico",
  channelLetter: "Por carta a mi domicilio",
} as const;

export type ComplaintLabelKey = keyof typeof COMPLAINT_LABELS;
