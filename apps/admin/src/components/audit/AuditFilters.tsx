import Link from "next/link";

import { buttonClass } from "@/components/ui/styles";

/** Tipos de entidad frecuentes en `audit_log` (sugerencias; se puede escribir otro). */
const ENTITY_TYPES = [
  "bookings",
  "payments",
  "tours",
  "rates",
  "departures",
  "complaints",
  "privacy_requests",
  "blog_posts",
  "testimonials",
  "contact_messages",
  "destinations",
  "categories",
  "users",
];

export interface AuditFilterValues {
  entityType?: string;
  entityId?: string;
  actorId?: string;
  action?: string;
  from?: string;
  to?: string;
}

/** Filtros GET de la bitácora (enlazables). Usuario: lista si se pudo cargar, si no un id. */
export function AuditFilters({ values, users }: { values: AuditFilterValues; users: { id: string; fullName: string }[] | null }) {
  return (
    <form method="get" className="mb-4 grid grid-cols-1 items-end gap-2 rounded-md border border-border bg-surface p-3 sm:grid-cols-2 lg:grid-cols-4" aria-label="Filtros de auditoría">
      <label className="text-xs font-medium">
        Entidad
        <input name="entityType" list="audit-entity-types" defaultValue={values.entityType ?? ""} maxLength={60} className="field-input mt-1" placeholder="Todas" />
        <datalist id="audit-entity-types">
          {ENTITY_TYPES.map((e) => (
            <option key={e} value={e} />
          ))}
        </datalist>
      </label>
      <label className="text-xs font-medium">
        Id de la entidad
        <input name="entityId" defaultValue={values.entityId ?? ""} maxLength={36} className="field-input mt-1 font-mono" placeholder="UUID (opcional)" />
      </label>
      <label className="text-xs font-medium">
        Usuario
        {users ? (
          <select name="actorId" defaultValue={values.actorId ?? ""} className="field-input mt-1">
            <option value="">Todos</option>
            {users.map((u) => (
              <option key={u.id} value={u.id}>
                {u.fullName}
              </option>
            ))}
          </select>
        ) : (
          <input name="actorId" defaultValue={values.actorId ?? ""} maxLength={36} className="field-input mt-1 font-mono" placeholder="UUID del usuario" />
        )}
      </label>
      <label className="text-xs font-medium">
        Acción
        <input name="action" defaultValue={values.action ?? ""} maxLength={40} className="field-input mt-1 font-mono uppercase" placeholder="PAYMENT_VOIDED_MANUAL" />
      </label>
      <label className="text-xs font-medium">
        Desde (día)
        <input type="date" name="from" defaultValue={values.from ?? ""} className="field-input mt-1" />
      </label>
      <label className="text-xs font-medium">
        Hasta (día)
        <input type="date" name="to" defaultValue={values.to ?? ""} className="field-input mt-1" />
      </label>
      <button type="submit" className={buttonClass("secondary")}>
        Filtrar
      </button>
      <Link href="/auditoria" className={buttonClass("outline")}>
        Limpiar
      </Link>
    </form>
  );
}
