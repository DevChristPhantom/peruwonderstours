import type { Metadata } from "next";

import { RecoveryCodesForm } from "@/components/account/RecoveryCodesForm";
import { ActionForm, SubmitButton } from "@/components/forms/ActionForm";
import { Field } from "@/components/forms/Field";
import { Badge } from "@/components/ui/Badge";
import { ErrorPanel } from "@/components/ui/ErrorPanel";
import { KeyValues, PageHeader, Section, TableWrap } from "@/components/ui/Layout";
import { apiData } from "@/lib/api/client";
import type { SessionView, StaffProfileView } from "@/lib/api/types";
import { load, requireSession } from "@/lib/auth/guard";
import { ROLE_LABELS } from "@/lib/auth/permissions";
import { formatDateTime } from "@/lib/format";

import { changePasswordAction, logoutAllAction, revokeSessionAction } from "./actions";

export const metadata: Metadata = { title: "Mi cuenta" };

function device(ua: string | null): string {
  if (!ua) return "Desconocido";
  const browser = /Edg\//.test(ua) ? "Edge" : /Chrome\//.test(ua) ? "Chrome" : /Firefox\//.test(ua) ? "Firefox" : /Safari\//.test(ua) ? "Safari" : /node|undici/i.test(ua) ? "Script / servidor" : "Navegador";
  const os = /Windows/.test(ua) ? "Windows" : /Android/.test(ua) ? "Android" : /iPhone|iPad/.test(ua) ? "iOS" : /Mac OS/.test(ua) ? "macOS" : /Linux/.test(ua) ? "Linux" : "";
  return os ? `${browser} en ${os}` : browser;
}

export default async function AccountPage() {
  await requireSession();
  const [me, sessions] = await Promise.all([load(() => apiData<StaffProfileView>("/auth/staff/me")), load(() => apiData<SessionView[]>("/auth/staff/sessions"))]);

  return (
    <>
      <PageHeader title="Mi cuenta" />
      <div className="grid gap-4 xl:grid-cols-2">
        <Section title="Perfil" id="perfil">
          {me.ok ? (
            <KeyValues
              items={[
                ["Nombre", me.data.fullName],
                ["Correo", me.data.email],
                ["Rol", ROLE_LABELS[me.data.role] ?? me.data.role],
                ["Segundo factor", me.data.mfaEnabled ? "Activo" : "Pendiente"],
                ["Último ingreso", formatDateTime(me.data.lastLoginAt)],
                ["Permisos", <span key="p" className="text-xs">{me.data.permissions.join(", ")}</span>],
              ]}
            />
          ) : (
            <ErrorPanel error={me.error} />
          )}
        </Section>

        <Section title="Cambiar contraseña" id="password" description="Mínimo 12 caracteres. Cierra tus otras sesiones.">
          <ActionForm action={changePasswordAction} resetOnSuccess>
            <Field label="Contraseña actual" name="currentPassword" required>
              <input type="password" autoComplete="current-password" className="field-input" maxLength={128} />
            </Field>
            <Field label="Contraseña nueva" name="newPassword" hint="Usa una frase larga o una generada por tu gestor." required>
              <input type="password" autoComplete="new-password" className="field-input" minLength={12} maxLength={128} />
            </Field>
            <Field label="Repite la contraseña nueva" name="confirm" required>
              <input type="password" autoComplete="new-password" className="field-input" maxLength={128} />
            </Field>
            <SubmitButton variant="secondary">Cambiar contraseña</SubmitButton>
          </ActionForm>
        </Section>

        <Section
          title="Sesiones activas"
          id="sesiones"
          className="xl:col-span-2"
          actions={
            <ActionForm action={logoutAllAction} confirm="¿Cerrar todas tus sesiones, incluida esta?">
              <SubmitButton variant="danger" size="sm">
                Cerrar todas
              </SubmitButton>
            </ActionForm>
          }
        >
          {!sessions.ok ? (
            <ErrorPanel error={sessions.error} />
          ) : (
            <TableWrap label="Sesiones activas">
              <table className="data-table">
                <thead>
                  <tr>
                    <th scope="col">Dispositivo</th>
                    <th scope="col">IP</th>
                    <th scope="col">Inicio</th>
                    <th scope="col">Vence (absoluto)</th>
                    <th scope="col">
                      <span className="sr-only">Acciones</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {sessions.data.map((s) => (
                    <tr key={s.sessionId}>
                      <td>
                        {device(s.userAgent)} {s.current ? <Badge tone="success">Esta sesión</Badge> : null}
                      </td>
                      <td className="font-mono text-xs">{s.ip ?? "—"}</td>
                      <td className="whitespace-nowrap">{formatDateTime(s.createdAt)}</td>
                      <td className="whitespace-nowrap">{formatDateTime(s.absoluteExpiresAt)}</td>
                      <td>
                        {!s.current ? (
                          <ActionForm action={revokeSessionAction.bind(null, s.sessionId)} showSuccess={false}>
                            <SubmitButton variant="outline" size="sm">
                              Cerrar
                            </SubmitButton>
                          </ActionForm>
                        ) : null}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </TableWrap>
          )}
        </Section>

        <Section title="Códigos de recuperación" id="recuperacion" description="Para entrar si pierdes el teléfono. Generar nuevos invalida los anteriores.">
          <RecoveryCodesForm />
        </Section>
      </div>
    </>
  );
}
