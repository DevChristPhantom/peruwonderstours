import manifest from '../content/tour-image-manifest.json';

const localBySource = new Map(manifest.map(record => [record.source, record.local]));

/** Archived and owned images use local paths; unrelated CMS values retain their origin.
 * localhost:3000 is the API default for PUBLIC_WEB_BASE_URL (local dev). */
export function catalogImageSource(source: string, publicWebBase = typeof process !== 'undefined' ? process.env.PUBLIC_WEB_BASE_URL : undefined): string {
  const local = localBySource.get(source);
  if (local) return local;
  try {
    const url = new URL(source, 'https://peruwonderstours.com');
    const hostname = url.hostname.toLowerCase();
    const ownedOrigins = new Set(['https://peruwonderstours.com', 'https://www.peruwonderstours.com', 'http://localhost:3000', 'http://127.0.0.1:3000', 'http://localhost:3100', 'http://127.0.0.1:3100', 'http://localhost:4000', 'http://127.0.0.1:4000']);
    if (publicWebBase) {
      try {
        const configured = new URL(publicWebBase);
        if (!configured.username && !configured.password && (configured.protocol === 'https:' || (configured.protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]'].includes(configured.hostname)))) ownedOrigins.add(configured.origin);
      } catch { /* Invalid configuration never authorizes a new origin. */ }
    }
    if (ownedOrigins.has(url.origin) && (url.pathname.startsWith('/tours/') || url.pathname === '/brand/media-pending.svg')) return `${url.pathname}${url.search}`;
    if (['andeanperutours.com', 'www.andeanperutours.com', 'turinet.turismoads.com', 'turinet.com.pe', 'www.turinet.com.pe'].includes(hostname)) return '/brand/media-pending.svg';
  } catch { /* Preserve the existing validation path for unrelated CMS values. */ }
  return source;
}
