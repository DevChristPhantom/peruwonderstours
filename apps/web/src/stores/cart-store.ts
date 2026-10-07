"use client";

import { useSyncExternalStore } from "react";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

import { cartLineId, type CartLine, type CartLineInput, type Travelers } from "@/lib/cart/types";
import { safeLocalStorage } from "./safe-storage";

/**
 * Carrito de invitado (cliente). Persistido en localStorage con acceso protegido.
 * TODO(backend): sincronizar con el carrito en Redis + cookie httpOnly (carrito.md) y fusionar al iniciar sesión.
 */
interface CartState {
  lines: CartLine[];
  /** Agrega o, si ya existe el mismo tour en la misma fecha, reemplaza viajeros. Devuelve si era nuevo. */
  addLine: (input: CartLineInput) => { line: CartLine; replaced: boolean };
  updateTravelers: (id: string, travelers: Travelers) => void;
  /** Cambia fecha y/o viajeros. Si la nueva fecha coincide con otro ítem del mismo tour, lo reemplaza. */
  editLine: (id: string, patch: { date?: string; travelers?: Travelers }) => string;
  removeLine: (id: string) => { line: CartLine; index: number } | null;
  restoreLine: (line: CartLine, index: number) => void;
  clear: () => void;
}

export const CART_STORAGE_KEY = "pwt-cart";

function isValidLine(value: unknown): value is CartLine {
  if (!value || typeof value !== "object") return false;
  const v = value as Partial<CartLine>;
  return (
    typeof v.id === "string" &&
    typeof v.tourSlug === "string" &&
    typeof v.title === "string" &&
    typeof v.date === "string" &&
    /^\d{4}-\d{2}-\d{2}$/.test(v.date) &&
    !!v.travelers &&
    typeof v.travelers.adults === "number" &&
    !!v.paymentPolicy
  );
}

export const useCartStore = create<CartState>()(
  persist(
    (set, get) => ({
      lines: [],
      addLine(input) {
        const id = cartLineId(input.tourSlug, input.date);
        const existingIndex = get().lines.findIndex((l) => l.id === id);
        const line: CartLine = { ...input, id, addedAt: new Date().toISOString() };
        if (existingIndex >= 0) {
          set((s) => ({ lines: s.lines.map((l, i) => (i === existingIndex ? line : l)) }));
          return { line, replaced: true };
        }
        set((s) => ({ lines: [...s.lines, line] }));
        return { line, replaced: false };
      },
      updateTravelers(id, travelers) {
        set((s) => ({ lines: s.lines.map((l) => (l.id === id ? { ...l, travelers } : l)) }));
      },
      editLine(id, patch) {
        const current = get().lines.find((l) => l.id === id);
        if (!current) return id;
        const date = patch.date ?? current.date;
        const nextId = cartLineId(current.tourSlug, date);
        const updated: CartLine = { ...current, id: nextId, date, travelers: patch.travelers ?? current.travelers };
        set((s) => ({
          lines: s.lines.filter((l) => l.id === id || l.id !== nextId).map((l) => (l.id === id ? updated : l)),
        }));
        return nextId;
      },
      removeLine(id) {
        const index = get().lines.findIndex((l) => l.id === id);
        if (index < 0) return null;
        const line = get().lines[index];
        set((s) => ({ lines: s.lines.filter((l) => l.id !== id) }));
        return { line, index };
      },
      restoreLine(line, index) {
        set((s) => {
          if (s.lines.some((l) => l.id === line.id)) return s;
          const lines = [...s.lines];
          lines.splice(Math.min(index, lines.length), 0, line);
          return { lines };
        });
      },
      clear() {
        set({ lines: [] });
      },
    }),
    {
      name: CART_STORAGE_KEY,
      version: 1,
      storage: createJSONStorage(() => safeLocalStorage),
      partialize: (s) => ({ lines: s.lines }),
      // Se rehidrata en el cliente (CartHydrator) para no desalinear el HTML del servidor.
      skipHydration: true,
      merge: (persisted, current) => {
        const lines = (persisted as { lines?: unknown } | undefined)?.lines;
        return { ...current, lines: Array.isArray(lines) ? lines.filter(isValidLine) : [] };
      },
      migrate: () => ({ lines: [] }),
    },
  ),
);

export function useCartCount(): number {
  return useCartStore((s) => s.lines.length);
}

/** true cuando el carrito ya se leyó de localStorage (evita mostrar "vacío" antes de tiempo). */
export function useCartHydrated(): boolean {
  return useSyncExternalStore(
    (onChange) => useCartStore.persist.onFinishHydration(onChange),
    () => useCartStore.persist.hasHydrated(),
    () => false,
  );
}
