"use client";
import Image from "next/image";
import { ExternalLink, Pause, Play } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import s from "./OfficialResources.module.css";

export interface OfficialResource { id: string; url: string; label: string; image: string; photo?: boolean; logo?: boolean }
export function OfficialResources({ resources, title, description, externalHint, pauseLabel, playLabel }: {
  resources: OfficialResource[]; title: string; description: string; externalHint: string; pauseLabel: string; playLabel: string;
}) {
  const root = useRef<HTMLElement>(null);
  const [visible, setVisible] = useState(false);
  const [pageVisible, setPageVisible] = useState(true);
  const [paused, setPaused] = useState(false);
  useEffect(() => {
    const observer = new IntersectionObserver(([entry]) => setVisible(entry.isIntersecting));
    if (root.current) observer.observe(root.current);
    const visibility = () => setPageVisible(document.visibilityState === "visible");
    document.addEventListener("visibilitychange", visibility); visibility();
    return () => { observer.disconnect(); document.removeEventListener("visibilitychange", visibility); };
  }, []);
  const group = (clone: boolean) => <ul className={`${s.group} ${clone ? s.clone : ""}`} aria-hidden={clone || undefined}>
    {resources.map((resource) => <li key={resource.id}>
      <a href={resource.url} target="_blank" rel="noopener noreferrer" tabIndex={clone ? -1 : undefined} className={s.card}>
        <div className={`${s.art} ${resource.photo ? s.photo : ""} ${resource.logo ? s.logo : ""}`}>
          <Image src={resource.image} alt="" width={resource.logo ? 200 : resource.photo ? 240 : 68} height={resource.logo ? 90 : resource.photo ? 96 : 68} loading="lazy" sizes="240px" className={s.image} />
          <span className={s.open}><ExternalLink size={15} aria-hidden /></span>
        </div>
        <span className={s.name}>{resource.label}</span><span className="sr-only"> {externalHint}</span>
      </a>
    </li>)}
  </ul>;
  return <nav ref={root} aria-labelledby="enlaces-oficiales" aria-describedby="official-description" className={s.section}>
    <div className={`pwt-container ${s.heading}`}>
      <div><h2 id="enlaces-oficiales">{title}</h2><p id="official-description">{description}</p></div>
      <button type="button" className={s.pause} onClick={() => setPaused((value) => !value)} aria-label={paused ? playLabel : pauseLabel}>
        {paused ? <Play size={17} aria-hidden /> : <Pause size={17} aria-hidden />}<span>{paused ? playLabel : pauseLabel}</span>
      </button>
    </div>
    <div className={s.viewport}>
      <div className={s.track} data-running={visible && pageVisible && !paused}>{group(false)}{group(true)}</div>
    </div>
  </nav>;
}
