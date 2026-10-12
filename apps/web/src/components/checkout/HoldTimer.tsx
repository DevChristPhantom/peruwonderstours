"use client";

import { Clock } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";

import { useUiStore } from "@/stores/ui-store";

function mmss(total: number): string {
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

/**
 * Temporizador del bloqueo REAL de cupos (`holdExpiresAt` de la reserva en la API).
 * Anuncia solo en los minutos 5 y 1 (checkout.md §3.3). La API no permite extender el hold:
 * es un límite de tiempo real ligado al inventario (excepción de WCAG 2.2.1); al vencer se
 * explica qué pasó y cómo seguir.
 */
export function HoldTimer({ expiresAt, onExpire }: { expiresAt: string; onExpire?: () => void }) {
  const t = useTranslations("checkout.hold");
  const announce = useUiStore((s) => s.announce);
  const deadline = new Date(expiresAt).getTime();
  const [now, setNow] = useState(() => Date.now());
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
        announce(t("minutesLeft", { count: minute }));
      }
    }
    if (remaining === 0 && !announced.current.has(0)) {
      announced.current.add(0);
      announce(t("expiredShort"));
      onExpire?.();
    }
  }, [remaining, announce, onExpire, t]);

  if (remaining === 0) {
    return (
      <p className="rounded-md bg-warning-soft p-4 text-sm text-warning">
        {t("expired")}
      </p>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-3 rounded-md bg-surface-muted px-4 py-3 text-sm">
      <Clock aria-hidden size={18} strokeWidth={1.5} className="text-foreground-muted" />
      <p>
        {t.rich("holding", { time: mmss(remaining), strong: (chunks) => <span className="tabular font-semibold">{chunks}</span> })}
      </p>
    </div>
  );
}
