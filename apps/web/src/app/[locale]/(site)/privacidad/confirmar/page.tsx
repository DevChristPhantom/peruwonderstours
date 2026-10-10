import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";

import { ApiError, apiJson } from "@/lib/api/client";

import { ConfirmForm } from "./ConfirmForm";

export const metadata: Metadata = {
  title: "Confirmar suscripción",
  robots: { index: false, follow: false },
  // El token del enlace no debe filtrarse a terceros vía Referer.
  referrer: "no-referrer",
};

type Preview = { purposes: { purpose: string; granted: boolean; pending: boolean }[] };

/** Doble opt-in de marketing (H-05): `/es/privacidad/confirmar?token=` (enlace firmado, 7 días). */
export default async function ConfirmMarketingPage({ searchParams }: PageProps<"/es/privacidad/confirmar">) {
  await connection();
  const raw = (await searchParams).token;
  const token = typeof raw === "string" && raw.length >= 20 && raw.length <= 1024 ? raw : null;

  let preview: Preview | null = null;
  let problem: string | null = token ? null : "El enlace está incompleto. Ábrelo directamente desde nuestro correo.";
  if (token) {
    try {
      preview = (await apiJson<{ data: Preview }>(`/privacy/marketing-confirmation?token=${encodeURIComponent(token)}`)).data;
    } catch (error) {
      problem =
        error instanceof ApiError && error.status === 401
          ? "El enlace venció (7 días) o no es válido. Puedes volver a suscribirte en tu próxima reserva."
          : "No pudimos cargar la solicitud en este momento. Intenta de nuevo en unos minutos.";
    }
  }
  const pending = preview?.purposes.filter((p) => p.pending && !p.granted).map((p) => p.purpose) ?? [];
  const granted = preview?.purposes.filter((p) => p.granted).length ?? 0;

  return (
    <div className="mx-auto w-full max-w-xl px-4 py-12">
      <h1 className="font-display text-h2">Confirmar suscripción</h1>
      <div className="mt-6">
        {problem ? (
          <p role="alert" className="rounded-md border border-danger bg-danger-soft p-4 text-sm text-danger">
            {problem}
          </p>
        ) : token && pending.length > 0 ? (
          <ConfirmForm token={token} pending={pending} />
        ) : (
          <p role="status" className="rounded-md border border-border bg-surface-muted p-4 text-sm">
            {granted > 0 ? "Tu suscripción ya está confirmada. No necesitas hacer nada más." : "No hay ninguna suscripción pendiente de confirmar con este enlace."}
          </p>
        )}
      </div>
      <p className="mt-8 text-sm text-foreground-muted">
        Más información en nuestra <Link href="/es/politicas/proteccion-de-datos-personales">Política de protección de datos personales</Link>.
      </p>
    </div>
  );
}
