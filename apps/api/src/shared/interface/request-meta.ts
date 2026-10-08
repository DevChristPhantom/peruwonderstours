import type { Request } from 'express';
import type { RequestMeta } from '../application/audit.js';

/** IP (según TRUST_PROXY), User-Agent y X-Request-Id de la petición, para auditoría/evidencia. */
export function requestMeta(request: Request): RequestMeta {
  const requestId = request.headers['x-request-id'];
  const ua = request.headers['user-agent'];
  return {
    ip: request.ip ?? null,
    userAgent: typeof ua === 'string' ? ua.slice(0, 400) : null,
    requestId: typeof requestId === 'string' ? requestId.slice(0, 64) : null,
  };
}
