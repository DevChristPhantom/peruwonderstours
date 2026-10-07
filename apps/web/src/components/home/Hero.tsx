import Image from "next/image";

import type { CatalogImage } from "@/lib/catalog/types";
import s from "./Hero.module.css";

/** Hero a pantalla completa (Server Component). El header se superpone desde el layout. */
export function Hero({ image }: { image: CatalogImage | null }) {
  return (
    <section className={s.hero} aria-labelledby="hero-title">
      <div className={s.bg} role="img" aria-label={image?.alt ?? "Paisaje del sur del Perú"}>
        {image ? <Image src={image.src} alt="" fill preload sizes="100vw" quality={75} /> : null}
      </div>

      <div className={s.cue} aria-hidden="true">
        <span>(</span>
        <span>desliza</span>
        <span>)</span>
      </div>

      <div className={s.copy}>
        <h1 id="hero-title" className={s.title}>
          El Perú, contado desde Puno
        </h1>
        <p className={s.lead}>Tours y paquetes con guías locales, precios claros y reserva con el 50 %.</p>
      </div>
    </section>
  );
}
