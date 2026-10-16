"use client";

import { CloudDownload, Info, Smartphone, WifiOff } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";

import { useFormat } from "@/hooks/useFormat";
import { bookingPath } from "@/i18n/paths";
import { safeLocalStorage } from "@/stores/safe-storage";
import { buttonClass } from "@/components/ui/button-styles";

/** Lo que se compara entre visitas para avisar cambios (sin datos personales). */
export interface VoucherSnapshot {
  /** Estado de la API (`paid`, `confirmed`…): se traduce al mostrarlo, así no depende del idioma. */
  status: string;
  items: { id: string; title: string; date: string; pax: number }[];
}

interface VoucherOfflineProps {
  code: string;
  /** Momento en que el servidor generó esta página (ISO). */
  renderedAt: string;
  snapshot: VoucherSnapshot;
  /** Solo las reservas confirmadas se guardan solas al visitarlas. */
  autoSave: boolean;
}

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

type SaveState = { kind: "idle" } | { kind: "saving" } | { kind: "saved"; at: string | null; stale?: boolean } | { kind: "error" };

const SW_URL = "/sw-voucher.js";

type Translate = ReturnType<typeof useTranslations<"voucher">>;

function subscribeOnline(cb: () => void) {
  window.addEventListener("online", cb);
  window.addEventListener("offline", cb);
  return () => {
    window.removeEventListener("online", cb);
    window.removeEventListener("offline", cb);
  };
}

function useOnline(): boolean {
  return useSyncExternalStore(subscribeOnline, () => navigator.onLine, () => true);
}

const noopSubscribe = () => () => {};
const swSupported = () => "serviceWorker" in navigator && window.isSecureContext;
const iosBrowser = () =>
  /iPhone|iPad|iPod/.test(navigator.userAgent) && !window.matchMedia("(display-mode: standalone)").matches;

function collectAssets(): string[] {
  const urls = new Set<string>();
  for (const entry of performance.getEntriesByType("resource")) urls.add(entry.name);
  document.querySelectorAll<HTMLScriptElement>("script[src]").forEach((s) => urls.add(s.src));
  document.querySelectorAll<HTMLLinkElement>("link[href]").forEach((l) => {
    if (["stylesheet", "preload", "modulepreload"].includes(l.rel)) urls.add(l.href);
  });
  return [...urls].filter((u) => {
    try {
      const url = new URL(u);
      return (
        url.origin === location.origin &&
        (url.pathname.startsWith("/_next/static/") || url.pathname.startsWith("/_next/image") || url.pathname.startsWith("/brand/"))
      );
    } catch {
      return false;
    }
  });
}

function ask<T>(worker: ServiceWorker, message: Record<string, unknown>, timeoutMs = 15000): Promise<T | null> {
  return new Promise((resolve) => {
    const channel = new MessageChannel();
    const timer = window.setTimeout(() => resolve(null), timeoutMs);
    channel.port1.onmessage = (e) => {
      window.clearTimeout(timer);
      resolve(e.data as T);
    };
    worker.postMessage(message, [channel.port2]);
  });
}

function describeChanges(prev: VoucherSnapshot, next: VoucherSnapshot, t: Translate): string[] {
  const changes: string[] = [];
  const label = (status: string) => (t.has(`status.${status}` as never) ? t(`status.${status}` as never) : status);
  if (prev.status !== next.status) changes.push(t("changes.status", { now: label(next.status), before: label(prev.status) }));
  for (const item of next.items) {
    const old = prev.items.find((p) => p.id === item.id);
    if (!old) {
      changes.push(t("changes.added", { title: item.title }));
      continue;
    }
    if (old.date !== item.date) changes.push(t("changes.date", { title: item.title }));
    if (old.pax !== item.pax) changes.push(t("changes.pax", { title: item.title }));
  }
  for (const old of prev.items) if (!next.items.some((i) => i.id === old.id)) changes.push(t("changes.removed", { title: old.title }));
  return changes;
}

function isSnapshot(value: unknown): value is VoucherSnapshot {
  return !!value && typeof value === "object" && typeof (value as VoucherSnapshot).status === "string" && Array.isArray((value as VoucherSnapshot).items);
}

/**
 * Voucher sin conexión (HU-B.A2): registra el service worker del voucher, guarda la página en este
 * dispositivo, ofrece instalarla en la pantalla de inicio y avisa si la reserva cambió.
 */
export function VoucherOffline({ code, renderedAt, snapshot, autoSave }: VoucherOfflineProps) {
  const t = useTranslations("voucher");
  const locale = useLocale();
  const fmt = useFormat();
  const online = useOnline();
  const [state, setState] = useState<SaveState>({ kind: "idle" });
  const [installEvent, setInstallEvent] = useState<BeforeInstallPromptEvent | null>(null);
  const [changes, setChanges] = useState<string[]>([]);
  const isIos = useSyncExternalStore(noopSubscribe, iosBrowser, () => false);
  const supported = useSyncExternalStore(noopSubscribe, swSupported, () => true);
  const workerRef = useRef<ServiceWorker | null>(null);
  // `/es/reserva/CODIGO` o `/en/booking/CODIGO`; el SW se registra con la carpeta de reservas del idioma.
  const path = bookingPath(locale, code);
  const scope = path.slice(0, path.lastIndexOf("/") + 1);

  // Cambios desde la última visita (p. ej. operaciones cambió la fecha).
  useEffect(() => {
    const key = `pwt-voucher:${code}`;
    let prev: unknown = null;
    try {
      const raw = safeLocalStorage.getItem(key);
      prev = typeof raw === "string" ? JSON.parse(raw) : null;
    } catch {
      prev = null;
    }
    const current = JSON.stringify(snapshot);
    // eslint-disable-next-line react-hooks/set-state-in-effect -- comparación con localStorage, solo existe en el cliente
    if (isSnapshot(prev)) setChanges(describeChanges(prev, snapshot, t));
    safeLocalStorage.setItem(key, current);
  }, [code, snapshot, t]);

  useEffect(() => {
    const onPrompt = (e: Event) => {
      e.preventDefault();
      setInstallEvent(e as BeforeInstallPromptEvent);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    return () => window.removeEventListener("beforeinstallprompt", onPrompt);
  }, []);

  const save = async () => {
    const worker = workerRef.current;
    if (!worker) return;
    setState({ kind: "saving" });
    const res = await ask<{ ok: boolean; savedAt: string | null }>(worker, { type: "save-voucher", path, assets: collectAssets() });
    setState((prev) =>
      res?.ok
        ? { kind: "saved", at: res.savedAt }
        : prev.kind === "saved" || prev.kind === "saving"
          ? { kind: "saved", at: prev.kind === "saved" ? prev.at : null, stale: true }
          : { kind: "error" },
    );
  };

  useEffect(() => {
    if (!supported) return;
    let cancelled = false;
    (async () => {
      try {
        const reg = await navigator.serviceWorker.register(SW_URL, { scope });
        const worker = reg.active ?? reg.waiting ?? reg.installing;
        const ready = worker?.state === "activated" ? worker : (await navigator.serviceWorker.ready).active;
        if (cancelled || !ready) return;
        workerRef.current = ready;
        const status = await ask<{ saved: boolean; savedAt: string | null }>(ready, { type: "status-voucher", path });
        if (cancelled) return;
        if (!navigator.onLine) {
          setState(status?.saved ? { kind: "saved", at: status.savedAt } : { kind: "idle" });
          return;
        }
        // Tras la primera visita con conexión, la reserva confirmada se guarda sola.
        if (autoSave) {
          setState({ kind: "saving" });
          const res = await ask<{ ok: boolean; savedAt: string | null }>(ready, { type: "save-voucher", path, assets: collectAssets() });
          if (cancelled) return;
          // Sin salida a internet (wifi sin datos, señal débil): se sigue mostrando la copia guardada.
          if (res?.ok) setState({ kind: "saved", at: res.savedAt });
          else setState(status?.saved ? { kind: "saved", at: status.savedAt, stale: true } : { kind: "error" });
        } else {
          setState(status?.saved ? { kind: "saved", at: status.savedAt } : { kind: "idle" });
        }
      } catch {
        if (!cancelled) setState({ kind: "error" });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [autoSave, path, scope, supported]);

  const forget = async () => {
    const worker = workerRef.current;
    if (!worker) return;
    await ask(worker, { type: "forget-voucher", path });
    setState({ kind: "idle" });
  };

  return (
    <div className="space-y-3 text-sm">
      {!online || (state.kind === "saved" && state.stale) ? (
        <p role="status" className="flex gap-2 rounded-md bg-warning-soft p-3 text-warning">
          <WifiOff aria-hidden size={18} strokeWidth={1.5} className="mt-0.5 shrink-0" />
          {t("offline", { date: fmt.dateTime(renderedAt) })}
        </p>
      ) : null}

      {changes.length ? (
        <div role="status" className="rounded-md border border-warning bg-warning-soft p-3 text-warning">
          <p className="font-medium">{t("changes.title")}</p>
          <ul className="mt-1 list-disc pl-5">
            {changes.map((c) => (
              <li key={c}>{c}</li>
            ))}
          </ul>
        </div>
      ) : null}

      <div aria-live="polite">
        {state.kind === "saved" ? (
          <p className="flex items-start gap-2 text-success">
            <CloudDownload aria-hidden size={18} strokeWidth={1.5} className="mt-0.5 shrink-0" />
            <span>
              {state.at ? t("savedAt", { date: fmt.dateTime(state.at) }) : t("saved")}
            </span>
          </p>
        ) : state.kind === "saving" ? (
          <p className="text-foreground-muted">{t("saving")}</p>
        ) : state.kind === "error" ? (
          <p className="text-danger">{t("saveError")}</p>
        ) : !supported ? (
          <p className="flex items-start gap-2 text-foreground-muted">
            <Info aria-hidden size={18} strokeWidth={1.5} className="mt-0.5 shrink-0" />
            {t("unsupported")}
          </p>
        ) : null}
      </div>

      <div className="flex flex-wrap gap-2">
        {supported && (state.kind === "idle" || state.kind === "error") ? (
          <button type="button" className={buttonClass("secondary", "md")} onClick={save} disabled={!online}>
            <CloudDownload aria-hidden size={18} strokeWidth={1.5} />
            {t("save")}
          </button>
        ) : null}
        {state.kind === "saved" && online ? (
          <button type="button" className={buttonClass("ghost", "md")} onClick={save}>
            {t("refresh")}
          </button>
        ) : null}
        {installEvent ? (
          <button
            type="button"
            className={buttonClass("outline", "md")}
            onClick={async () => {
              await installEvent.prompt();
              await installEvent.userChoice;
              setInstallEvent(null);
            }}
          >
            <Smartphone aria-hidden size={18} strokeWidth={1.5} />
            {t("install")}
          </button>
        ) : null}
        {state.kind === "saved" ? (
          <button type="button" className={buttonClass("ghost", "md")} onClick={forget}>
            {t("forget")}
          </button>
        ) : null}
      </div>
      {isIos && !installEvent ? (
        <p className="text-foreground-muted">
          {t("ios")}
        </p>
      ) : null}
    </div>
  );
}
