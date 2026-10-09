"use client";

import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

import { isTourSlug } from "@/lib/wishlist/share";
import { safeSessionStorage } from "./safe-storage";

/** Comparador de tours (HU-B.A8): hasta 3, por pestaña (sessionStorage). */
export const MAX_COMPARE = 3;

export interface CompareEntry {
  slug: string;
  title: string;
}

interface CompareState {
  items: CompareEntry[];
  /** "added" | "removed" | "full" (ya hay 3). */
  toggle: (entry: CompareEntry) => "added" | "removed" | "full";
  remove: (slug: string) => void;
  clear: () => void;
}

export const useCompareStore = create<CompareState>()(
  persist(
    (set, get) => ({
      items: [],
      toggle(entry) {
        const items = get().items;
        if (items.some((i) => i.slug === entry.slug)) {
          set({ items: items.filter((i) => i.slug !== entry.slug) });
          return "removed";
        }
        if (items.length >= MAX_COMPARE) return "full";
        set({ items: [...items, entry] });
        return "added";
      },
      remove(slug) {
        set((s) => ({ items: s.items.filter((i) => i.slug !== slug) }));
      },
      clear() {
        set({ items: [] });
      },
    }),
    {
      name: "pwt-compare",
      version: 1,
      storage: createJSONStorage(() => safeSessionStorage),
      partialize: (s) => ({ items: s.items }),
      skipHydration: true,
      merge: (persisted, current) => {
        const items = (persisted as { items?: unknown } | undefined)?.items;
        const valid = Array.isArray(items)
          ? items.filter(
              (i): i is CompareEntry =>
                !!i && typeof i === "object" && typeof i.slug === "string" && isTourSlug(i.slug) && typeof i.title === "string",
            )
          : [];
        return { ...current, items: valid.slice(0, MAX_COMPARE) };
      },
    },
  ),
);
