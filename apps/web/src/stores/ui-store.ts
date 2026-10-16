"use client";

import { create } from "zustand";

export interface ToastAction {
  label: string;
  /** Navega a una ruta… */
  href?: string;
  /** …o ejecuta una acción (p. ej. Deshacer). */
  onAction?: () => void;
}

export interface Toast {
  id: number;
  message: string;
  action?: ToastAction;
  /** ms; se pausa con hover/foco (WCAG 2.2.1). */
  duration: number;
}

interface UiState {
  cartDrawerOpen: boolean;
  /** Elemento al que vuelve el foco al cerrar el drawer. */
  cartDrawerReturnFocus: HTMLElement | null;
  toast: Toast | null;
  /** Mensaje para la región aria-live global. */
  announcement: string;
  /** Se incrementa al agregar al carrito: dispara el pulso del ícono. */
  cartPulse: number;
  openCartDrawer: (returnFocus?: HTMLElement | null) => void;
  closeCartDrawer: () => void;
  showToast: (toast: Omit<Toast, "id" | "duration"> & { duration?: number }) => void;
  dismissToast: () => void;
  announce: (message: string) => void;
  pulseCart: () => void;
  /**
   * Rutas equivalentes de la página actual en cada idioma (selector de idioma). Las fijan las páginas
   * con slugs traducidos (tour, destino, categoría, blog); null = se calcula desde la ruta.
   */
  localeAlternates: { es: string; en: string; pt: string } | null;
  setLocaleAlternates: (value: { es: string; en: string; pt: string } | null) => void;
}

let toastSeq = 0;

export const useUiStore = create<UiState>()((set) => ({
  cartDrawerOpen: false,
  cartDrawerReturnFocus: null,
  toast: null,
  announcement: "",
  cartPulse: 0,
  openCartDrawer: (returnFocus = null) => set({ cartDrawerOpen: true, cartDrawerReturnFocus: returnFocus }),
  closeCartDrawer: () => set({ cartDrawerOpen: false }),
  showToast: ({ duration = 5000, ...toast }) => set({ toast: { ...toast, duration, id: ++toastSeq } }),
  dismissToast: () => set({ toast: null }),
  // Se vacía y se vuelve a fijar para que los lectores de pantalla repitan mensajes iguales.
  announce: (message) => {
    set({ announcement: "" });
    setTimeout(() => set({ announcement: message }), 50);
  },
  pulseCart: () => set((s) => ({ cartPulse: s.cartPulse + 1 })),
  localeAlternates: null,
  setLocaleAlternates: (localeAlternates) => set({ localeAlternates }),
}));
