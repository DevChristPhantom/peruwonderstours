"use client";

import { useEffect, useRef, type ReactNode } from "react";

/** Inclinación máxima en grados (sutil: la tarjeta no debe salirse de su área de clic). */
const MAX_TILT = 7;

/**
 * Envuelve una tarjeta y escribe en ella las variables CSS del efecto de profundidad
 * (`DestinationCard.module.css`): inclinación, brillo y paralaje de la foto según el puntero.
 * Solo con puntero fino y sin movimiento reducido; una actualización por frame (rAF) y limpieza
 * de listeners al desmontar. Al salir el puntero vuelve al estado neutro.
 */
export function TiltCard({ className, children }: { className: string; children: ReactNode }) {
  const ref = useRef<HTMLElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const media = window.matchMedia("(hover: hover) and (pointer: fine) and (prefers-reduced-motion: no-preference)");
    let frame = 0;
    let pending: { x: number; y: number } | null = null;

    const apply = () => {
      frame = 0;
      if (!pending) return;
      const { x, y } = pending;
      el.style.setProperty("--rx", `${(-y * MAX_TILT).toFixed(2)}deg`);
      el.style.setProperty("--ry", `${(x * MAX_TILT).toFixed(2)}deg`);
      el.style.setProperty("--px", x.toFixed(3));
      el.style.setProperty("--py", y.toFixed(3));
      el.style.setProperty("--mx", `${((x + 1) * 50).toFixed(1)}%`);
      el.style.setProperty("--my", `${((y + 1) * 50).toFixed(1)}%`);
    };

    const onMove = (event: PointerEvent) => {
      if (!media.matches || event.pointerType !== "mouse") return;
      const r = el.getBoundingClientRect();
      // -1…1 desde el centro de la tarjeta.
      pending = { x: ((event.clientX - r.left) / r.width) * 2 - 1, y: ((event.clientY - r.top) / r.height) * 2 - 1 };
      if (!frame) frame = requestAnimationFrame(apply);
    };

    const onLeave = () => {
      pending = null;
      if (frame) cancelAnimationFrame(frame);
      frame = 0;
      for (const name of ["--rx", "--ry", "--px", "--py", "--mx", "--my"]) el.style.removeProperty(name);
    };

    el.addEventListener("pointermove", onMove);
    el.addEventListener("pointerleave", onLeave);
    return () => {
      el.removeEventListener("pointermove", onMove);
      el.removeEventListener("pointerleave", onLeave);
      if (frame) cancelAnimationFrame(frame);
    };
  }, []);

  return (
    <article ref={ref} className={className}>
      {children}
    </article>
  );
}
