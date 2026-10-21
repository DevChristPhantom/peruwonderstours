import { getTranslations } from "next-intl/server";

import type { CatalogImage } from "@/lib/catalog/types";
import { getHeroBanners } from "@/lib/content/hero-banners";
import { HeroMotion } from "./HeroMotion";
import s from "./Hero.module.css";

/** Hero a pantalla completa (Server Component). El header se superpone desde el layout. */
export async function Hero({ image }: { image: CatalogImage | null }) {
  const [t, scenes] = await Promise.all([getTranslations("home.hero"), getHeroBanners()]);
  return (
    <section className={s.hero} aria-labelledby="hero-title">
      <HeroMotion scenes={scenes} fallback={image} />

      <div className={s.copy}>
        <h1 id="hero-title" className={s.title}>
          {t("title")}
        </h1>
        <p className={s.lead}>{t("lead")}</p>
      </div>
    </section>
  );
}
