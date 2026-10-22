"use client";
import Image from "next/image";
import { useEffect, useRef } from "react";
import s from "./Hero.module.css";

/** Narrow screens get the lighter 720p file when the scene has one (1080p ≈ 32 MB). */
const MOBILE_QUERY = "(max-width: 900px)";

/** Fetch only the current video, after motion preferences are known. The poster is the LCP. */
export function HeroVideoScene({ source: desktopSource, mobileSource, poster, playing, loop, onEnded, onBlocked }: {
  source: string; mobileSource?: string; poster?: string; playing: boolean; loop: boolean; onEnded: () => void; onBlocked: () => void;
}) {
  const source = mobileSource && typeof window !== "undefined" && window.matchMedia(MOBILE_QUERY).matches ? mobileSource : desktopSource;
  const video = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    const element = video.current;
    if (!element) return;
    if (!playing) { element.pause(); return; }
    let cancelled = false;
    if (!element.getAttribute("src")) { element.src = source; element.load(); }
    element.muted = true;
    void element.play().then(() => { if (cancelled) element.pause(); }).catch(() => { if (!cancelled) onBlocked(); });
    return () => { cancelled = true; element.pause(); };
  }, [source, playing, onBlocked]);
  return <div className={s.bg} data-active="true" data-effect="video">
    {poster ? <Image src={poster} alt="" fill priority sizes="100vw" /> : null}
    <video ref={video} className={s.heroVideo} poster={poster} muted loop={loop} playsInline preload="none" aria-hidden="true" tabIndex={-1} onEnded={onEnded}
      onPlaying={(event) => { event.currentTarget.style.opacity = "1"; }}
      onError={(event) => { event.currentTarget.style.opacity = "0"; onBlocked(); }} />
  </div>;
}
