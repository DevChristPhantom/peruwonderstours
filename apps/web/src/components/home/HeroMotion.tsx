"use client";
import { ChevronLeft, ChevronRight, Pause, Play } from "lucide-react";
import { NativeHeroScene } from "./NativeHeroScene";
import { useTranslations } from "next-intl";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
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

export function HeroMotion({ scenes, fallback }: { scenes: HeroBannerScene[]; fallback: CatalogImage | null }) {
  const t = useTranslations("home.hero");
  const root = useRef<HTMLDivElement>(null);
  const motionAllowed = useSyncExternalStore(subscribeMotion, motionSnapshot, () => false);
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const [manual, setManual] = useState(false);
  const [visit, setVisit] = useState(0);
  const [visible, setVisible] = useState(true);
  const [pageVisible, setPageVisible] = useState(true);
  const [focused, setFocused] = useState(false);
  const scene = scenes[index % Math.max(1, scenes.length)];
  const running = motionAllowed && !paused && visible && pageVisible;
  useEffect(() => {
    const observer = new IntersectionObserver(([entry]) => setVisible(entry.isIntersecting));
    if (root.current) observer.observe(root.current);
    const visibility = () => setPageVisible(document.visibilityState === "visible");
    document.addEventListener("visibilitychange", visibility);
    visibility();
    return () => { observer.disconnect(); document.removeEventListener("visibilitychange", visibility); };
  }, []);
  useEffect(() => {
    if (!running || manual || focused || scenes.length < 2) return;
    const timer = setInterval(() => setIndex((previous) => (previous + 1) % scenes.length), 12_000);
    return () => clearInterval(timer);
  }, [running, manual, focused, scenes.length, index]);
  const select = (next: number) => {
    setIndex((next + scenes.length) % scenes.length);
    setVisit((previous) => previous + 1);
    setPaused(false);
    setManual(true);
  };
  const poster = scene?.poster ?? fallback?.src;
  return <div ref={root} className={s.motionRoot}>
    <NativeHeroScene key={`${scene?.id ?? "fallback"}:${visit}`} scene={scene} image={poster} alt={scene?.title ?? fallback?.alt ?? ""} active={running} />
    {scene && (scenes.length > 1 || motionAllowed) ? <div className={s.controls} onFocus={() => setFocused(true)} onBlur={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) setFocused(false); }} role="group" aria-label={t("banners")}>
      {scenes.length > 1 ? <>
        <button type="button" onClick={() => select(index - 1)} aria-label={t("previousBanner")}><ChevronLeft aria-hidden size={18} /></button>
        {scenes.map((item, position) => <button key={item.id} type="button" onClick={() => select(position)} aria-label={t("showBanner", { name: item.title })} aria-pressed={position === index % scenes.length}><span className={s.dot} /></button>)}
        <button type="button" onClick={() => select(index + 1)} aria-label={t("nextBanner")}><ChevronRight aria-hidden size={18} /></button>
      </> : null}
      {motionAllowed ? <button type="button" onClick={() => { setPaused((previous) => !previous); setManual(false); }} aria-label={paused ? t("playBanner") : t("pauseBanner")}>{paused ? <Play aria-hidden size={16} /> : <Pause aria-hidden size={16} />}</button> : null}
    </div> : null}
  </div>;
}
