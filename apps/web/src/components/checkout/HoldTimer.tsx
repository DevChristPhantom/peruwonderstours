"use client";

import { Clock } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { useUiStore } from "@/stores/ui-store";
import { buttonClass } from "@/components/ui/button-styles";

const HOLD_SECONDS = 15 * 60;
const EXTEND_AT_SECONDS = 2 * 60;
const MAX_EXTENSIONS = 3;

function mmss(total: number): string {
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

/**
 * Temporizador honesto del bloqueo de cupos (checkout.md §3.3, WCAG 2.2.1): anuncia solo en los
 * minutos 5 y 1, permite extender 15 min hasta 3 veces. SIMULADO: el hold real lo crea el backend.
 */
export function HoldTimer() {
  const announce = useUiStore((s) => s.announce);
  const [deadline, setDeadline] = useState(() => Date.now() + HOLD_SECONDS * 1000);
  const [now, setNow] = useState(() => Date.now());
  const [extensions, setExtensions] = useState(0);
  const announced = useRef(new Set<number>());

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);

  const remaining = Math.max(0, Math.round((deadline - now) / 1000));

  useEffect(() => {
    for (const minute of [5, 1]) {
      if (remaining <= minute * 60 && remaining > 0 && !announced.current.has(minute)) {
        announced.current.add(minute);
        announce(`Quedan ${minute} ${minute === 1 ? "minuto" : "minutos"} para completar el pago.`);
      }
    }
    if (remaining === 0 && !announced.current.has(0)) {
      announced.current.add(0);
      announce("Liberamos tus cupos. Revisamos la disponibilidad otra vez.");
    }
  }, [remaining, announce]);

  const restart = () => {
    announced.current.clear();
    setDeadline(Date.now() + HOLD_SECONDS * 1000);
    setNow(Date.now());
  };

  if (remaining === 0) {
    return (
      <div className="rounded-md bg-warning-soft p-4 text-sm text-warning">
        <p>Liberamos tus cupos. Revisamos la disponibilidad otra vez… (simulado)</p>
        <button type="button" className={buttonClass("outline", "md", "mt-3")} onClick={restart}>
          Volver a guardar mis cupos
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-3 rounded-md bg-surface-muted px-4 py-3 text-sm">
      <Clock aria-hidden size={18} strokeWidth={1.5} className="text-foreground-muted" />
      <p>
        Guardamos tus cupos <span className="tabular font-semibold">{mmss(remaining)}</span> min{" "}
        <span className="text-foreground-muted">(simulado)</span>
      </p>
      {remaining <= EXTEND_AT_SECONDS && extensions < MAX_EXTENSIONS ? (
        <button
          type="button"
          className={buttonClass("outline", "md")}
          onClick={() => {
            setExtensions((n) => n + 1);
            setDeadline((d) => d + HOLD_SECONDS * 1000);
            announced.current.clear();
            announce("Extendimos el tiempo 15 minutos.");
          }}
        >
          Necesito más tiempo
        </button>
      ) : null}
    </div>
  );
}
