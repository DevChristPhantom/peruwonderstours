/**
 * Consentimiento de cookies analíticas (Ley 29733: la analítica no es necesaria → requiere aceptación
 * previa). Sin `NEXT_PUBLIC_GA_ID` no hay analítica, ni aviso, ni scripts de terceros.
 *
 * Google Analytics 4 se carga SOLO después de "Aceptar". "Rechazar" no carga nada. La elección se guarda
 * en localStorage (`pwt-cookie-consent`), que es almacenamiento necesario: recuerda tu propia decisión.
 */

export const GA_ID = process.env.NEXT_PUBLIC_GA_ID?.trim() || null;

const STORAGE_KEY = "pwt-cookie-consent";
/** Evento para reabrir el aviso desde "Preferencias de cookies" (pie de página). */
export const OPEN_SETTINGS_EVENT = "pwt:cookie-settings";

export type Consent = "granted" | "denied";

export function readConsent(): Consent | null {
  try {
    const value = localStorage.getItem(STORAGE_KEY);
    return value === "granted" || value === "denied" ? value : null;
  } catch {
    return null;
  }
}

export function saveConsent(value: Consent): void {
  try {
    localStorage.setItem(STORAGE_KEY, value);
  } catch {
    // Navegación privada o almacenamiento bloqueado: el aviso volverá a aparecer, sin analítica.
  }
  settingsOpen = false;
  notify();
}

/* Tienda mínima para useSyncExternalStore: decisión guardada + aviso reabierto desde el pie. */
let settingsOpen = false;
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((listener) => listener());

export function subscribeConsent(listener: () => void): () => void {
  const reopen = () => {
    settingsOpen = true;
    notify();
  };
  listeners.add(listener);
  window.addEventListener(OPEN_SETTINGS_EVENT, reopen);
  return () => {
    listeners.delete(listener);
    window.removeEventListener(OPEN_SETTINGS_EVENT, reopen);
  };
}

/** Instantánea primitiva (estable entre renders): "<decisión>|<aviso abierto>". */
export function consentSnapshot(): string {
  const consent = readConsent();
  return `${consent ?? "none"}|${consent === null || settingsOpen ? "open" : "closed"}`;
}

type Gtag = (...args: unknown[]) => void;
declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: Gtag;
  }
}

/** Inserta gtag.js una sola vez. Lo inserta nuestro código: con `'strict-dynamic'` la CSP lo admite. */
export function loadAnalytics(id: string): void {
  if (window.gtag) return;
  window.dataLayer = window.dataLayer ?? [];
  // gtag.js espera el objeto `arguments`, no un array.
  window.gtag = function gtag() {
    // eslint-disable-next-line prefer-rest-params
    window.dataLayer!.push(arguments);
  };
  window.gtag("js", new Date());
  // GA4 no guarda IP completa; sin señales publicitarias ni personalización de anuncios.
  window.gtag("config", id, { allow_google_signals: false, allow_ad_personalization_signals: false });
  const script = document.createElement("script");
  script.async = true;
  script.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(id)}`;
  document.head.appendChild(script);
}

/** Al retirar el consentimiento: borra las cookies `_ga*` de este sitio (las crea gtag.js). */
export function clearAnalyticsCookies(): void {
  const host = location.hostname;
  const domains = ["", host, `.${host.replace(/^www\./, "")}`];
  for (const cookie of document.cookie.split(";")) {
    const name = cookie.split("=")[0]?.trim();
    if (!name?.startsWith("_ga")) continue;
    for (const domain of domains) {
      document.cookie = `${name}=; Max-Age=0; path=/${domain ? `; domain=${domain}` : ""}`;
    }
  }
}
