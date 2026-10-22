import Image from "next/image";
import s from "./BrandLogo.module.css";

/** Owner-provided logo (2026-10-22), negative version for the dark header and footer: navy → white, gold and green kept. */
export function BrandLogo({ alt = "", wide = false, preload = false }: { alt?: string; wide?: boolean; preload?: boolean }) {
  return <span className={`${s.frame} ${wide ? s.wide : ""}`}>
    <Image src="/brand/peruwonderstours-logo-negativo.png" alt={alt} width={1200} height={207} sizes={wide ? "260px" : "(max-width: 860px) 170px, 220px"} preload={preload} className={s.image} />
  </span>;
}
