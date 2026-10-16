import { test, expect } from '@playwright/test';

const origin = process.env.E2E_WEB_BASE_URL ?? 'http://localhost:3100';
if (process.env.CI !== 'true' || !['localhost', '127.0.0.1'].includes(new URL(origin).hostname)) throw new Error('Journal checks require isolated CI servers.');

test('travel journal categories, sourced article and traveler submission work', async ({ page }) => {
  await page.goto('/es');
  const journal = page.getByRole('region', { name: 'Historias, leyendas y caminos por descubrir', exact: true });
  await journal.getByRole('link').filter({ hasText: 'Mitos y leyendas' }).click();
  await expect(page).toHaveURL(/\/es\/blog\?tema=leyendas$/);
  await page.getByRole('link', { name: 'Manco Cápac y Mama Ocllo: las voces del Titicaca', exact: true }).click();
  await expect(page.locator('main h1')).toHaveText('Manco Cápac y Mama Ocllo: las voces del Titicaca');
  await expect(page.getByRole('link', { name: 'Fuente: PROMPERÚ', exact: true })).toHaveAttribute('href', 'https://www.peru.travel/es/atractivos/lago-titicaca');
  await expect(page.locator('main')).toContainText('no una crónica histórica comprobada');
  await page.goto('/es/blog?tema=historias');
  await expect(page.getByRole('heading', { name: 'Tu viaje también merece contarse', exact: true })).toBeVisible();
  const submission = page.getByRole('link', { name: 'Proponer mi historia', exact: true });
  await expect(submission).toHaveAttribute('href', /^https:\/\/wa\.me\/51924278597\?text=/);
  await expect(submission).toHaveAttribute('target', '_blank');
  await page.goto('/pt/blog/taquile-arte-textil-patrimonio-vivo');
  await expect(page.locator('main h1')).toHaveText('Taquile: a tecelagem como patrimônio vivo');
  await expect(page.getByRole('link', { name: 'Fonte: UNESCO', exact: true })).toHaveAttribute('href', 'https://ich.unesco.org/en/RL/taquile-and-its-textile-art-00166');
});
