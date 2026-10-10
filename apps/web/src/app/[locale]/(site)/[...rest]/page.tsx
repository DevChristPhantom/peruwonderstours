import { notFound } from "next/navigation";

/** Cualquier ruta desconocida bajo un idioma muestra el 404 con header y footer (not-found.tsx). */
export default function CatchAll() {
  notFound();
}
