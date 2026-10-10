import type { Metadata } from "next";
import { connection } from "next/server";

import { Link } from "@/i18n/navigation";
import { ApiError, apiJson } from "@/lib/api/client";

import { UnsubscribeForm } from "./UnsubscribeForm";

export const metadata: Metadata = {
  title: "Darse de baja de comunicaciones",
  robots: { index: false, follow: false },
  // El token del enlace no debe filtrarse a terceros vía Referer.
  referrer: "no-referrer",
};

type Preview = { purposes: { purpose: string; granted: boolean }[] };

/**
 * Baja de marketing con el enlace firmado de los correos (`/es/privacidad/baja?token=`).
 * La consulta y la baja pasan por el servidor de Next (el navegador nunca llama a la API).
 */
export default async function UnsubscribePage({ searchParams }: PageProps<"/[locale]/privacidad/baja">) {
  await connection();
  const raw = (await searchParams).token;
  const token = typeof raw === "string" && raw.length >= 20 && raw.length <= 1024 ? raw : null;

  let preview: Preview | null = null;
  let problem: string | null = token ? null : "El enlace de baja está incompleto. Ábrelo directamente desde nuestro correo.";
  if (token) {
    try {
      preview = (await apiJson<{ data: Preview }>(`/privacy/unsubscribe?token=${encodeURIComponent(token)}`)).data;
    } catch (error) {
      problem =
        error instanceof ApiError && error.status === 401
          ? "El enlace de baja no es válido o fue modificado. Usa el enlace más reciente de nuestros correos."
          : "No pudimos cargar tus preferencias en este momento. Intenta de nuevo en unos minutos.";
    }
  }

  return (
    <div className="mx-auto w-full max-w-xl px-4 py-12">
      <h1 className="font-display text-h2">Darse de baja</h1>
      <p className="mt-2 text-foreground-muted">
        Puedes dejar de recibir comunicaciones comerciales cuando quieras, gratis y al instante (Ley 29733 de Protección de Datos Personales).
      </p>
      <div className="mt-6">
        {problem ? (
          <p role="alert" className="rounded-md border border-danger bg-danger-soft p-4 text-sm text-danger">
            {problem}
          </p>
        ) : preview && token ? (
          <UnsubscribeForm token={token} purposes={preview.purposes} />
        ) : null}
      </div>
      <p className="mt-8 text-sm text-foreground-muted">
        Más información en nuestra <Link href="/politicas/proteccion-de-datos-personales">Política de protección de datos personales</Link>.
      </p>
    </div>
  );
}
