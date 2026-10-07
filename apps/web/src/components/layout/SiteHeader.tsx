"use client";

import clsx from "clsx";
import { Check, ShoppingBag } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
} from "react";

import type { NavMedia } from "@/lib/catalog/types";
import { whatsappHref } from "@/lib/site";
import { useCartCount, useCartHydrated } from "@/stores/cart-store";
import { useUiStore } from "@/stores/ui-store";

import s from "./SiteHeader.module.css";

/* ---------- Constantes de la spec (§4–§5) ---------- */
type PanelId = "descubre" | "viajes" | "destinos";
const ORDER: PanelId[] = ["descubre", "viajes", "destinos"];
const SIZE: Record<PanelId, { w: number; h: number }> = {
  descubre: { w: 664, h: 358 },
  viajes: { w: 446, h: 308 },
  destinos: { w: 232, h: 218 },
};
const LABEL: Record<PanelId, string> = { descubre: "Descubre", viajes: "Viajes", destinos: "Destinos" };
const PAD = 20;
const EDGE = 12;
const CLOSE_DELAY = 140;
const LINK_CLOSE_DELAY = 60;
const MOBILE_QUERY = "(max-width: 860px)";

const FOCUSABLE = 'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])';

function Chevron() {
  return (
    <svg className={s.chevron} viewBox="0 0 8 5" fill="none" aria-hidden="true" focusable="false">
      <path d="M1 1l3 3 3-3" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/* ---------- Lógica del dropdown morph (spec §5), imperativa sobre refs ---------- */
function useMorphDropdown() {
  const headerRef = useRef<HTMLElement>(null);
  const navRef = useRef<HTMLElement>(null);
  const ddRef = useRef<HTMLDivElement>(null);
  const triggers = useRef<Partial<Record<PanelId, HTMLButtonElement | null>>>({});
  const panels = useRef<Partial<Record<PanelId, HTMLDivElement | null>>>({});
  const current = useRef<PanelId | null>(null);
  const closeTimer = useRef<number | undefined>(undefined);

  const place = useCallback((id: PanelId) => {
    const header = headerRef.current;
    const dd = ddRef.current;
    const trigger = triggers.current[id];
    if (!header || !dd || !trigger) return;
    const { w, h } = SIZE[id];
    const hr = header.getBoundingClientRect();
    const tr = trigger.getBoundingClientRect();
    let x = tr.left - PAD;
    x = Math.max(hr.left + EDGE, Math.min(x, hr.right - w - EDGE));
    const parent = dd.offsetParent as HTMLElement | null;
    x -= parent ? parent.getBoundingClientRect().left : 0;
    dd.style.setProperty("--x", `${x}px`);
    dd.style.setProperty("--w", `${w}px`);
    dd.style.setProperty("--h", `${h}px`);
  }, []);

  const setExpanded = useCallback((id: PanelId | null) => {
    for (const key of ORDER) triggers.current[key]?.setAttribute("aria-expanded", String(key === id));
  }, []);

  const cancelClose = useCallback(() => {
    window.clearTimeout(closeTimer.current);
  }, []);

  const open = useCallback(
    (id: PanelId) => {
      cancelClose();
      const dd = ddRef.current;
      const panel = panels.current[id];
      if (!dd || !panel || current.current === id) return;

      if (current.current === null) {
        // Primera apertura: sin animar tamaño/posición (.instant .snap), reflow, luego abrir.
        dd.classList.add(s.instant, s.snap);
        for (const key of ORDER) {
          const p = panels.current[key];
          if (!p) continue;
          p.classList.add(s.snap);
          p.classList.remove(s.exitLeft, s.exitRight);
          if (key !== id) delete p.dataset.state;
        }
        panel.dataset.state = "active";
        place(id);
        void dd.offsetWidth;
        dd.classList.remove(s.snap);
        for (const key of ORDER) panels.current[key]?.classList.remove(s.snap);
        dd.classList.add(s.open);
        requestAnimationFrame(() => dd.classList.remove(s.instant));
      } else {
        // Cambio de panel: el contenedor no se cierra; x/ancho/alto se animan y el contenido
        // entra en la dirección del movimiento con crossfade + blur.
        const prev = panels.current[current.current];
        const forward = ORDER.indexOf(id) > ORDER.indexOf(current.current);
        if (prev) {
          delete prev.dataset.state;
          prev.classList.remove(s.exitLeft, s.exitRight);
          prev.classList.add(forward ? s.exitLeft : s.exitRight);
        }
        panel.classList.add(s.snap);
        panel.classList.remove(s.exitLeft, s.exitRight);
        panel.classList.add(forward ? s.exitRight : s.exitLeft);
        void panel.offsetWidth;
        panel.classList.remove(s.snap, s.exitLeft, s.exitRight);
        panel.dataset.state = "active";
        place(id);
      }
      current.current = id;
      setExpanded(id);
    },
    [cancelClose, place, setExpanded],
  );

  const close = useCallback(() => {
    cancelClose();
    const dd = ddRef.current;
    if (!dd || current.current === null) return;
    const panel = panels.current[current.current];
    if (panel) delete panel.dataset.state;
    dd.classList.remove(s.open);
    current.current = null;
    setExpanded(null);
  }, [cancelClose, setExpanded]);

  const scheduleClose = useCallback(
    (ms = CLOSE_DELAY) => {
      cancelClose();
      closeTimer.current = window.setTimeout(close, ms);
    },
    [cancelClose, close],
  );

  // Eventos globales: Escape, pointerdown fuera, resize.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape" || current.current === null) return;
      const trigger = triggers.current[current.current];
      close();
      trigger?.focus();
    };
    const onPointerDown = (e: PointerEvent) => {
      if (current.current !== null && !navRef.current?.contains(e.target as Node)) close();
    };
    const onResize = () => {
      if (current.current === null) return;
      if (window.matchMedia(MOBILE_QUERY).matches) close();
      else place(current.current);
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("resize", onResize);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("resize", onResize);
      window.clearTimeout(closeTimer.current);
    };
  }, [close, place]);

  const isOpen = useCallback((id: PanelId) => current.current === id, []);

  // Callbacks de ref estables por panel/trigger (registro imperativo para la coreografía de la spec).
  const triggerRefs = useRef(new Map<PanelId, (el: HTMLButtonElement | null) => void>());
  const panelRefs = useRef(new Map<PanelId, (el: HTMLDivElement | null) => void>());
  const registerTrigger = useCallback((id: PanelId) => {
    let cb = triggerRefs.current.get(id);
    if (!cb) {
      cb = (el) => {
        triggers.current[id] = el;
      };
      triggerRefs.current.set(id, cb);
    }
    return cb;
  }, []);
  const registerPanel = useCallback((id: PanelId) => {
    let cb = panelRefs.current.get(id);
    if (!cb) {
      cb = (el) => {
        panels.current[id] = el;
      };
      panelRefs.current.set(id, cb);
    }
    return cb;
  }, []);
  const navContains = useCallback((node: Node | null) => !!node && !!navRef.current?.contains(node), []);

  /** Teclado: Tab desde un trigger abierto entra al panel; al salir del panel se cierra. */
  const onTriggerKeyDown = (id: PanelId) => (e: ReactKeyboardEvent<HTMLButtonElement>) => {
    if (e.key === "Tab" && !e.shiftKey && isOpen(id)) {
      const first = panels.current[id]?.querySelector<HTMLElement>(FOCUSABLE);
      if (first) {
        e.preventDefault();
        first.focus();
      }
    } else if (e.key === "ArrowDown" && !isOpen(id)) {
      e.preventDefault();
      open(id);
    }
  };

  const onPanelKeyDown = (id: PanelId) => (e: ReactKeyboardEvent<HTMLDivElement>) => {
    if (e.key !== "Tab") return;
    const items = Array.from(panels.current[id]?.querySelectorAll<HTMLElement>(FOCUSABLE) ?? []);
    if (!items.length) return;
    const trigger = triggers.current[id];
    if (e.shiftKey && document.activeElement === items[0]) {
      e.preventDefault();
      trigger?.focus();
    } else if (!e.shiftKey && document.activeElement === items[items.length - 1]) {
      // Siguiente elemento del nav tras el trigger (siguiente trigger o "Nosotros").
      const navItems = Array.from(navRef.current?.querySelectorAll<HTMLElement>(":scope > ul > li > *") ?? []);
      const next = trigger ? navItems[navItems.indexOf(trigger) + 1] : undefined;
      if (next) {
        e.preventDefault();
        close();
        next.focus();
      }
    }
  };

  return {
    headerRef,
    navRef,
    ddRef,
    registerTrigger,
    registerPanel,
    navContains,
    open,
    close,
    scheduleClose,
    cancelClose,
    isOpen,
    onTriggerKeyDown,
    onPanelKeyDown,
  };
}

/* ---------- Componente ---------- */

export function SiteHeader({ media }: { media: NavMedia }) {
  const pathname = usePathname();
  const isHome = pathname === "/es" || pathname === "/";
  const {
    headerRef,
    navRef,
    ddRef,
    registerTrigger,
    registerPanel,
    navContains,
    open,
    close,
    scheduleClose,
    cancelClose,
    isOpen,
    onTriggerKeyDown,
    onPanelKeyDown,
  } = useMorphDropdown();
  const [scrolled, setScrolled] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [langOpen, setLangOpen] = useState(false);
  const [discoverIndex, setDiscoverIndex] = useState(0);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const sheetRef = useRef<HTMLDivElement>(null);
  const langRef = useRef<HTMLDivElement>(null);
  const ids = useId();
  const panelId = (id: PanelId) => `${ids}-dd-${id}`;
  const sheetId = `${ids}-sheet`;
  const langId = `${ids}-lang`;

  // Header sólido al pasar 80 px (solo home).
  useEffect(() => {
    if (!isHome) return;
    let frame = 0;
    const update = () => {
      frame = 0;
      setScrolled(window.scrollY > 80);
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      cancelAnimationFrame(frame);
    };
  }, [isHome]);

  // Cerrar todo al navegar: estado de React durante el render; el dropdown (DOM) en un efecto.
  const [lastPathname, setLastPathname] = useState(pathname);
  if (lastPathname !== pathname) {
    setLastPathname(pathname);
    setSheetOpen(false);
    setLangOpen(false);
  }
  useEffect(() => {
    close();
  }, [pathname, close]);

  // Hoja móvil e idioma: Escape devuelve el foco; clic fuera cierra.
  useEffect(() => {
    if (!sheetOpen && !langOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (sheetOpen) {
        setSheetOpen(false);
        menuButtonRef.current?.focus();
      }
      if (langOpen) {
        setLangOpen(false);
        langRef.current?.querySelector("button")?.focus();
      }
    };
    const onPointerDown = (e: PointerEvent) => {
      const target = e.target as Node;
      if (sheetOpen && !sheetRef.current?.contains(target) && !menuButtonRef.current?.contains(target)) {
        setSheetOpen(false);
      }
      if (langOpen && !langRef.current?.contains(target)) setLangOpen(false);
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onPointerDown);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onPointerDown);
    };
  }, [sheetOpen, langOpen]);

  const onTriggerPointerEnter = (id: PanelId) => (e: ReactPointerEvent) => {
    if (e.pointerType === "mouse") open(id);
  };

  const onTriggerClick = (id: PanelId) => (e: ReactMouseEvent) => {
    const pointerType = (e.nativeEvent as PointerEvent).pointerType;
    if (pointerType === "mouse") {
      open(id);
      return;
    }
    // Táctil y teclado: alterna.
    if (isOpen(id)) close();
    else open(id);
  };

  return (
    <header
      ref={headerRef}
      className={clsx(s.header, isHome ? [s.overlay, s.intro] : s.solid, isHome && scrolled && s.scrolled)}
    >
      <div className={s.bar}>
        <Link href="/es" className={s.logo} aria-label="Peru Wonders Tours, inicio">
          <Image
            src="/logo.png"
            alt="Peru Wonders Tours"
            width={120}
            height={40}
            className={s.logoImg}
            preload
          />
        </Link>

        <nav
          ref={navRef}
          className={s.nav}
          aria-label="Principal"
          onPointerEnter={cancelClose}
          onPointerLeave={(e) => {
            if (e.pointerType === "mouse") scheduleClose(CLOSE_DELAY);
          }}
          onBlur={(e) => {
            if (!navContains(e.relatedTarget as Node | null)) close();
          }}
        >
          <ul className={s.list}>
            {ORDER.map((id) => (
              <li key={id}>
                <button
                  type="button"
                  ref={registerTrigger(id)}
                  className={s.trigger}
                  aria-expanded="false"
                  aria-controls={panelId(id)}
                  onPointerEnter={onTriggerPointerEnter(id)}
                  onClick={onTriggerClick(id)}
                  onKeyDown={onTriggerKeyDown(id)}
                >
                  {LABEL[id]}
                  <Chevron />
                </button>
              </li>
            ))}
            <li>
              <Link
                href="/es/nosotros"
                className={s.trigger}
                onPointerEnter={(e) => {
                  if (e.pointerType === "mouse") scheduleClose(LINK_CLOSE_DELAY);
                }}
                onFocus={() => close()}
              >
                Nosotros
              </Link>
            </li>
          </ul>

          {/* Un solo contenedor con tres paneles (spec §4). */}
          <div ref={ddRef} className={s.dd}>
            <div
              id={panelId("descubre")}
              ref={registerPanel("descubre")}
              className={clsx(s.panel, s.panelDiscover)}
              onKeyDown={onPanelKeyDown("descubre")}
            >
              <ul className={s.discoverList}>
                {media.discover.map((item, i) => (
                  <li key={item.key}>
                    <Link
                      href={item.href}
                      className={s.discoverRow}
                      data-active={discoverIndex === i}
                      onPointerEnter={() => setDiscoverIndex(i)}
                      onFocus={() => setDiscoverIndex(i)}
                      onClick={close}
                    >
                      <span className={s.discoverTitle}>{item.title}</span>
                      <span className={s.discoverDesc}>{item.description}</span>
                    </Link>
                  </li>
                ))}
              </ul>
              <div className={s.discoverMedia} aria-hidden="true">
                {media.discover.map((item, i) =>
                  item.image ? (
                    <div key={item.key} className={s.discoverImg} data-active={discoverIndex === i}>
                      <Image src={item.image.src} alt="" fill sizes="428px" />
                    </div>
                  ) : null,
                )}
              </div>
            </div>

            <div
              id={panelId("viajes")}
              ref={registerPanel("viajes")}
              className={clsx(s.panel, s.panelJourneys)}
              onKeyDown={onPanelKeyDown("viajes")}
            >
              {media.journeys.map((item) => (
                <Link key={item.key} href={item.href} className={s.journeyCard} onClick={close}>
                  {item.image ? <Image src={item.image.src} alt="" fill sizes="216px" /> : null}
                  <span className={s.journeyTitle}>{item.title}</span>
                </Link>
              ))}
            </div>

            <div
              id={panelId("destinos")}
              ref={registerPanel("destinos")}
              className={clsx(s.panel, s.panelRegions)}
              onKeyDown={onPanelKeyDown("destinos")}
            >
              {media.regions.map((item) => (
                <Link key={item.key} href={item.href} onClick={close}>
                  {item.label}
                </Link>
              ))}
            </div>
          </div>
        </nav>

        <div className={s.actions}>
          <div className={s.lang} ref={langRef}>
            <button
              type="button"
              className={s.langButton}
              aria-expanded={langOpen}
              aria-controls={langId}
              aria-label="Idioma: Español"
              onClick={() => setLangOpen((v) => !v)}
            >
              ES
              <Chevron />
            </button>
            {langOpen ? (
              <ul id={langId} className={s.langMenu}>
                <li>
                  <span aria-current="true" lang="es">
                    Español <Check aria-hidden size={16} strokeWidth={1.5} />
                  </span>
                </li>
                <li>
                  {/* TODO(E10): habilitar cuando exista la versión en inglés. */}
                  <span aria-disabled="true" lang="en">
                    English <small>Próximamente</small>
                  </span>
                </li>
              </ul>
            ) : null}
          </div>

          <CartButton />

          <ReserveCta />

          <button
            ref={menuButtonRef}
            type="button"
            className={s.menuButton}
            aria-expanded={sheetOpen}
            aria-controls={sheetId}
            aria-label={sheetOpen ? "Cerrar menú" : "Abrir menú"}
            onClick={() => setSheetOpen((v) => !v)}
          >
            <svg className={s.menuIcon} viewBox="0 0 16 8" aria-hidden="true" focusable="false">
              <line x1="0" y1="1" x2="16" y2="1" stroke="currentColor" strokeWidth="1.4" />
              <line x1="0" y1="7" x2="16" y2="7" stroke="currentColor" strokeWidth="1.4" />
            </svg>
          </button>
        </div>
      </div>

      {/* Hoja móvil (spec §6). */}
      <div
        id={sheetId}
        ref={sheetRef}
        className={clsx(s.sheet, sheetOpen && s.sheetOpen)}
        data-lenis-prevent
        onClick={(e) => {
          if ((e.target as HTMLElement).closest("a")) setSheetOpen(false);
        }}
      >
        <nav aria-label="Menú móvil">
          <h3>Descubre</h3>
          <ul>
            {media.discover.map((item) => (
              <li key={item.key}>
                <Link href={item.href}>{item.title}</Link>
              </li>
            ))}
          </ul>
          <h3>Viajes</h3>
          <ul>
            {media.journeys.map((item) => (
              <li key={item.key}>
                <Link href={item.href}>{item.title}</Link>
              </li>
            ))}
          </ul>
          <h3>Destinos</h3>
          <ul>
            {media.regions.map((item) => (
              <li key={item.key}>
                <Link href={item.href}>{item.label}</Link>
              </li>
            ))}
          </ul>
          <div className={s.sheetDivider} />
          <ul>
            <li>
              <Link href="/es/nosotros">Nosotros</Link>
            </li>
            <li>
              <Link href="/es/tours">Ver todos los tours</Link>
            </li>
            <li>
              <a href={whatsappHref("Hola, quiero información sobre sus tours.")} target="_blank" rel="noopener noreferrer">
                Escríbenos por WhatsApp
              </a>
            </li>
            <li>
              <span className={s.sheetItem}>Idioma: Español · English (próximamente)</span>
            </li>
          </ul>
        </nav>
      </div>
    </header>
  );
}

/* ---------- Carrito y CTA ---------- */

function CartButton() {
  const count = useCartCount();
  const hydrated = useCartHydrated();
  const pulse = useUiStore((st) => st.cartPulse);
  const openDrawer = useUiStore((st) => st.openCartDrawer);
  const shown = hydrated ? count : 0;
  const label = shown === 0 ? "Carrito, vacío" : `Carrito, ${shown} ${shown === 1 ? "tour" : "tours"}`;

  return (
    <button
      type="button"
      className={s.iconButton}
      aria-label={label}
      onClick={(e) => openDrawer(e.currentTarget)}
    >
      <span key={pulse} className={pulse ? "pwt-pulse" : undefined}>
        <ShoppingBag aria-hidden size={20} strokeWidth={1.5} />
      </span>
      {shown > 0 ? (
        <span className={s.badge} aria-hidden="true">
          {shown}
        </span>
      ) : null}
    </button>
  );
}

function ReserveCta() {
  const count = useCartCount();
  const openDrawer = useUiStore((st) => st.openCartDrawer);
  return (
    <Link
      href="/es/tours"
      className={s.cta}
      onClick={(e) => {
        // home.md: abre el carrito si tiene ítems; si no, lleva a /es/tours.
        if (count > 0) {
          e.preventDefault();
          openDrawer(e.currentTarget);
        }
      }}
    >
      Reservar
    </Link>
  );
}
