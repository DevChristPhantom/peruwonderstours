import { colors } from "@pwt/ui/tokens";

import { encodeQr, qrPath } from "@/lib/qr/qrcode";

const QUIET = 4;

/**
 * QR en SVG renderizado en el servidor (sin JS en el cliente). Siempre módulos oscuros sobre fondo
 * claro, también en modo oscuro: los lectores necesitan ese contraste.
 */
export function QrCode({ value, label, size = 200 }: { value: string; label: string; size?: number }) {
  const qr = encodeQr(value);
  const dim = qr.size + QUIET * 2;
  return (
    <svg
      role="img"
      aria-label={label}
      viewBox={`0 0 ${dim} ${dim}`}
      width={size}
      height={size}
      shapeRendering="crispEdges"
      className="rounded-md"
    >
      <rect width={dim} height={dim} fill={colors.light.surface} />
      <path d={qrPath(qr, QUIET)} fill={colors.light.foreground} />
    </svg>
  );
}
