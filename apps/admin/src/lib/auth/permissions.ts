/**
 * Permisos del backoffice (copia de `apps/api/src/modules/identity/domain/permissions.ts`).
 * El panel solo los usa para OCULTAR menú y botones; la autorización real la hace la API (403).
 */
export const PERMISSIONS = [
  "dashboard:read",
  "tours:read",
  "tours:write",
  "tours:publish",
  "pricing:read",
  "pricing:write",
  "departures:read",
  "departures:write",
  "bookings:read",
  "bookings:cancel",
  "bookings:resend-voucher",
  "payments:record",
  "payments:refund",
  "complaints:read",
  "complaints:respond",
  "complaints:manage",
  "privacy:read",
  "privacy:manage",
  "users:manage",
  "audit:read",
  // Sprint 3: contenido, bandeja de contacto, medios y anulación de pagos (solo admin, ADR-0003).
  "content:read",
  "content:write",
  "content:publish",
  "contact:read",
  "contact:manage",
  "media:upload",
  "payments:void",
] as const;
export type Permission = (typeof PERMISSIONS)[number];

export const ROLE_LABELS: Record<string, string> = {
  admin: "Administrador",
  operator: "Operaciones",
  agent: "Asesor de ventas",
};
