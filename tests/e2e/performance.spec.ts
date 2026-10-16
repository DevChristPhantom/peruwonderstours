import { test, expect } from '@playwright/test';

const origin = process.env.E2E_WEB_BASE_URL ?? 'http://localhost:3100';
if (process.env.CI !== 'true' || !['localhost', '127.0.0.1'].includes(new URL(origin).hostname)) throw new Error('Performance probes require isolated CI services.');

for (const width of [1280, 390]) test(`public performance probe at ${width}px`, async ({ page }, info) => {
  const retiredRequests: string[] = [];
  await page.route(/https?:\/\/(?:www\.)?(?:andeanperutours\.com|turinet\.turismoads\.com|turinet\.com\.pe)(?:[/:?#]|$)/i, route => {
    retiredRequests.push(route.request().url());
    return route.abort('failed');
  });
  await page.setViewportSize({ width, height: 844 });
  await page.addInitScript(() => {
    const sample = { lcpMs: null as number | null, layoutShiftSum: 0, longTaskMs: 0 };
    Object.assign(window, { __pwtPerformance: sample });
    for (const type of ['largest-contentful-paint', 'layout-shift', 'longtask']) {
      if (!PerformanceObserver.supportedEntryTypes.includes(type)) continue;
      new PerformanceObserver(list => {
        for (const entry of list.getEntries()) {
          if (type === 'largest-contentful-paint') sample.lcpMs = entry.startTime;
          if (type === 'layout-shift') {
            const shift = entry as PerformanceEntry & { hadRecentInput: boolean; value: number };
            if (!shift.hadRecentInput) sample.layoutShiftSum += shift.value;
          }
          if (type === 'longtask') sample.longTaskMs += entry.duration;
        }
      }).observe({ type, buffered: true });
    }
  });
  await page.goto('/es');
  await expect(page.locator('#hero-title')).toBeVisible();
  const activeImage = page.locator('[data-active="true"][data-effect] img').first();
  await expect.poll(() => activeImage.evaluate((image: HTMLImageElement) => image.complete && image.naturalWidth > 0)).toBe(true);
  const metrics = await page.evaluate(async () => {
    await new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
    const nav = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
    const paints = performance.getEntriesByType('paint');
    return {
      sample: (window as typeof window & { __pwtPerformance?: unknown }).__pwtPerformance,
      ttfbMs: nav.responseStart - nav.requestStart,
      domReadyMs: nav.domContentLoadedEventEnd - nav.startTime,
      fcpMs: paints.find(paint => paint.name === 'first-contentful-paint')?.startTime ?? null,
      scriptEncodedBytes: (performance.getEntriesByType('resource') as PerformanceResourceTiming[]).filter(entry => entry.initiatorType === 'script').reduce((total, entry) => total + entry.encodedBodySize, 0),
      horizontalOverflow: document.documentElement.scrollWidth > innerWidth + 1,
    };
  });
  expect(metrics.horizontalOverflow).toBe(false);
  // Catalog API images are separate from native hero posters and pass through Next's optimizer.
  const productImage = page.locator('section[aria-labelledby="paquetes-title"] article img').first();
  await productImage.scrollIntoViewIfNeeded();
  await expect.poll(() => productImage.evaluate((image: HTMLImageElement) => image.complete && image.naturalWidth > 0)).toBe(true);
  await expect(productImage).not.toHaveAttribute('src', /andeanperutours|turinet\.turismoads/i);
  const productUrl = new URL((await productImage.getAttribute('src'))!, origin);
  expect(productUrl.searchParams.get('url') ?? productUrl.pathname).toMatch(/^\/tours\//);

  expect(retiredRequests, 'The homepage must not request the retired website').toEqual([]);
  let bannerBytes = 0;
  for (const name of ['titicaca-0.webp', 'machu-picchu-0.webp']) {
    const response = await page.request.get(`/hero-motion/${name}`);
    expect(response.status()).toBe(200);
    bannerBytes += (await response.body()).byteLength;
  }
  expect(bannerBytes, 'Combined original banner assets stay within the optimized 800KB budget').toBeLessThan(800_000);
  await info.attach('performance-probe.json', { body: JSON.stringify({ environment: 'CI localhost Chromium; no CPU/network throttling; snapshot, not field Core Web Vitals', viewport: width, metrics, bannerBytes }, null, 2), contentType: 'application/json' });
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
  await page.screenshot({ path: info.outputPath(`home-${width}.png`) });
});
