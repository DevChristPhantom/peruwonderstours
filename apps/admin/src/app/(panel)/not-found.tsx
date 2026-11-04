import { SearchX } from "lucide-react";
import Link from "next/link";

import { buttonClass } from "@/components/ui/styles";

/** 404 dentro del panel (registro inexistente o borrado): conserva el menú lateral. */
export default function PanelNotFound() {
  return (
    <section className="mx-auto max-w-xl py-16 text-center">
      <title>No encontrado · Panel PWT</title>
      <SearchX aria-hidden size={40} strokeWidth={1.5} className="mx-auto text-foreground-muted" />
      <h1 className="mt-4 text-2xl font-semibold">No encontramos ese registro</h1>
      <p className="mt-2 text-foreground-muted">
        Puede que lo hayan eliminado o que el enlace esté incompleto. Búscalo desde su listado.
      </p>
      <div className="mt-6 flex flex-wrap justify-center gap-3">
        <Link href="/" className={buttonClass("primary", "md")}>
          Ir al tablero
        </Link>
        <Link href="/reservas" className={buttonClass("outline", "md")}>
          Ver reservas
        </Link>
      </div>
    </section>
  );
}
