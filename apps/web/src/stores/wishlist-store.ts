"use client";

import { useSyncExternalStore } from "react";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

import { isTourSlug, MAX_FAVORITES } from "@/lib/wishlist/share";
import { safeLocalStorage } from "./safe-storage";

/**
 * Favoritos anónimos (HU-B.A4). Solo en este navegador (localStorage protegido con try/catch).
 * Cada entrada guarda una "foto" mínima del tour (título y destinos, datos públicos del catálogo)
 * para poder mostrarlo como "Ya no disponible" con similares si se despublica.
 * TODO(E6): fusionar con la cuenta al iniciar sesión.
 */
export interface FavoriteEntry {
  slug: string;
  title: string;
  destinationSlugs: string[];
  addedAt: string;
}

interface WishlistState {
  items: FavoriteEntry[];
  toggle: (entry: Omit<FavoriteEntry, "addedAt">) => boolean;
  remove: (slug: string) => void;
  addMany: (entries: Omit<FavoriteEntry, "addedAt">[]) => number;
  clear: () => void;
}

export const WISHLIST_STORAGE_KEY = "pwt-favorites";

function isEntry(value: unknown): value is FavoriteEntry {
  if (!value || typeof value !== "object") return false;
  const v = value as Partial<FavoriteEntry>;
  return (
    typeof v.slug === "string" &&
    isTourSlug(v.slug) &&
    typeof v.title === "string" &&
    Array.isArray(v.destinationSlugs) &&
    typeof v.addedAt === "string"
  );
}

export const useWishlistStore = create<WishlistState>()(
  persist(
    (set, get) => ({
      items: [],
      toggle(entry) {
        const exists = get().items.some((i) => i.slug === entry.slug);
        if (exists) {
          set((s) => ({ items: s.items.filter((i) => i.slug !== entry.slug) }));
          return false;
        }
        set((s) => ({
          items: [{ ...entry, addedAt: new Date().toISOString() }, ...s.items].slice(0, MAX_FAVORITES),
        }));
        return true;
      },
      remove(slug) {
        set((s) => ({ items: s.items.filter((i) => i.slug !== slug) }));
      },
      addMany(entries) {
        const current = new Set(get().items.map((i) => i.slug));
        const fresh = entries
          .filter((e) => !current.has(e.slug))
          .map((e) => ({ ...e, addedAt: new Date().toISOString() }));
        if (fresh.length) set((s) => ({ items: [...s.items, ...fresh].slice(0, MAX_FAVORITES) }));
        return fresh.length;
      },
      clear() {
        set({ items: [] });
      },
    }),
    {
      name: WISHLIST_STORAGE_KEY,
      version: 1,
      storage: createJSONStorage(() => safeLocalStorage),
      partialize: (s) => ({ items: s.items }),
      // Se rehidrata en el cliente (AppProviders) para no desalinear el HTML del servidor.
      skipHydration: true,
      merge: (persisted, current) => {
        const items = (persisted as { items?: unknown } | undefined)?.items;
        return {
          ...current,
          items: Array.isArray(items) ? items.filter(isEntry).slice(0, MAX_FAVORITES) : [],
        };
      },
      migrate: () => ({ items: [] }),
    },
  ),
);

export function useWishlistHydrated(): boolean {
  return useSyncExternalStore(
    (onChange) => useWishlistStore.persist.onFinishHydration(onChange),
    () => useWishlistStore.persist.hasHydrated(),
    () => false,
  );
}

export function useIsFavorite(slug: string): boolean {
  return useWishlistStore((s) => s.items.some((i) => i.slug === slug));
}

export function useFavoritesCount(): number {
  const hydrated = useWishlistHydrated();
  const count = useWishlistStore((s) => s.items.length);
  return hydrated ? count : 0;
}

/* ---------- ¿Se puede guardar de verdad en este navegador? ---------- */

let storageProbe: boolean | null = null;

/** Prueba real de escritura (modo privado de Safari, cookies bloqueadas, cuota llena). */
export function canPersistFavorites(): boolean {
  if (storageProbe !== null) return storageProbe;
  try {
    const key = "pwt-probe";
    window.localStorage.setItem(key, "1");
    window.localStorage.removeItem(key);
    storageProbe = true;
  } catch {
    storageProbe = false;
  }
  return storageProbe;
}

const noopSubscribe = () => () => {};

/** null en el servidor; en el cliente, si los favoritos sobrevivirán al cerrar el navegador. */
export function usePersistentFavorites(): boolean | null {
  return useSyncExternalStore(noopSubscribe, canPersistFavorites, () => null);
}
