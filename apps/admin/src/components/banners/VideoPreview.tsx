"use client";
import { useState } from "react";
export function VideoPreview({ id, revision, title, hasPoster }: { id: string; revision: number; title: string; hasPoster: boolean }) {
  const [failed, setFailed] = useState(false);
  return <div className="mb-4 max-w-xl">
    <video controls muted playsInline preload="metadata" aria-label={`Vista previa del video: ${title}`}
      src={`/bff/banners/video?id=${encodeURIComponent(id)}&r=${revision}`}
      poster={hasPoster ? `/bff/banners/vista-previa?id=${encodeURIComponent(id)}&r=${revision}` : undefined}
      onError={() => setFailed(true)} className="aspect-[16/6] w-full rounded-md border border-border bg-surface-muted object-cover" />
    {failed ? <p role="status" className="mt-2 text-sm text-danger">No se pudo reproducir la vista previa. Usa un MP4 con video H.264 y vuelve a subirlo; no actives un archivo que no puedas revisar.</p> : null}
    {!hasPoster ? <p className="mt-2 text-xs text-foreground-muted">Sin portada estática. Recomendamos añadir una imagen al subir el video para las personas que prefieren menos movimiento.</p> : null}
  </div>;
}
