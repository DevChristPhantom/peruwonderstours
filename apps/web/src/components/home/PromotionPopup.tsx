"use client";

import { ArrowRight, CalendarDays, MessageCircle, X } from "lucide-react";
import Image from "next/image";
import { useEffect, useRef, useState } from "react";

import { buttonClass } from "@/components/ui/button-styles";
import Link from "@/components/ui/IntentLink";

export interface PopupPromotion {
  revision: string;
  title: string;
  eyebrow: string | null;
  summary: string;
  dates: string | null;
  image: { src: string; alt: string } | null;
  cta: { href: string; label: string; external: boolean; kind: "tour" | "page" | "whatsapp" };
  fallback: boolean;
}

/** Espera antes de mostrar el anuncio (pedido del cliente: 3 s tras entrar a la home). */
const DELAY_MS = 3000;
/** Tras cerrarlo no vuelve a aparecer en 24 h (salvo que el equipo edite el evento). */
const SNOOZE_MS = 24 * 60 * 60 * 1000;
const KEY = "pwt-promo-cerrado";

function snoozed(revision: string): boolean {
  try {
    const saved = JSON.parse(localStorage.getItem(KEY) ?? "null") as { revision?: string; at?: number } | null;
    return !!saved && saved.revision === revision && typeof saved.at === "number" && Date.now() - saved.at < SNOOZE_MS;
  } catch {
    return false;
  }
}

function remember(revision: string) {
  try {
    localStorage.setItem(KEY, JSON.stringify({ revision, at: Date.now() }));
  } catch {
    // Almacenamiento bloqueado (modo privado): se volverá a mostrar en la próxima visita.
  }
}

/**
 * Anuncio emergente del evento destacado. Escritorio: ventana modal centrada (`<dialog>` nativo:
 * foco atrapado, Escape y restauración del foco). Móvil: tarjeta inferior no modal que no tapa la
 * página (guía de Google sobre intersticiales intrusivos en móviles).
 */
export function PromotionPopup({ promotion, labels }: { promotion: PopupPromotion; labels: { label: string; close: string; later: string } }) {
  const ref = useRef<HTMLDialogElement>(null);
  const [mobile, setMobile] = useState(false);
  /** «pending»: ya tiene sus clases de móvil/escritorio; se abre después de pintarlas (sin saltos de scroll). */
  const [phase, setPhase] = useState<"idle" | "pending" | "shown">("idle");

  useEffect(() => {
    if (snoozed(promotion.revision)) return;
    let timer: number | undefined;
    const open = () => {
      const dialog = ref.current;
      if (!dialog || dialog.open || document.visibilityState !== "visible") return;
      // Si otro diálogo ya está abierto (galería, carrito), no se interrumpe al visitante.
      if (document.querySelector("dialog[open]")) return;
      setMobile(window.matchMedia("(max-width: 767px)").matches);
      setPhase("pending");
    };
    const schedule = () => {
      window.clearTimeout(timer);
      if (document.visibilityState === "visible") timer = window.setTimeout(open, DELAY_MS);
    };
    schedule();
    // Pestaña en segundo plano: el reloj se reinicia al volver, para que el anuncio se vea.
    document.addEventListener("visibilitychange", schedule);
    return () => {
      window.clearTimeout(timer);
      document.removeEventListener("visibilitychange", schedule);
    };
  }, [promotion.revision]);

  useEffect(() => {
    const dialog = ref.current;
    if (phase !== "pending" || !dialog || dialog.open) return;
    if (mobile) {
      // Tarjeta no modal: no roba el foco ni el lector de pantalla a quien ya está leyendo la página.
      const previous = document.activeElement instanceof HTMLElement && document.activeElement !== document.body ? document.activeElement : null;
      dialog.show();
      if (previous) previous.focus({ preventScroll: true });
      else if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
    } else {
      dialog.showModal();
    }
    setPhase("shown");
  }, [phase, mobile]);

  const close = () => {
    remember(promotion.revision);
    ref.current?.close();
  };

  const Icon = promotion.cta.kind === "whatsapp" ? MessageCircle : ArrowRight;
  const cta = buttonClass("primary", "md", "gap-2");

  return (
    <dialog
      ref={ref}
      aria-labelledby="promo-popup-title"
      aria-describedby="promo-popup-summary"
      lang={promotion.fallback ? "es-PE" : undefined}
      onCancel={() => remember(promotion.revision)}
      onClick={(e) => {
        // Clic en el fondo oscuro (fuera de la tarjeta) cierra la ventana modal.
        if (e.target === e.currentTarget && !mobile) close();
      }}
      className={
        mobile
          ? "pwt-promo fixed inset-x-3 top-auto bottom-3 z-[60] m-0 w-auto max-w-none overflow-hidden rounded-2xl border border-border bg-surface p-0 text-foreground shadow-xl"
          : "pwt-promo m-auto w-[min(760px,calc(100vw-2rem))] max-w-none overflow-hidden rounded-3xl border-0 bg-surface p-0 text-foreground shadow-2xl backdrop:bg-[#06090b]/60 backdrop:backdrop-blur-[2px]"
      }
    >
      <div className={mobile ? "flex gap-3 p-3 pr-12" : "grid md:grid-cols-[1fr_1.1fr]"}>
        <div className={`relative shrink-0 overflow-hidden bg-[#133464] ${mobile ? "size-20 rounded-xl" : "aspect-[4/3] md:aspect-auto md:min-h-[360px]"}`}>
          {promotion.image ? (
            <Image src={promotion.image.src} alt={promotion.image.alt} fill sizes={mobile ? "80px" : "(min-width: 768px) 360px, 100vw"} className="object-cover" />
          ) : (
            <div aria-hidden className="absolute inset-0 bg-[radial-gradient(120%_90%_at_20%_10%,#2c5aa0_0%,#133464_55%,#0b1f3d_100%)]" />
          )}
        </div>
        <div className={mobile ? "min-w-0 flex-1" : "flex flex-col gap-3 p-6 md:p-8"}>
          <p className="text-xs font-medium tracking-[0.08em] text-primary uppercase">{promotion.eyebrow || labels.label}</p>
          <h2 id="promo-popup-title" className={`font-display font-medium ${mobile ? "text-base leading-snug" : "text-h3"}`}>
            {promotion.title}
          </h2>
          {promotion.dates ? (
            <p className={`flex items-center gap-1.5 font-medium ${mobile ? "mt-1 text-xs" : "text-sm"}`}>
              <CalendarDays aria-hidden size={mobile ? 14 : 18} strokeWidth={1.5} className="text-primary" />
              {promotion.dates}
            </p>
          ) : null}
          <p id="promo-popup-summary" className={mobile ? "sr-only" : "pwt-prose text-foreground-muted"}>
            {promotion.summary}
          </p>
          <div className={mobile ? "mt-2" : "mt-auto flex flex-wrap items-center gap-3 pt-2"}>
            {promotion.cta.external ? (
              <a href={promotion.cta.href} target="_blank" rel="noopener noreferrer" onClick={close} className={mobile ? buttonClass("primary", "md", "gap-1.5") : cta}>
                {promotion.cta.label}
                <Icon aria-hidden size={mobile ? 16 : 18} strokeWidth={1.5} />
              </a>
            ) : (
              <Link href={promotion.cta.href} onClick={close} className={mobile ? buttonClass("primary", "md", "gap-1.5") : cta}>
                {promotion.cta.label}
                <Icon aria-hidden size={mobile ? 16 : 18} strokeWidth={1.5} />
              </Link>
            )}
            {!mobile ? (
              <button type="button" onClick={close} className={buttonClass("ghost", "md")}>
                {labels.later}
              </button>
            ) : null}
          </div>
        </div>
      </div>
      <button
        type="button"
        onClick={close}
        aria-label={labels.close}
        className="absolute top-2 right-2 inline-flex size-11 items-center justify-center rounded-pill bg-surface/90 text-foreground shadow-xs hover:bg-surface-muted"
      >
        <X aria-hidden size={20} strokeWidth={1.5} />
      </button>
    </dialog>
  );
}
