import "server-only";

import { resolveMediaUrl } from "@/lib/content";
import { env } from "@/lib/env";

/** Base pública de los medios: `MEDIA_PUBLIC_BASE_URL` o el origen de la API + `/media`. */
export function mediaBase(): string {
  const e = env();
  return e.MEDIA_PUBLIC_BASE_URL ?? `${new URL(e.API_BASE_URL).origin}/media`;
}

/** `storageKey` (o URL absoluta heredada) → URL para `<img>` en el panel. */
export function mediaUrl(keyOrUrl: string | null | undefined): string | null {
  return resolveMediaUrl(keyOrUrl, mediaBase(), env().PUBLIC_WEB_BASE_URL);
}
