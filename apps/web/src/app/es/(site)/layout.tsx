import { SiteFooter } from "@/components/layout/SiteFooter";
import { SiteHeader } from "@/components/layout/SiteHeader";
import { getNavMedia } from "@/lib/catalog";

export default async function SiteLayout({ children }: LayoutProps<"/es">) {
  const media = await getNavMedia();
  return (
    <>
      <SiteHeader media={media} />
      <main id="contenido" tabIndex={-1} className="focus:outline-none">
        {children}
      </main>
      <SiteFooter />
    </>
  );
}
