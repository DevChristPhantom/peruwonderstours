"use client";

import { ErrorView } from "@/components/errors/ErrorView";

/** Error 500 cuando falla el propio layout del sitio (p. ej. el menú): sin header ni footer. */
export default function LocaleError(props: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main id="contenido" tabIndex={-1} className="focus:outline-none">
      <ErrorView {...props} />
    </main>
  );
}
