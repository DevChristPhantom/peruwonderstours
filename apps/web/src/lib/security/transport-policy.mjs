/** Only literal HTTP loopback origins qualify; forwarded headers never relax transport policy. */
export function isHttpLoopback(/** @type {string | URL} */ value) {
  try {
    const url = new URL(value);
    return url.protocol === 'http:' && !url.username && !url.password &&
      ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
  } catch { return false; }
}

/** Static headers are compiled: the exception requires both explicit demo mode and a local web origin. */
export function isLocalHttpDemo(/** @type {string | undefined} */ demoBuild, /** @type {string | undefined} */ publicWebBase) {
  return demoBuild === '1' && typeof publicWebBase === 'string' && isHttpLoopback(publicWebBase);
}

/** A direct local demo may display uploaded API media, limited to its explicit loopback origin. */
export function localDemoMediaOrigin(
  /** @type {string | undefined} */ demoBuild,
  /** @type {string | undefined} */ publicWebBase,
  /** @type {string | undefined} */ mediaBase,
  /** @type {string | undefined} */ apiBase,
) {
  if (!isLocalHttpDemo(demoBuild, publicWebBase)) return null;
  const source = mediaBase || apiBase;
  if (!source || !isHttpLoopback(source)) return null;
  return new URL(source).origin;
}
