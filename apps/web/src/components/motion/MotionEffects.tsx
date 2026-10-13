"use client";

import { motion as motionTokens, REDUCED_MOTION_QUERY } from "@pwt/ui/tokens";
import { usePathname } from "next/navigation";
import { useEffect } from "react";

/**
 * Efectos de scroll (MASTER §6.3), cargados de forma diferida tras la hidratación:
 * - Lenis (lerp 0.1), desactivado con movimiento reducido o puntero táctil.
 * - Reveals con GSAP ScrollTrigger declarados por atributos:
 *     data-reveal            → título/bloque: opacidad + y 16 px, 500 ms
 *     data-reveal-stagger    → hijos directos: y 20 px, stagger 60 ms (máx. 6 escalonados)
 *     data-reveal-clip       → imagen: clip-path inset(8%) → 0, 600 ms
 *     data-count-to="41"     → contador numérico (el HTML ya trae el valor final: SEO/no-JS)
 * Todo se registra dentro de gsap.context + gsap.matchMedia y se revierte al cambiar de ruta.
 */

type GsapModule = typeof import("gsap");
type ScrollTriggerModule = typeof import("gsap/ScrollTrigger");

let gsapPromise: Promise<{ gsap: GsapModule["gsap"]; ScrollTrigger: ScrollTriggerModule["ScrollTrigger"] }> | null =
  null;

function loadGsap() {
  gsapPromise ??= Promise.all([import("gsap"), import("gsap/ScrollTrigger"), import("gsap/CustomEase")]).then(
    ([{ gsap }, { ScrollTrigger }, { CustomEase }]) => {
      gsap.registerPlugin(ScrollTrigger, CustomEase);
      CustomEase.create("pwt", motionTokens.bezier.out.join(","));
      return { gsap, ScrollTrigger };
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
        const [{ default: Lenis }, { gsap, ScrollTrigger }] = await Promise.all([import("lenis"), loadGsap()]);
        // Ignore loads from a previous preference state or an unmounted effect.
        if (cancelled || current !== generation || mq.matches || !pointer.matches) return;
        const lenis = new Lenis({ lerp: 0.1, anchors: true });
        lenis.on("scroll", ScrollTrigger.update);
        const tick = (time: number) => lenis.raf(time * 1000);
        gsap.ticker.add(tick);
        gsap.ticker.lagSmoothing(0);
        cleanup = () => {
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
    let cancelled = false;
    let revert: (() => void) | undefined;
    const cancelIdle = onIdle(async () => {
      const { gsap, ScrollTrigger } = await loadGsap();
      if (cancelled) return;
      const mm = gsap.matchMedia();
      const ctx = gsap.context(() => {
        mm.add("(prefers-reduced-motion: no-preference)", () => {
          const base = { ease: "pwt" };
          const trigger = (el: Element): ScrollTrigger.Vars => ({ trigger: el, start: "top 85%", once: true });

          gsap.utils.toArray<HTMLElement>("[data-reveal]").forEach((el) => {
            gsap.from(el, { ...base, opacity: 0, y: 16, duration: 0.5, scrollTrigger: trigger(el) });
          });

          gsap.utils.toArray<HTMLElement>("[data-reveal-stagger]").forEach((group) => {
            const items = Array.from(group.children) as HTMLElement[];
            if (!items.length) return;
            gsap.from(items, {
              ...base,
              opacity: 0,
              y: 20,
              duration: 0.5,
              stagger: (i: number) => Math.min(i, 5) * (motionTokens.stagger / 1000),
              scrollTrigger: trigger(group),
            });
          });

          gsap.utils.toArray<HTMLElement>("[data-reveal-clip]").forEach((el) => {
            gsap.fromTo(
              el,
              { clipPath: "inset(8% 8% 8% 8% round 16px)" },
              { clipPath: "inset(0% 0% 0% 0% round 16px)", duration: 0.6, ease: "pwt", scrollTrigger: trigger(el) },
            );
          });

          gsap.utils.toArray<HTMLElement>("[data-count-to]").forEach((el) => {
            const target = Number(el.dataset.countTo);
            if (!Number.isFinite(target)) return;
            const counter = { value: 0 };
            gsap.to(counter, {
              value: target,
              duration: 1.2,
              ease: "pwt",
              scrollTrigger: trigger(el),
              onUpdate: () => {
                el.textContent = String(Math.round(counter.value));
              },
              onStart: () => {
                el.textContent = "0";
              },
            });
          });
          // Text mutations are not tweened DOM properties: restore them when this media query exits.
          return restoreCounters;
        });
      }, document.body);
      ScrollTrigger.refresh();
      revert = () => {
        mm.revert();
        ctx.revert();
        restoreCounters();
      };
    });
    return () => {
      cancelled = true;
      cancelIdle();
      revert?.();
    };
  }, [pathname]);

  return null;
}
