const RETIRED_HOSTS = new Set(['andeanperutours.com', 'www.andeanperutours.com', 'turinet.turismoads.com', 'turinet.com.pe', 'www.turinet.com.pe']);

/** Lightweight client guard for old persisted cart snapshots; no image manifest. */
export function retiredImageGuard(source: string): string {
  try {
    if (RETIRED_HOSTS.has(new URL(source, 'https://peruwonderstours.com').hostname.toLowerCase())) return '/brand/media-pending.svg';
  } catch { /* Unrelated CMS values keep their existing validation behavior. */ }
  return source;
}
