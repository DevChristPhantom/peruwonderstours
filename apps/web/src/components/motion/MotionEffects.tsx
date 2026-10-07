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
  );
  return gsapPromise;
}

function onIdle(cb: () => void): () => void {
  if ("requestIdleCallback" in window) {
    const id = window.requestIdleCallback(cb, { timeout: 1200 });
    return () => window.cancelIdleCallback(id);
  }
  const id = setTimeout(cb, 200);
  return () => clearTimeout(id);
}

export default function MotionEffects() {
  const pathname = usePathname();

  // Lenis: una sola instancia para toda la sesión.
  useEffect(() => {
    if (window.matchMedia(REDUCED_MOTION_QUERY).matches || window.matchMedia("(pointer: coarse)").matches) {
      return;
    }
    let cancelled = false;
    let cleanup: (() => void) | undefined;
    const cancelIdle = onIdle(async () => {
      const [{ default: Lenis }, { gsap, ScrollTrigger }] = await Promise.all([import("lenis"), loadGsap()]);
      if (cancelled) return;
      const lenis = new Lenis({ lerp: 0.1, anchors: true });
      lenis.on("scroll", ScrollTrigger.update);
      const tick = (time: number) => lenis.raf(time * 1000);
      gsap.ticker.add(tick);
      gsap.ticker.lagSmoothing(0);
      const mq = window.matchMedia(REDUCED_MOTION_QUERY);
      const onChange = () => (mq.matches ? lenis.stop() : lenis.start());
      mq.addEventListener("change", onChange);
      cleanup = () => {
        mq.removeEventListener("change", onChange);
        gsap.ticker.remove(tick);
        lenis.destroy();
      };
    });
    return () => {
      cancelled = true;
      cancelIdle();
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
        });
      });
      ScrollTrigger.refresh();
      revert = () => {
        mm.revert();
        ctx.revert();
        document.querySelectorAll<HTMLElement>("[data-count-to]").forEach((el) => {
          el.textContent = el.dataset.countTo ?? el.textContent;
        });
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
