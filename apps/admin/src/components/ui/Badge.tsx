import clsx from "clsx";

import type { Tone } from "@/lib/labels";

import { toneClass } from "./styles";

/** Insignia de estado: el color nunca es la única señal (siempre lleva texto). */
export function Badge({ tone = "neutral", children, title }: { tone?: Tone; children: React.ReactNode; title?: string }) {
  return (
    <span title={title} className={clsx("inline-flex items-center gap-1 rounded-xs border px-2 py-0.5 text-xs font-medium whitespace-nowrap", toneClass[tone])}>
      {children}
    </span>
  );
}
