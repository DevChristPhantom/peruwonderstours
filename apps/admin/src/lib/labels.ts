/** Etiquetas en español para los enums de la API. */

export type Tone = "neutral" | "info" | "success" | "warning" | "danger" | "accent";

export const BOOKING_STATUS: Record<string, { label: string; tone: Tone }> = {
  pending: { label: "Pendiente", tone: "neutral" },
  held: { label: "Cupo retenido", tone: "info" },
  confirmed: { label: "Confirmada", tone: "info" },
  partially_paid: { label: "Adelanto pagado", tone: "warning" },
  paid: { label: "Pagada", tone: "success" },
  cancelled: { label: "Cancelada", tone: "danger" },
  refunded: { label: "Reembolsada", tone: "neutral" },
  completed: { label: "Completada", tone: "success" },
};

export const PAYMENT_KIND: Record<string, string> = { deposit: "Adelanto", full: "Pago total", balance: "Saldo", refund: "Reembolso" };
export const PAYMENT_METHOD: Record<string, string> = { cash: "Efectivo", bank_transfer: "Transferencia", card: "Tarjeta", yape: "Yape", plin: "Plin" };
export const PAYMENT_STATUS: Record<string, string> = {
  pending: "Pendiente",
  succeeded: "Exitoso",
  failed: "Fallido",
  cancelled: "Anulado",
  requires_action: "Requiere acción",
  expired: "Vencido",
};

export const PAX_TYPE: Record<string, string> = { adult: "Adulto", child: "Niño", student: "Estudiante", senior: "Adulto mayor" };
export const RESIDENCY: Record<string, string> = { national: "Nacional", foreign: "Extranjero" };

export const TOUR_STATUS: Record<string, { label: string; tone: Tone }> = {
  draft: { label: "Borrador", tone: "neutral" },
  published: { label: "Publicado", tone: "success" },
  archived: { label: "Archivado", tone: "danger" },
};
export const TOUR_TYPE: Record<string, string> = { tour: "Tour", package: "Paquete", transfer: "Traslado" };
export const DIFFICULTY: Record<string, string> = { easy: "Fácil", moderate: "Moderada", challenging: "Exigente", extreme: "Extrema" };

export const TRAFFIC_LIGHT: Record<string, { label: string; tone: Tone; hint: string }> = {
  green: { label: "En plazo", tone: "success", hint: "Menos de 10 días hábiles transcurridos" },
  yellow: { label: "Atención", tone: "warning", hint: "Desde el día hábil 10" },
  red: { label: "Urgente", tone: "danger", hint: "Desde el día hábil 13 (vence el 15)" },
  overdue: { label: "Vencido", tone: "danger", hint: "Pasó el plazo legal de 15 días hábiles" },
  suspended: { label: "Suspendido", tone: "info", hint: "Plazo suspendido por oferta de solución directa" },
  done: { label: "Atendido", tone: "neutral", hint: "Respondido, cerrado o con acuerdo" },
};

export const COMPLAINT_STATUS: Record<string, string> = {
  received: "Recibido",
  in_review: "En revisión",
  answered: "Respondido",
  closed: "Cerrado",
  settled: "Acuerdo (solución directa)",
};
export const COMPLAINT_TYPE: Record<string, string> = { reclamo: "Reclamo", queja: "Queja" };
export const COMPLAINT_CHANNEL: Record<string, string> = { web: "Libro virtual", backup_book: "Libro físico (respaldo)", office_assisted: "Asistido en oficina" };
export const DOC_TYPE: Record<string, string> = { dni: "DNI", ce: "Carné de extranjería", passport: "Pasaporte", other: "Otro" };

export const DSR_TYPE: Record<string, string> = {
  information: "Información",
  access: "Acceso",
  portability: "Portabilidad",
  rectification: "Rectificación",
  cancellation: "Cancelación",
  opposition: "Oposición",
  revoke_consent: "Revocación del consentimiento",
};
export const DSR_STATUS: Record<string, { label: string; tone: Tone }> = {
  received: { label: "Recibida", tone: "info" },
  in_progress: { label: "En trámite", tone: "warning" },
  answered: { label: "Respondida", tone: "success" },
  rejected: { label: "Denegada", tone: "neutral" },
  withdrawn: { label: "Desistida", tone: "neutral" },
};
export const DSR_CHANNEL: Record<string, string> = { email: "Correo", web: "Web", office: "Oficina", phone: "Teléfono", letter: "Carta" };

export const USER_STATUS: Record<string, { label: string; tone: Tone }> = {
  active: { label: "Activo", tone: "success" },
  suspended: { label: "Suspendido", tone: "warning" },
  disabled: { label: "Deshabilitado", tone: "danger" },
};

export const EMAIL_EVENT: Record<string, string> = {
  "booking.confirmed": "Confirmación y voucher",
  "booking.voucher_requested": "Reenvío de voucher",
  "booking.cancelled": "Cancelación",
  "booking.payment_received": "Pago recibido",
  "booking.balance_reminder": "Recordatorio de saldo",
  "complaint.submitted": "Constancia de reclamo",
  "complaint.answered": "Respuesta al reclamo",
  "complaint.settlement_offered": "Oferta de solución directa",
};

export const WEEKDAYS = [
  { value: 1, short: "Lun", label: "Lunes" },
  { value: 2, short: "Mar", label: "Martes" },
  { value: 3, short: "Mié", label: "Miércoles" },
  { value: 4, short: "Jue", label: "Jueves" },
  { value: 5, short: "Vie", label: "Viernes" },
  { value: 6, short: "Sáb", label: "Sábado" },
  { value: 7, short: "Dom", label: "Domingo" },
];

export function label(map: Record<string, string>, key: string | null | undefined): string {
  if (!key) return "—";
  return map[key] ?? key;
}
