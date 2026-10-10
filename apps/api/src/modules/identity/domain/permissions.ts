/**
 * RBAC del backoffice: los guards exigen PERMISOS, no roles. El rol solo agrupa permisos.
 * Roles del enum `user_role`: admin, operator (operaciones), agent (asesor de ventas).
 * [A VALIDAR con el cliente: roles adicionales "contador" y "editor de contenido" (HU-7.7).]
 */
export const STAFF_ROLES = ['admin', 'operator', 'agent'] as const;
export type StaffRole = (typeof STAFF_ROLES)[number];

export const PERMISSIONS = [
  'dashboard:read',
  'tours:read',
  'tours:write',
  'tours:publish',
  'pricing:read',
  'pricing:write',
  'departures:read',
  'departures:write',
  'bookings:read',
  'bookings:cancel',
  'bookings:resend-voucher',
  'payments:record',
  'payments:refund',
  'complaints:read',
  'complaints:respond',
  'complaints:manage',
  'privacy:read',
  'privacy:manage',
  'users:manage',
  'audit:read',
  // Sprint 3
  'content:read',
  'content:write',
  'content:publish',
  'contact:read',
  'contact:manage',
  'media:upload',
  /** Anular pagos manuales con contra-asiento: SOLO admin (ADR-0003). */
  'payments:void',
] as const;
export type Permission = (typeof PERMISSIONS)[number];

const ALL: readonly Permission[] = PERMISSIONS;

export const ROLE_PERMISSIONS: Readonly<Record<StaffRole, readonly Permission[]>> = {
  admin: ALL,
  operator: [
    'dashboard:read',
    'tours:read',
    'tours:write',
    'tours:publish',
    'pricing:read',
    'pricing:write',
    'departures:read',
    'departures:write',
    'bookings:read',
    'bookings:cancel',
    'bookings:resend-voucher',
    'payments:record',
    'payments:refund',
    'complaints:read',
    'complaints:respond',
    'complaints:manage',
    'privacy:read',
    'content:read',
    'content:write',
    'content:publish',
    'contact:read',
    'contact:manage',
    'media:upload',
  ],
  agent: [
    'dashboard:read',
    'tours:read',
    'pricing:read',
    'departures:read',
    'bookings:read',
    'bookings:resend-voucher',
    'payments:record',
    'complaints:read',
    'content:read',
    'contact:read',
  ],
};

export function permissionsFor(role: StaffRole): ReadonlySet<Permission> {
  return new Set(ROLE_PERMISSIONS[role]);
}

export function hasAllPermissions(granted: ReadonlySet<Permission>, required: readonly Permission[]): boolean {
  return required.every((p) => granted.has(p));
}

export function isStaffRole(value: unknown): value is StaffRole {
  return typeof value === 'string' && (STAFF_ROLES as readonly string[]).includes(value);
}
