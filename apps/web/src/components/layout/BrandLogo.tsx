import Image from "next/image";
import s from "./BrandLogo.module.css";

/** Original owner-provided artwork; the frame displays its transparent margins without altering it. */
export function BrandLogo({ alt = "", wide = false, preload = false }: { alt?: string; wide?: boolean; preload?: boolean }) {
  return <span className={`${s.frame} ${wide ? s.wide : ""}`}>
    <Image src="/brand/peruwonderstours-condor.png" alt={alt} width={2172} height={724} sizes={wide ? "220px" : "(max-width: 860px) 146px, 195px"} preload={preload} className={s.image} />
  </span>;
}
