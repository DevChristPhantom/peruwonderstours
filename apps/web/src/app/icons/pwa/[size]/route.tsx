import { ImageResponse } from "next/og";

import { colors, palette } from "@pwt/ui/tokens";

/** Íconos PNG del voucher instalable (HU-B.A2), generados en el build sin archivos binarios. */
const SIZES = ["192", "512"] as const;

export const dynamicParams = false;

export function generateStaticParams() {
  return SIZES.map((size) => ({ size }));
}

export async function GET(_req: Request, ctx: RouteContext<"/icons/pwa/[size]">) {
  const { size } = await ctx.params;
  const px = Number(size);
  if (!SIZES.includes(size as (typeof SIZES)[number])) return new Response("Not found", { status: 404 });
  // Montaña (dorado) sobre el lago (titicaca); dentro de la zona segura del 80 % para "maskable".
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: colors.light.primary,
        }}
      >
        <svg width={px * 0.56} height={px * 0.56} viewBox="0 0 100 100">
          <path d="M8 66 L34 34 L48 50 L64 24 L92 66 Z" fill={palette.dorado[300]} />
          <path d="M8 76 H92" stroke={palette.titicaca[200]} strokeWidth="5" strokeLinecap="round" />
          <path d="M20 86 H80" stroke={palette.titicaca[300]} strokeWidth="5" strokeLinecap="round" />
        </svg>
      </div>
    ),
    { width: px, height: px },
  );
}
