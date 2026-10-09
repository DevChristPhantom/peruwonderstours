import type { UserError } from "@/lib/api/errors";

import { Alert } from "./Alert";

/** Error de carga de una página (403 incluido: la API decide, el panel solo lo explica). */
export function ErrorPanel({ error }: { error: UserError }) {
  const forbidden = error.status === 403;
  return (
    <Alert tone={forbidden ? "warning" : "danger"} title={forbidden ? "Sin permiso" : "No se pudo cargar"} role="alert" items={error.items}>
      {error.message}
    </Alert>
  );
}
