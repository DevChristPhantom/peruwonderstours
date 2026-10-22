"use client";

import { motion as motionTokens, REDUCED_MOTION_QUERY } from "@pwt/ui/tokens";
import { usePathname } from "next/navigation";
import { useEffect } from "react";

/**
 * Efectos de scroll (MASTER §6.3), cargados de forma diferida tras la hidratación:
 * - Lenis (lerp 0.1), desactivado con movimiento reducido o puntero táctil.
 * - Reveals con GSAP disparados por IntersectionObserver, declarados por atributos:
 *     data-reveal            → título/bloque: opacidad + y 16 px, 500 ms
 *     data-reveal-stagger    → hijos directos: y 20 px, stagger 60 ms (máx. 6 escalonados)
 *     data-reveal-clip       → imagen: clip-path inset(8%) → 0, 600 ms
 *     data-count-to="41"     → contador numérico (el HTML ya trae el valor final: SEO/no-JS)
 * Todo se registra dentro de gsap.context + gsap.matchMedia y se revierte al cambiar de ruta.
 */

type GsapModule = typeof import("gsap");

let gsapPromise: Promise<{ gsap: GsapModule["gsap"] }> | null = null;

function loadGsap() {
  gsapPromise ??= Promise.all([import("gsap"), import("gsap/CustomEase")]).then(
    ([{ gsap }, { CustomEase }]) => {
      gsap.registerPlugin(CustomEase);
      CustomEase.create("pwt", motionTokens.bezier.out.join(","));
      return { gsap };
    },
  ).catch((error: unknown) => {
    // Allow a later route to retry a transient chunk-loading failure.
    gsapPromise = null;
    throw error;
  });
  return gsapPromise;
}

function onIdle(cb: () => void | Promise<void>): () => void {
  const run = () => {
    // Motion is progressive enhancement; a failed chunk keeps the page usable.
    void Promise.resolve().then(cb).catch(() => undefined);
  };
  if ("requestIdleCallback" in window) {
    const id = window.requestIdleCallback(run, { timeout: 1200 });
    return () => window.cancelIdleCallback(id);
  }
  const id = setTimeout(run, 200);
  return () => clearTimeout(id);
}

function restoreCounters() {
  document.querySelectorAll<HTMLElement>("[data-count-to]").forEach((el) => {
    el.textContent = el.dataset.countTo ?? el.textContent;
  });
}

export default function MotionEffects() {
  const pathname = usePathname();

  // Lenis is optional; preference changes restore native scrolling.
  useEffect(() => {
    const mq = window.matchMedia(REDUCED_MOTION_QUERY);
    const pointer = window.matchMedia("(pointer: fine)");
    let cancelled = false;
    let generation = 0;
    let cancelIdle: (() => void) | undefined;
    let cleanup: (() => void) | undefined;
    const onChange = () => {
      const current = ++generation;
      cancelIdle?.();
      cleanup?.();
      cleanup = undefined;
      if (cancelled || mq.matches || !pointer.matches) return;
      cancelIdle = onIdle(async () => {
        const [{ default: Lenis }, { gsap }] = await Promise.all([import("lenis"), loadGsap()]);
        // Ignore loads from a previous preference state or an unmounted effect.
        if (cancelled || current !== generation || mq.matches || !pointer.matches) return;
        const lenis = new Lenis({ lerp: 0.1, anchors: true });
        const tick = (time: number) => lenis.raf(time * 1000);
        // A persistent Lenis listener otherwise keeps the shared ticker alive
        // in background tabs even when there are no visible transitions.
        let ticking = false;
        const visibility = () => {
          const visible = document.visibilityState === "visible";
          if (visible && !ticking) { gsap.ticker.add(tick); ticking = true; }
          else if (!visible && ticking) { gsap.ticker.remove(tick); ticking = false; }
        };
        document.addEventListener("visibilitychange", visibility);
        visibility();
        gsap.ticker.lagSmoothing(0);
        cleanup = () => {
          document.removeEventListener("visibilitychange", visibility);
          gsap.ticker.remove(tick);
          // stop() marks the root as stopped and can lock scroll; destroy restores native scroll.
          lenis.destroy();
        };
      });
    };
    mq.addEventListener("change", onChange);
    pointer.addEventListener("change", onChange);
    onChange();
    return () => {
      cancelled = true;
      generation++;
      mq.removeEventListener("change", onChange);
      pointer.removeEventListener("change", onChange);
      cancelIdle?.();
      cleanup?.();
    };
  }, []);

  // Reveals por ruta.
  useEffect(() => {
    const preference = window.matchMedia(REDUCED_MOTION_QUERY);
    let cancelled = false;
    let generation = 0;
    let cancelIdle: (() => void) | undefined;
    let revert: (() => void) | undefined;
    const onChange = () => {
      const current = ++generation;
      cancelIdle?.();
      revert?.();
      revert = undefined;
      if (cancelled || preference.matches) return;
      cancelIdle = onIdle(async () => {
        const { gsap } = await loadGsap();
        if (cancelled || current !== generation || preference.matches) return;
        const mm = gsap.matchMedia();
        const ctx = gsap.context(() => {
          mm.add("(prefers-reduced-motion: no-preference)", () => {
            const base = { ease: "pwt" };
            // Home editorial scenes: each card enters when it reaches the viewport,
            // rather than revealing an entire tall mobile grid at once.
            const compact = window.matchMedia("(max-width: 767px), (pointer: coarse)").matches;

            /**
             * Rendimiento: IntersectionObserver decide cuándo entra cada bloque sin medir el layout
             * (no fuerza a maquetar las secciones con `content-visibility: auto`). Lo que ya se ve al
             * cargar queda tal cual; lo de abajo se oculta fuera de pantalla y entra con GSAP.
             */
            type Target = { hide: () => void; play: () => void };
            const targets = new Map<Element, Target>();
            const seen = new WeakSet<Element>();

            gsap.utils.toArray<HTMLElement>("[data-reveal-scene]").forEach((el) => {
              const direction = el.dataset.revealScene;
              const horizontal = !compact && (direction === "left" || direction === "right");
              const from = { opacity: 0, x: horizontal ? (direction === "left" ? -24 : 24) : 0, y: horizontal ? 0 : 20 };
              targets.set(el, {
                hide: () => gsap.set(el, from),
                play: () => gsap.to(el, { ...base, opacity: 1, x: 0, y: 0, duration: compact ? 0.4 : 0.55, clearProps: "transform,opacity" }),
              });
            });

            gsap.utils.toArray<HTMLElement>("[data-reveal]").forEach((el) => {
              targets.set(el, {
                hide: () => gsap.set(el, { opacity: 0, y: 16 }),
                play: () => gsap.to(el, { ...base, opacity: 1, y: 0, duration: 0.5, clearProps: "transform,opacity" }),
              });
            });

            gsap.utils.toArray<HTMLElement>("[data-reveal-stagger]").forEach((group) => {
              const items = Array.from(group.children) as HTMLElement[];
              if (!items.length) return;
              targets.set(group, {
                hide: () => gsap.set(items, { opacity: 0, y: 20 }),
                play: () =>
                  gsap.to(items, {
                    ...base,
                    opacity: 1,
                    y: 0,
                    duration: 0.5,
                    stagger: (i: number) => Math.min(i, 5) * (motionTokens.stagger / 1000),
                    clearProps: "transform,opacity",
                  }),
              });
            });

            // clip-path repinta la imagen en cada frame: en móviles/táctiles se omite.
            if (!compact) {
              gsap.utils.toArray<HTMLElement>("[data-reveal-clip]").forEach((el) => {
                targets.set(el, {
                  hide: () => gsap.set(el, { clipPath: "inset(8% 8% 8% 8% round 16px)" }),
                  play: () => gsap.to(el, { clipPath: "inset(0% 0% 0% 0% round 16px)", duration: 0.6, ease: "pwt", clearProps: "clipPath" }),
                });
              });
            }

            gsap.utils.toArray<HTMLElement>("[data-count-to]").forEach((el) => {
              const target = Number(el.dataset.countTo);
              if (!Number.isFinite(target)) return;
              targets.set(el, {
                hide: () => {
                  el.textContent = "0";
                },
                play: () => {
                  const counter = { value: 0 };
                  gsap.to(counter, {
                    value: target,
                    duration: 1.2,
                    ease: "pwt",
                    onUpdate: () => {
                      el.textContent = String(Math.round(counter.value));
                    },
                  });
                },
              });
            });

            const observer = new IntersectionObserver((entries) => {
              for (const entry of entries) {
                const item = targets.get(entry.target);
                if (!item) continue;
                if (!seen.has(entry.target)) {
                  // Primera lectura: visible al cargar → se deja como está; fuera de pantalla → se oculta.
                  seen.add(entry.target);
                  if (entry.isIntersecting) observer.unobserve(entry.target);
                  else ctx.add(item.hide);
                  continue;
                }
                if (entry.isIntersecting) {
                  observer.unobserve(entry.target);
                  ctx.add(item.play);
                }
              }
            });
            targets.forEach((_, el) => observer.observe(el));
            // Text mutations are not tweened DOM properties: restore them when this media query exits.
            return () => {
              observer.disconnect();
              restoreCounters();
            };
          });
        }, document.body);
        revert = () => {
          mm.revert();
          ctx.revert();
          restoreCounters();
        };
      });
    };
    preference.addEventListener("change", onChange);
    onChange();
    return () => {
      cancelled = true;
      generation++;
      preference.removeEventListener("change", onChange);
      cancelIdle?.();
      revert?.();
    };
  }, [pathname]);

  return null;
}
