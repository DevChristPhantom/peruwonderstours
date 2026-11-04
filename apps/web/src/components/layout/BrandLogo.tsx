import Image from "next/image";
import s from "./BrandLogo.module.css";

/** Approved two-line logo: PeruWonders above Tours, with transparent background. */
export function BrandLogo({ alt = "", wide = false, preload = false }: { alt?: string; wide?: boolean; preload?: boolean }) {
  return <span className={`${s.frame} ${wide ? s.wide : ""}`}>
    <Image src="/brand/peruwonderstours-logo-two-lines.webp" alt={alt} width={1000} height={209} sizes={wide ? "260px" : "(max-width: 860px) 170px, 220px"} preload={preload} className={s.image} />
  </span>;
}
