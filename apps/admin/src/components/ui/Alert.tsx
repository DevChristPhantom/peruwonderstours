import clsx from "clsx";
import { AlertTriangle, CheckCircle2, Info, XCircle } from "lucide-react";

import type { Tone } from "@/lib/labels";

import { toneClass } from "./styles";

const ICONS = { info: Info, success: CheckCircle2, warning: AlertTriangle, danger: XCircle, neutral: Info, accent: Info };

export function Alert({
  tone = "info",
  title,
  children,
  items,
  role,
  id,
  tabIndex,
}: {
  tone?: Tone;
  title?: string;
  children?: React.ReactNode;
  items?: React.ReactNode[];
  role?: "alert" | "status";
  id?: string;
  tabIndex?: number;
}) {
  const Icon = ICONS[tone];
  return (
    <div id={id} tabIndex={tabIndex} role={role} className={clsx("flex gap-3 rounded-sm border p-3 text-sm", toneClass[tone])}>
      <Icon aria-hidden size={18} className="mt-0.5 shrink-0" />
      <div className="min-w-0 space-y-1">
        {title ? <p className="font-semibold">{title}</p> : null}
        {children ? <div>{children}</div> : null}
        {items && items.length > 0 ? (
          <ul className="list-disc space-y-0.5 pl-5">
            {items.map((item, i) => (
              <li key={i}>{item}</li>
            ))}
          </ul>
        ) : null}
      </div>
    </div>
  );
}
