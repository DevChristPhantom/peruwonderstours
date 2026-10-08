"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import dynamic from "next/dynamic";
import { useEffect, useState, type ReactNode } from "react";

import { CART_STORAGE_KEY, useCartStore } from "@/stores/cart-store";
import { useCompareStore } from "@/stores/compare-store";
import { useWishlistStore, WISHLIST_STORAGE_KEY } from "@/stores/wishlist-store";
import { LiveAnnouncer } from "./LiveAnnouncer";
import { Toaster } from "@/components/ui/Toaster";

// Carga diferida: GSAP/Lenis y el drawer no bloquean la hidratación inicial.
const MotionEffects = dynamic(() => import("@/components/motion/MotionEffects"), { ssr: false });
const CartDrawer = dynamic(() => import("@/components/cart/CartDrawer"), { ssr: false });

function CartHydrator() {
  useEffect(() => {
    void useCartStore.persist.rehydrate();
    void useWishlistStore.persist.rehydrate();
    void useCompareStore.persist.rehydrate();
    // Otra pestaña cambió el carrito o los favoritos: se vuelve a leer.
    const onStorage = (e: StorageEvent) => {
      if (e.key === CART_STORAGE_KEY) void useCartStore.persist.rehydrate();
      if (e.key === WISHLIST_STORAGE_KEY) void useWishlistStore.persist.rehydrate();
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);
  return null;
}

export function AppProviders({ children }: { children: ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: { staleTime: 60_000, refetchOnWindowFocus: false, retry: 1 },
          mutations: { retry: 0 },
        },
      }),
  );

  return (
    <QueryClientProvider client={queryClient}>
      {children}
      <CartHydrator />
      <LiveAnnouncer />
      <Toaster />
      <CartDrawer />
      <MotionEffects />
    </QueryClientProvider>
  );
}
