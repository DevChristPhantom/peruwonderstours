"use client";
import { ChevronLeft, ChevronRight, Pause, Play } from "lucide-react";
import { NativeHeroScene } from "./NativeHeroScene";
import { HeroVideoScene } from "./HeroVideoScene";
import { useTranslations } from "next-intl";
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import type { CatalogImage } from "@/lib/catalog/types";
import type { HeroBannerScene } from "@/lib/content/hero-banners";
import s from "./Hero.module.css";

const queries = ["(prefers-reduced-motion: reduce)", "(hover: hover) and (pointer: fine)"];
function subscribeMotion(callback: () => void) {
  const media = queries.map((query) => window.matchMedia(query));
  media.forEach((query) => query.addEventListener("change", callback));
  return () => media.forEach((query) => query.removeEventListener("change", callback));
}
const motionSnapshot = () => !window.matchMedia(queries[0]).matches && window.matchMedia(queries[1]).matches;
/** Cambio automático de escena: en todo dispositivo salvo "reducir movimiento" (los efectos siguen limitados). */
const autoplaySnapshot = () => !window.matchMedia(queries[0]).matches;
/** Duración de cada escena (ms); la línea de progreso usa la misma vía `--hero-interval`. */
const INTERVAL_MS = 7_000;

export function HeroMotion({ scenes, fallback }: { scenes: HeroBannerScene[]; fallback: CatalogImage | null }) {
  const t = useTranslations("home.hero");
  const root = useRef<HTMLDivElement>(null);
  const motionAllowed = useSyncExternalStore(subscribeMotion, motionSnapshot, () => false);
  const autoplayAllowed = useSyncExternalStore(subscribeMotion, autoplaySnapshot, () => false);
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const [userStarted, setUserStarted] = useState(false);
  const playbackBlocked = useCallback(() => setPaused(true), []);
  const [visit, setVisit] = useState(0);
  const [visible, setVisible] = useState(true);
  const [pageVisible, setPageVisible] = useState(true);
  // Pausa temporal mientras se usan los controles con teclado o el puntero está sobre ellos.
  const [hold, setHold] = useState(false);
  const scene = scenes[index % Math.max(1, scenes.length)];
  const running = motionAllowed && !paused && visible && pageVisible;
  const videoPlaying = (autoplayAllowed || userStarted) && !paused && visible && pageVisible;
  const autoplay = autoplayAllowed && !paused && visible && pageVisible && !hold && scenes.length > 1;
  useEffect(() => {
    const preference = window.matchMedia(queries[0]);
    const changed = () => { setUserStarted(false); };
    preference.addEventListener("change", changed);
    return () => preference.removeEventListener("change", changed);
  }, []);
  useEffect(() => {
    const observer = new IntersectionObserver(([entry]) => setVisible(entry.isIntersecting));
    if (root.current) observer.observe(root.current);
    const visibility = () => setPageVisible(document.visibilityState === "visible");
    document.addEventListener("visibilitychange", visibility);
    visibility();
    return () => { observer.disconnect(); document.removeEventListener("visibilitychange", visibility); };
  }, []);
  useEffect(() => {
    if (!autoplay || scene?.video) return;
    // Un temporizador por escena: elegir otra a mano reinicia la cuenta y el carrusel sigue solo.
    const timer = setTimeout(() => setIndex((previous) => (previous + 1) % scenes.length), INTERVAL_MS);
    return () => clearTimeout(timer);
  }, [autoplay, scenes.length, index, visit, scene?.video]);
  const select = (next: number) => {
    setIndex((next + scenes.length) % scenes.length);
    setVisit((previous) => previous + 1);
  };
  const poster = scene?.poster ?? fallback?.src;
  return <div ref={root} className={s.motionRoot}>
    {scene?.video ? <HeroVideoScene key={`${scene.id}:${visit}`} source={scene.video} mobileSource={scene.videoMobile} poster={poster} playing={videoPlaying} loop={scenes.length === 1} onEnded={() => { if (videoPlaying && scenes.length > 1) select(index + 1); }} onBlocked={playbackBlocked} />
      : <NativeHeroScene key={`${scene?.id ?? "fallback"}:${visit}`} scene={scene} image={poster} alt={scene?.title ?? fallback?.alt ?? ""} active={running} />}
    {scene && (scenes.length > 1 || motionAllowed || scene.video) ? <div className={s.controls} style={{ "--hero-interval": `${INTERVAL_MS}ms` } as React.CSSProperties}
      onPointerEnter={(event) => { if (event.pointerType === "mouse") setHold(true); }} onPointerLeave={() => setHold(false)}
      onFocus={(event) => { if (event.target.matches(":focus-visible")) setHold(true); }}
      onBlur={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) setHold(false); }} role="group" aria-label={t("banners")}>
      {/* Una línea por escena: la activa se llena durante su turno y se detiene con pausa, teclado o puntero encima. */}
      {scenes.length > 1 ? <div className={s.progress}>
        {scenes.map((item, position) => {
          const current = position === index % scenes.length;
          return <button key={item.id} type="button" className={s.segment} onClick={() => select(position)} aria-label={t("showBanner", { name: item.title })} aria-pressed={current}>
            <span className={s.track}>{current ? <span key={`${index}:${visit}:${autoplay}`} className={s.fill} data-mode={autoplay && !scene.video ? "playing" : "static"} /> : null}</span>
          </button>;
        })}
      </div> : null}
      <div className={s.buttons}>
        {scenes.length > 1 ? <>
          <button type="button" className={s.control} onClick={() => select(index - 1)} aria-label={t("previousBanner")}><ChevronLeft aria-hidden size={18} strokeWidth={1.5} /></button>
          <button type="button" className={s.control} onClick={() => select(index + 1)} aria-label={t("nextBanner")}><ChevronRight aria-hidden size={18} strokeWidth={1.5} /></button>
        </> : null}
        {scene.video || (autoplayAllowed && scenes.length > 1) ? <button type="button" className={s.control} onClick={() => {
          if (paused || (!autoplayAllowed && !userStarted)) { setUserStarted(true); setPaused(false); }
          else setPaused(true);
        }} aria-label={paused || (!autoplayAllowed && !userStarted) ? t("playBanner") : t("pauseBanner")}>{paused || (!autoplayAllowed && !userStarted) ? <Play aria-hidden size={14} strokeWidth={1.5} /> : <Pause aria-hidden size={14} strokeWidth={1.5} />}</button> : null}
      </div>
    </div> : null}
  </div>;
}
