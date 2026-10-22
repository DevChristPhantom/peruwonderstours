import type { Metadata } from "next";
import { BannerManager } from "@/components/banners/BannerManager";
import type { HeroBanner } from "@/components/banners/types";
import { PageHeader } from "@/components/ui/Layout";
import { ErrorPanel } from "@/components/ui/ErrorPanel";
import { apiData } from "@/lib/api/client";
import { can, load, requireSession } from "@/lib/auth/guard";

export const metadata: Metadata = { title: "Banners de inicio" };
export default async function BannersPage() {
  const session = await requireSession();
  const permitted = can(session, "tours:read");
  const result = permitted ? await load(() => apiData<HeroBanner[]>("/admin/hero-banners")) : null;
  return <>
    <PageHeader title="Banners de inicio" description="Gestiona las imágenes, los videos MP4 y el orden de los banners de la portada." />
    {!permitted ? <ErrorPanel error={{ status: 403, code: "insufficient-permissions", message: "No tienes permiso para consultar los banners." }} />
      : result && !result.ok ? <ErrorPanel error={result.error} />
      : <BannerManager initial={result?.ok ? result.data : []} canUpload={can(session, "media:upload", "tours:write")} canEdit={can(session, "tours:write")} />}
  </>;
}
