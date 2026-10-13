import clsx from "clsx";

/** Variantes de botón (MASTER §7). Un solo `primary` (accent) por vista. */
export type ButtonVariant = "primary" | "secondary" | "outline" | "ghost" | "inverse" | "outline-inverse";
export type ButtonSize = "md" | "lg" | "xl";

const base =
  "pwt-button relative inline-flex items-center justify-center gap-2 rounded-md font-medium select-none " +
  "disabled:opacity-50 aria-disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2";

const variants: Record<ButtonVariant, string> = {
  primary: "bg-accent text-on-accent hover:bg-accent-hover shadow-sm",
  secondary: "bg-primary text-on-primary hover:bg-primary-hover",
  outline: "border border-border-strong bg-transparent text-foreground hover:bg-surface-muted",
  inverse: "bg-on-primary text-primary hover:bg-on-primary/90",
  "outline-inverse": "border border-on-primary/70 bg-transparent text-on-primary hover:bg-on-primary/10",
  ghost: "bg-transparent text-link hover:bg-surface-muted",
};

const sizes: Record<ButtonSize, string> = {
  md: "min-h-11 px-4 text-sm",
  lg: "min-h-12 px-5 text-body",
  xl: "min-h-14 px-6 text-body",
};

export function buttonClass(variant: ButtonVariant = "primary", size: ButtonSize = "lg", extra?: string): string {
  return clsx(base, variants[variant], sizes[size], extra);
}
