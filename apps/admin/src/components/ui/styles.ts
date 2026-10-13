import clsx from "clsx";

import type { Tone } from "@/lib/labels";

export type ButtonVariant = "primary" | "secondary" | "outline" | "ghost" | "danger";
export type ButtonSize = "md" | "sm";

/** Botones del panel (MASTER §7, versión densa). `primary` = CTA terracota: uno por vista. */
export function buttonClass(variant: ButtonVariant = "outline", size: ButtonSize = "md", extra?: string): string {
  return clsx(
    "admin-button inline-flex cursor-pointer items-center justify-center gap-2 rounded-sm font-medium whitespace-nowrap no-underline",
    "disabled:cursor-not-allowed disabled:opacity-50 aria-disabled:opacity-50",
    size === "md" ? "min-h-11 px-4 text-sm" : "min-h-9 px-3 text-sm",
    {
      "bg-accent text-on-accent hover:bg-accent-hover": variant === "primary",
      "bg-primary text-on-primary hover:bg-primary-hover": variant === "secondary",
      "border border-border-strong bg-surface text-foreground hover:bg-surface-muted": variant === "outline",
      "text-link hover:bg-surface-muted": variant === "ghost",
      "border border-danger bg-surface text-danger hover:bg-danger-soft": variant === "danger",
    },
    extra,
  );
}

export const toneClass: Record<Tone, string> = {
  neutral: "bg-surface-muted text-foreground border-border",
  info: "bg-surface-muted text-primary border-primary",
  success: "bg-success-soft text-success border-success",
  warning: "bg-warning-soft text-warning border-warning",
  danger: "bg-danger-soft text-danger border-danger",
  accent: "bg-accent-soft text-on-accent-soft border-accent",
};
