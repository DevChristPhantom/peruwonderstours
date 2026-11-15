import Image from "next/image";
import s from "./BrandLogo.module.css";

/** Client-supplied official logo, November 2026. Preserve full artwork. */
export function BrandLogo({ alt = "", wide = false, preload = false, header = false }: { alt?: string; wide?: boolean; preload?: boolean; header?: boolean }) {
  return <span className={`${s.frame} ${wide ? s.wide : ""} ${header ? s.header : ""}`}>
    <Image src={header ? "/brand/peruwonderstours-header-20261115.webp" : "/brand/peruwonderstours-logo-official-20261115.webp"} alt={alt} width={header ? 1100 : 1200} height={header ? 198 : 600} sizes={header ? "(max-width: 860px) 190px, 240px" : wide ? "260px" : "112px"} preload={preload} className={s.image} />
  </span>;
}
