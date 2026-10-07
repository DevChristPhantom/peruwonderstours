"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import dynamic from "next/dynamic";
import { useEffect, useState, type ReactNode } from "react";

import { useCartStore } from "@/stores/cart-store";
import { LiveAnnouncer } from "./LiveAnnouncer";
import { Toaster } from "@/components/ui/Toaster";

// Carga diferida: GSAP/Lenis y el drawer no bloquean la hidratación inicial.
const MotionEffects = dynamic(() => import("@/components/motion/MotionEffects"), { ssr: false });
const CartDrawer = dynamic(() => import("@/components/cart/CartDrawer"), { ssr: false });

function CartHydrator() {
  useEffect(() => {
    void useCartStore.persist.rehydrate();
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
