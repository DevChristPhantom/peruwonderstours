import Image from "next/image";
import { getTranslations } from "next-intl/server";

import type { CatalogImage } from "@/lib/catalog/types";
import s from "./Hero.module.css";

/** Hero a pantalla completa (Server Component). El header se superpone desde el layout. */
export async function Hero({ image }: { image: CatalogImage | null }) {
  const t = await getTranslations("home.hero");
  return (
    <section className={s.hero} aria-labelledby="hero-title">
      <div className={s.bg} role="img" aria-label={image?.alt ?? t("imageAlt")}>
        {image ? <Image src={image.src} alt="" fill preload sizes="100vw" quality={75} /> : null}
      </div>

      <div className={s.cue} aria-hidden="true">
        <span>(</span>
        <span>{t("scroll")}</span>
        <span>)</span>
      </div>

      <div className={s.copy}>
        <h1 id="hero-title" className={s.title}>
          {t("title")}
        </h1>
        <p className={s.lead}>{t("lead")}</p>
      </div>
    </section>
  );
}
