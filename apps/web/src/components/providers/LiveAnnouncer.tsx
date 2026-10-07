"use client";

import { useUiStore } from "@/stores/ui-store";

/** Región aria-live global: carrito, totales, cambios de paso. */
export function LiveAnnouncer() {
  const announcement = useUiStore((s) => s.announcement);
  return (
    <div role="status" aria-live="polite" aria-atomic="true" className="sr-only">
      {announcement}
    </div>
  );
}
