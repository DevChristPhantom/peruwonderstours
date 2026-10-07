import type { Metadata } from "next";
import Link from "next/link";

import { SiteFooter } from "@/components/layout/SiteFooter";
import { SiteHeader } from "@/components/layout/SiteHeader";
import { buttonClass } from "@/components/ui/button-styles";
import { getNavMedia } from "@/lib/catalog";

export const metadata: Metadata = {
  title: "Página no encontrada",
  robots: { index: false },
};

/** 404 útil (HU-0.2): enlaces a tours y destinos. */
export default async function NotFound() {
  const media = await getNavMedia();
  return (
    <>
      <SiteHeader media={media} />
      <main id="contenido" tabIndex={-1} className="pwt-container-narrow py-24 text-center focus:outline-none">
        <p className="text-label font-medium tracking-[0.08em] text-foreground-muted uppercase">Error 404</p>
        <h1 className="mt-2 font-display text-h1 font-medium">No encontramos esta página</h1>
        <p className="mt-3 text-foreground-muted">Puede que el tour haya cambiado de nombre. Busca entre todos nuestros tours.</p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Link href="/es/tours" className={buttonClass("primary", "lg")}>
            Ver todos los tours
          </Link>
          <Link href="/es/destinos" className={buttonClass("outline", "lg")}>
            Ver destinos
          </Link>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
