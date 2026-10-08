/**
 * Registro de acciones de aplicación en `audit_log` (append-only). Complementa los triggers
 * de fila de PostgreSQL con acciones semánticas (LOGIN, TOUR_PUBLISH, BOOKING_CANCEL...).
 * Nunca incluir PII directa, secretos ni tokens en `before`/`after`.
 */
export type AuditActorType = 'system' | 'customer' | 'user' | 'webhook';

export interface AuditEntry {
  actorType: AuditActorType;
  actorId: string | null;
  /** Tabla o agregado: users, auth_sessions, tours, bookings, complaints... */
  entityType: string;
  /** UUID de la entidad (la columna es uuid). */
  entityId: string | null;
  /** Acción en MAYÚSCULAS_CON_GUION_BAJO, máx. 40 caracteres. */
  action: string;
  changedFields?: string[];
  before?: Record<string, unknown> | null;
  after?: Record<string, unknown> | null;
  requestId?: string | null;
  ip?: string | null;
  occurredAt: Date;
}

export interface AuditTrail {
  record(entry: AuditEntry): Promise<void>;
}

/** Datos de la petición que acompañan a las acciones del staff. */
export interface RequestMeta {
  ip: string | null;
  userAgent: string | null;
  requestId: string | null;
}

/** Convierte bigint/Date a valores JSON para `before`/`after`. */
export function auditJson(value: Record<string, unknown> | null | undefined): Record<string, unknown> | null {
  if (!value) return null;
  return JSON.parse(JSON.stringify(value, (_k, v: unknown) => (typeof v === 'bigint' ? v.toString() : v))) as Record<string, unknown>;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** La columna entity_id es uuid: los valores que no lo son se descartan. */
export function auditEntityId(id: string | null | undefined): string | null {
  return id && UUID.test(id) ? id : null;
}

/** IP válida para la columna inet (Express puede dar "::ffff:127.0.0.1"). */
export function auditIp(ip: string | null | undefined): string | null {
  if (!ip) return null;
  const v = ip.trim();
  return /^[0-9a-fA-F:.]+$/.test(v) && v.length <= 45 ? v : null;
}
