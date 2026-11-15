import { test, expect } from '@playwright/test';

const origin = process.env.E2E_WEB_BASE_URL ?? 'http://localhost:3100';
if (!process.env.CI || !['localhost', '127.0.0.1'].includes(new URL(origin).hostname)) {
  throw new Error('Currency checks require disposable CI services.');
}

// Client rule (2026-11-15): Peru residents see and pay soles (national rate); everyone else US dollars.
// Thousands and decimal separators follow the page language (es/en "1,234.00", pt "1.234,00").
const SOLES = /S\/\s[\d.,]+[.,]\d{2}/;
const DOLLARS = /USD\s[\d.,]+[.,]\d{2}/;

test('Spanish shows soles first, the residency choice switches the booking panel to dollars and persists', async ({ page }) => {
  await page.goto('/es/tours/tour-full-day-canon-del-colca');
  const booking = page.locator('#reservar-panel');
  const national = booking.getByRole('radio', { name: 'Residente en el Perú (S/)', exact: true });
  const foreign = booking.getByRole('radio', { name: 'Extranjero (US$)', exact: true });
  await expect(national).toBeChecked();
  await expect(booking.locator('.text-price-lg')).toHaveText(SOLES);

  await foreign.check({ force: true });
  await expect(foreign).toBeChecked();
  await expect(booking.locator('.text-price-lg')).toHaveText(DOLLARS);

  // The choice is remembered on catalog cards, which still show the other price underneath.
  await page.goto('/es/tours');
  const firstCard = page.locator('main article').first();
  await expect(firstCard).toContainText(DOLLARS);
  await expect(firstCard).toContainText(/Residentes en el Perú: desde S\/\s[\d.,]+[.,]\d{2}/);
});

test('English defaults to dollars and still informs the Peru resident price', async ({ page }) => {
  await page.goto('/en/tours');
  const firstCard = page.locator('main article').first();
  await expect(firstCard).toContainText(DOLLARS);
  await expect(firstCard).toContainText(/Peru residents: from S\/\s[\d.,]+[.,]\d{2}/);
});
