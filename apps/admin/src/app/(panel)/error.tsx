"use client";

import { RotateCw, TriangleAlert } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { startTransition, useEffect } from "react";

import { buttonClass } from "@/components/ui/styles";

/**
 * Error 500 dentro del panel (p. ej. la API no responde). Mantiene el menú para seguir trabajando
 * en otra sección; el `digest` permite ubicar el error en los logs del servidor.
 */
export default function PanelError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const router = useRouter();
  useEffect(() => console.error(error), [error]);
  const retry = () =>
    startTransition(() => {
      router.refresh();
      reset();
    });
  return (
    <section className="mx-auto max-w-xl py-16 text-center" role="alert">
      <TriangleAlert aria-hidden size={40} strokeWidth={1.5} className="mx-auto text-foreground-muted" />
      <h1 className="mt-4 text-2xl font-semibold">No pudimos cargar esta sección</h1>
      <p className="mt-2 text-foreground-muted">
        Puede ser un corte momentáneo de la conexión con el servidor. Tus cambios guardados no se perdieron.
      </p>
      <div className="mt-6 flex flex-wrap justify-center gap-3">
        <button type="button" onClick={retry} className={buttonClass("primary", "md")}>
          <RotateCw aria-hidden size={16} /> Intentar de nuevo
        </button>
        <Link href="/" className={buttonClass("outline", "md")}>
          Ir al tablero
        </Link>
      </div>
      {error.digest ? (
        <p className="mt-6 font-mono text-xs text-foreground-muted">Código para soporte: {error.digest}</p>
      ) : null}
    </section>
  );
}
