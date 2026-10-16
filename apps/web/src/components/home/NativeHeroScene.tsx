"use client";
import Image from "next/image";
import { useEffect, useRef } from "react";
import type { HeroBannerScene } from "@/lib/content/hero-banners";
import s from "./Hero.module.css";

type Ripple = { x: number; y: number; radius: number; life: number };
/** One bounded, event-driven animation loop; no React renders on pointer movement. */
export function NativeHeroScene({ scene, image, alt, active }: { scene?: HeroBannerScene; image?: string; alt: string; active: boolean }) {
  const root = useRef<HTMLDivElement>(null);
  const photo = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const effect = scene?.effect ?? "none";
  useEffect(() => {
    const host = root.current, layer = photo.current, surface = canvas.current;
    if (!host || !layer || !active || effect === "none") return;
    // Clouds need only a compositor transform. Allocate the water surface only
    // after an actual ripple, rather than a viewport-sized bitmap on every visit.
    const context = effect === "water" ? surface?.getContext("2d") : null;
    let surfaceReady = false;
    let width = 1, height = 1, frame = 0, previous = 0, lastRipple = 0;
    let x = 0, y = 0, targetX = 0, targetY = 0;
    let pendingPointer: PointerEvent | undefined;
    const ripples: Ripple[] = [];
    const resize = () => {
      width = host.clientWidth; height = host.clientHeight;
      if (surfaceReady && surface && context) {
        const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
        surface.width = Math.round(width * dpr); surface.height = Math.round(height * dpr);
        context.setTransform(dpr, 0, 0, dpr, 0, 0);
      }
    };
    const tick = (now: number) => {
      frame = 0;
      if (pendingPointer) { point(pendingPointer); pendingPointer = undefined; }
      const dt = previous ? Math.min((now - previous) / 16.67, 2) : 1;
      previous = now;
      const blend = 1 - Math.pow(.91, dt);
      x += (targetX - x) * blend; y += (targetY - y) * blend;
      layer.style.transform = `translate3d(${x}px,${y}px,0) scale(1.04)`;
      if (ripples.length && context) context.clearRect(0, 0, width, height);
      for (let i = ripples.length - 1; i >= 0; i--) {
        const ripple = ripples[i]; ripple.radius += 1.3 * dt; ripple.life -= .014 * dt;
        if (ripple.life <= 0) { ripples.splice(i, 1); continue; }
        if (!context) continue;
        context.beginPath(); context.ellipse(ripple.x, ripple.y, ripple.radius * 1.75, ripple.radius * .38, 0, 0, Math.PI * 2);
        context.strokeStyle = `rgba(222,249,255,${ripple.life * .65})`; context.lineWidth = 1.5; context.stroke();
        context.beginPath(); context.arc(ripple.x + Math.sin(ripple.radius) * 8, ripple.y - ripple.radius * .2, 2 * ripple.life, 0, Math.PI * 2);
        context.fillStyle = `rgba(255,250,222,${ripple.life * .8})`; context.fill();
      }
      if (Math.abs(targetX - x) + Math.abs(targetY - y) > .05 || ripples.length) frame = requestAnimationFrame(tick);
      else { previous = 0; layer.style.willChange = ""; }
    };
    const schedule = () => { if (!frame) { layer.style.willChange = "transform"; frame = requestAnimationFrame(tick); } };
    const point = (event: PointerEvent, click = false) => {
      const box = host.getBoundingClientRect();
      const px = event.clientX - box.left, py = event.clientY - box.top;
      targetX = (.5 - px / Math.max(width, 1)) * 24;
      targetY = (.5 - py / Math.max(height, 1)) * 16;
      if (context && py > height * .52 && (click || performance.now() - lastRipple > 85)) {
        if (!surfaceReady) { surfaceReady = true; resize(); }
        ripples.push({ x: px, y: py, radius: 3, life: 1 });
        if (ripples.length > 32) ripples.shift();
        lastRipple = performance.now();
      }
    };
    // High-frequency pointer events are sampled once per frame, including the
    // layout read; do not read geometry for every coalesced hardware event.
    const move = (event: PointerEvent) => { pendingPointer = event; schedule(); };
    const down = (event: PointerEvent) => { pendingPointer = undefined; point(event, true); schedule(); };
    const leave = () => { pendingPointer = undefined; targetX = 0; targetY = 0; schedule(); };
    const observer = new ResizeObserver(resize); observer.observe(host); resize();
    host.addEventListener("pointermove", move); host.addEventListener("pointerdown", down); host.addEventListener("pointerleave", leave);
    return () => {
      cancelAnimationFrame(frame); observer.disconnect();
      host.removeEventListener("pointermove", move); host.removeEventListener("pointerdown", down); host.removeEventListener("pointerleave", leave);
      layer.style.transform = ""; layer.style.willChange = "";
      if (surface && surfaceReady) { surface.width = 0; surface.height = 0; }
    };
  }, [active, effect]);
  return <div ref={root} className={s.nativeScene} data-active={active} data-effect={effect}>
    <div ref={photo} className={s.nativePhoto}>{image ? <Image src={image} alt={alt} fill preload sizes="100vw" quality={75} /> : null}</div>
    {effect === "water" ? <canvas ref={canvas} className={s.nativeCanvas} aria-hidden /> : null}
    {effect === "clouds" && active ? <div className={s.clouds} aria-hidden><i /><i /><i /></div> : null}
    {scene ? <div className={scene.titleEmbedded ? s.accessibleTitle : s.nativeHeading} aria-label={scene.title}>
      <p>Perú · peruwonderstours</p>
      <h2>{Array.from(scene.title).map((letter, index) => <span key={index} style={{ animationDelay: `${Math.min(index, 30) * 45}ms` }} aria-hidden>{letter === " " ? "\u00a0" : letter}</span>)}<span className={s.accessibleTitle}>{scene.title}</span></h2>
    </div> : null}
  </div>;
}
