"use client";

import { X } from "lucide-react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";

import { useUiStore } from "@/stores/ui-store";

/**
 * Toast único (carrito.md / MASTER §6.3): 5–8 s, se pausa con hover o foco (WCAG 2.2.1),
 * acción opcional ("Ver carrito", "Deshacer").
 */
export function Toaster() {
  const toast = useUiStore((s) => s.toast);
  const dismiss = useUiStore((s) => s.dismissToast);
  const t = useTranslations("toast");
  const [paused, setPaused] = useState(false);
  const remaining = useRef(0);
  const startedAt = useRef(0);

  useEffect(() => {
    if (!toast) return;
    remaining.current = toast.duration;
  }, [toast]);

  useEffect(() => {
    if (!toast || paused) return;
    startedAt.current = Date.now();
    const id = window.setTimeout(dismiss, remaining.current);
    return () => {
      window.clearTimeout(id);
      remaining.current = Math.max(1000, remaining.current - (Date.now() - startedAt.current));
    };
  }, [toast, paused, dismiss]);

  return (
    <div
      role="region"
      aria-label={t("region")}
      aria-live="polite"
      className="pointer-events-none fixed inset-x-0 bottom-4 z-[60] flex justify-center px-4 lg:justify-end lg:px-8"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      {toast ? (
        <div
          key={toast.id}
          onMouseEnter={() => setPaused(true)}
          onMouseLeave={() => setPaused(false)}
          onFocus={() => setPaused(true)}
          onBlur={() => setPaused(false)}
          className="pwt-toast pointer-events-auto flex w-full max-w-md items-center gap-3 rounded-lg border border-border bg-surface py-2 pr-2 pl-4 text-foreground shadow-lg"
        >
          <p className="flex-1 py-2 text-sm">{toast.message}</p>
          {toast.action?.href ? (
            <Link
              href={toast.action.href}
              onClick={dismiss}
              className="inline-flex min-h-11 items-center rounded-sm px-3 text-sm font-medium text-link underline underline-offset-2"
            >
              {toast.action.label}
            </Link>
          ) : toast.action?.onAction ? (
            <button
              type="button"
              onClick={() => {
                toast.action?.onAction?.();
                dismiss();
              }}
              className="inline-flex min-h-11 items-center rounded-sm px-3 text-sm font-medium text-link underline underline-offset-2"
            >
              {toast.action.label}
            </button>
          ) : null}
          <button
            type="button"
            onClick={dismiss}
            aria-label={t("close")}
            className="inline-flex size-11 items-center justify-center rounded-sm text-foreground-muted hover:text-foreground"
          >
            <X aria-hidden size={18} strokeWidth={1.5} />
          </button>
        </div>
      ) : null}
    </div>
  );
}
