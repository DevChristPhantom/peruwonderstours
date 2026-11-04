"use client";

import { ErrorView } from "@/components/errors/ErrorView";

/** Error 500 dentro del sitio: conserva header y footer del layout. */
export default function SiteError(props: { error: Error & { digest?: string }; reset: () => void }) {
  return <ErrorView {...props} />;
}
