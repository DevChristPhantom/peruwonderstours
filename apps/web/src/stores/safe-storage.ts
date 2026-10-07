import type { StateStorage } from "zustand/middleware";

/**
 * Acceso a Web Storage tolerante a fallos (modo privado, cuota llena, cookies bloqueadas, SSR).
 * Si el storage no está disponible, la app funciona sin persistencia.
 */
function createSafeStorage(kind: "localStorage" | "sessionStorage"): StateStorage {
  const get = (): Storage | null => {
    try {
      return typeof window === "undefined" ? null : window[kind];
    } catch {
      return null;
    }
  };
  return {
    getItem(name) {
      try {
        return get()?.getItem(name) ?? null;
      } catch {
        return null;
      }
    },
    setItem(name, value) {
      try {
        get()?.setItem(name, value);
      } catch {
        /* sin persistencia */
      }
    },
    removeItem(name) {
      try {
        get()?.removeItem(name);
      } catch {
        /* sin persistencia */
      }
    },
  };
}

export const safeLocalStorage = createSafeStorage("localStorage");
export const safeSessionStorage = createSafeStorage("sessionStorage");
