import type { Metadata } from "next";

import { ActionForm, SubmitButton } from "@/components/forms/ActionForm";
import { CreateUserForm, ResetPasswordButton } from "@/components/users/TempPasswordForms";
import { Alert } from "@/components/ui/Alert";
import { Badge } from "@/components/ui/Badge";
import { ErrorPanel } from "@/components/ui/ErrorPanel";
import { PageHeader, Section } from "@/components/ui/Layout";
import { apiData } from "@/lib/api/client";
import type { StaffUserSummary } from "@/lib/api/types";
import { can, load, requireSession } from "@/lib/auth/guard";
import { ROLE_LABELS } from "@/lib/auth/permissions";
import { formatDateTime } from "@/lib/format";
import { USER_STATUS } from "@/lib/labels";

import { resetMfaAction, revokeUserSessionsAction, unlockUserAction, updateUserAction } from "./actions";

export const metadata: Metadata = { title: "Usuarios" };

/** Bloqueo vigente (la API fija `lockedUntil`; puede haber vencido). */
function isLocked(lockedUntil: string | null): boolean {
  return lockedUntil !== null && Date.parse(lockedUntil) > Date.now();
}

export default async function UsersPage() {
  const session = await requireSession();
  if (!can(session, "users:manage")) {
    return (
      <>
        <PageHeader title="Usuarios" />
        <Alert tone="warning" title="Sin permiso">
          Solo los administradores gestionan usuarios del staff.
        </Alert>
      </>
    );
  }
  const result = await load(() => apiData<StaffUserSummary[]>("/admin/users"));

  return (
    <>
      <PageHeader title="Usuarios del staff" description="Roles: administrador (todo), operaciones (catálogo, reservas, reclamos) y asesor de ventas (consulta y pagos)." />
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="min-w-0 space-y-3">
          {!result.ok ? (
            <ErrorPanel error={result.error} />
          ) : (
            result.data.map((u) => {
              const self = u.id === session.user.id;
              const locked = isLocked(u.lockedUntil);
              return (
                <article key={u.id} className="rounded-md border border-border bg-surface p-3" aria-label={u.fullName}>
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <h2 className="font-semibold">
                        {u.fullName} {self ? <span className="text-xs font-normal text-foreground-muted">(tú)</span> : null}
                      </h2>
                      <p className="text-xs text-foreground-muted">
                        {u.email} · último ingreso {formatDateTime(u.lastLoginAt)} · alta {formatDateTime(u.createdAt)}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-1">
                      <Badge tone="info">{ROLE_LABELS[u.role] ?? u.role}</Badge>
                      <Badge tone={USER_STATUS[u.status]?.tone ?? "neutral"}>{USER_STATUS[u.status]?.label ?? u.status}</Badge>
                      {u.mfaEnabled ? <Badge tone="success">MFA activo</Badge> : <Badge tone="warning">MFA pendiente</Badge>}
                      {locked ? <Badge tone="danger">Bloqueado hasta {formatDateTime(u.lockedUntil)}</Badge> : null}
                      {u.failedLoginCount > 0 ? <Badge>{u.failedLoginCount} intentos fallidos</Badge> : null}
                    </div>
                  </div>
                  {self ? (
                    <p className="mt-2 text-xs text-foreground-muted">No puedes cambiar tu propio rol ni estado. Gestiona tu cuenta en «Mi cuenta».</p>
                  ) : (
                    <div className="mt-3 flex flex-wrap items-start gap-3">
                      <ActionForm action={updateUserAction.bind(null, u.id, u.version)} className="flex flex-wrap items-end gap-2 space-y-0">
                        <label className="text-xs font-medium">
                          Rol
                          <select name="role" defaultValue={u.role} className="field-input mt-1 min-h-9 py-1">
                            <option value="agent">Asesor de ventas</option>
                            <option value="operator">Operaciones</option>
                            <option value="admin">Administrador</option>
                          </select>
                        </label>
                        <label className="text-xs font-medium">
                          Estado
                          <select name="status" defaultValue={u.status} className="field-input mt-1 min-h-9 py-1">
                            <option value="active">Activo</option>
                            <option value="suspended">Suspendido</option>
                            <option value="disabled">Deshabilitado</option>
                          </select>
                        </label>
                        <SubmitButton variant="outline" size="sm">
                          Guardar
                        </SubmitButton>
                      </ActionForm>
                      <div className="flex flex-wrap gap-2">
                        {locked || u.failedLoginCount > 0 ? (
                          <ActionForm action={unlockUserAction.bind(null, u.id)}>
                            <SubmitButton variant="outline" size="sm">
                              Desbloquear
                            </SubmitButton>
                          </ActionForm>
                        ) : null}
                        <ActionForm action={revokeUserSessionsAction.bind(null, u.id)} confirm={`¿Cerrar todas las sesiones de ${u.fullName}?`}>
                          <SubmitButton variant="outline" size="sm">
                            Cerrar sesiones
                          </SubmitButton>
                        </ActionForm>
                        <ActionForm action={resetMfaAction.bind(null, u.id)} confirm={`¿Reiniciar el segundo factor de ${u.fullName}? Deberá volver a enrolarlo.`}>
                          <SubmitButton variant="outline" size="sm">
                            Reiniciar MFA
                          </SubmitButton>
                        </ActionForm>
                        <ResetPasswordButton id={u.id} email={u.email} />
                      </div>
                    </div>
                  )}
                </article>
              );
            })
          )}
        </div>
        <Section title="Nuevo usuario" id="nuevo" description="Se genera una contraseña temporal; en su primer ingreso activará el segundo factor.">
          <CreateUserForm />
        </Section>
      </div>
    </>
  );
}
