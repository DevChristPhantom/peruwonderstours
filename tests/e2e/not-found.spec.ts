import { test, expect } from '@playwright/test';

const origin = process.env.E2E_WEB_BASE_URL ?? 'http://localhost:3100';
if (!process.env.CI || !['localhost', '127.0.0.1'].includes(new URL(origin).hostname)) {
  throw new Error('Not-found checks require disposable CI services.');
}

test('Broken links answer 404 with a prefilled search, popular tours and a WhatsApp report', async ({ page }) => {
  const response = await page.goto('/es/tours-en-machu-picchu-2024');
  expect(response?.status()).toBe(404);
  await expect(page.getByRole('heading', { level: 1, name: 'Esta página se salió del mapa' })).toBeVisible();
  // Next adds its own noindex to 404s; the page must never also emit the layout's "index, follow".
  const robots = await page.locator('meta[name="robots"]').evaluateAll((tags) => tags.map((t) => t.getAttribute('content') ?? ''));
  expect(robots.length).toBeGreaterThan(0);
  expect(robots.every((content) => content.includes('noindex'))).toBe(true);

  const search = page.getByLabel('¿Qué tour buscabas?', { exact: true });
  await expect(search).toHaveValue('machu picchu');
  await expect(page.getByRole('heading', { level: 2, name: 'Los más reservados' })).toBeVisible();
  expect(await page.locator('section:has(#populares-404) article').count()).toBeGreaterThan(0);

  const report = page.getByRole('link', { name: 'Avísanos por WhatsApp', exact: true });
  const text = new URL((await report.getAttribute('href')) ?? '').searchParams.get('text');
  expect(text).toContain('/es/tours-en-machu-picchu-2024');

  await search.press('Enter');
  await expect(page).toHaveURL(/\/es\/tours\?q=machu\+picchu/);
});

test('English 404 keeps the site chrome and translated copy', async ({ page }) => {
  const response = await page.goto('/en/this-page-does-not-exist');
  expect(response?.status()).toBe(404);
  await expect(page.getByRole('heading', { level: 1, name: 'This page wandered off the map' })).toBeVisible();
  await expect(page.locator('header').first()).toBeVisible();
  await expect(page.getByRole('link', { name: 'See all tours', exact: true })).toBeVisible();
});
