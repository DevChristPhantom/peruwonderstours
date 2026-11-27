import Image from "next/image";
import s from "./BrandLogo.module.css";

/** Client-supplied official logo, November 2026. Preserve full artwork. */
export function BrandLogo({ alt = "", wide = false, preload = false, header = false }: { alt?: string; wide?: boolean; preload?: boolean; header?: boolean }) {
  return <span className={`${s.frame} ${wide ? s.wide : ""} ${header ? s.header : ""}`}>
    <Image src="/brand/peruwonderstours-logo-circular.webp" alt={alt} width={480} height={480} sizes={header ? "(max-width: 860px) 48px, 56px" : wide ? "112px" : "52px"} preload={preload} className={s.image} />
  </span>;
}
