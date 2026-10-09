import { CompareTray } from "@/components/compare/CompareTray";
import { SiteFooter } from "@/components/layout/SiteFooter";
import { SiteHeader } from "@/components/layout/SiteHeader";
import { getNavMedia } from "@/lib/catalog";

// ISR del catálogo: se regenera cada hora o al invalidar el tag `catalog` (lib/catalog/api-repository.ts).
export const revalidate = 3600;

export default async function SiteLayout({ children }: LayoutProps<"/es">) {
  const media = await getNavMedia();
  return (
    <>
      <SiteHeader media={media} />
      <main id="contenido" tabIndex={-1} className="focus:outline-none">
        {children}
      </main>
      <SiteFooter />
      <CompareTray />
    </>
  );
}
