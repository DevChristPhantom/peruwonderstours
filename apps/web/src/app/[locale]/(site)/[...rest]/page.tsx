import type { Metadata } from "next";
import { notFound } from "next/navigation";

// Siempre es 404: sin esto, al hidratar el navegador vuelve a poner el "index, follow" del layout.
export const metadata: Metadata = { robots: { index: false } };

/** Cualquier ruta desconocida bajo un idioma muestra el 404 con header y footer (not-found.tsx). */
export default function CatchAll() {
  notFound();
}
