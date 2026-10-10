/**
 * Silueta original de los Andes (SVG en línea, decorativa). Tres planos de cordillera con los colores
 * del logo vía variables CSS: terracota al frente y titicaca al fondo. Sin animación (no distrae ni
 * afecta CLS: el alto es fijo por el viewBox).
 */
export function AndesSkyline({ className }: { className?: string }) {
  return (
    <svg
      aria-hidden
      focusable="false"
      viewBox="0 0 1440 120"
      preserveAspectRatio="none"
      className={className}
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* Plano lejano: cumbres nevadas suaves. */}
      <path
        d="M0 120V78l70-30 60 22 85-46 70 36 55-20 90 50 80-58 95 44 60-18 75 34 90-62 85 52 70-26 90 40 75-30 85 38 80-44 70 30 60-16 50 20L1440 92V120z"
        fill="var(--pwt-titicaca-800)"
        opacity="0.55"
      />
      {/* Plano medio. */}
      <path
        d="M0 120V92l90-26 70 18 100-40 85 34 70-14 95 30 110-44 80 30 90-12 100 28 95-36 85 26 75-10 110 32 90-24 75 16 25 4L1440 104V120z"
        fill="var(--pwt-titicaca-800)"
      />
      {/* Plano cercano: línea de terracota que marca el horizonte. */}
      <path
        d="M0 120v-14l120-12 110 8 140-18 120 14 130-10 150 16 140-14 120 10 160-12 130 12 120-6v26z"
        fill="var(--pwt-terracota-600)"
      />
    </svg>
  );
}
