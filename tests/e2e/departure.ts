import { expect, type Locator } from "@playwright/test";

const NEXT_MONTH = /^(Mes siguiente|Próximo mês|Next month)$/;

/**
 * First bookable day in the departure calendar. The calendar opens on the month of
 * tomorrow, which near a month's end can have no bookable day left (booking cutoff);
 * like a traveler, move on to the next month instead of depending on today's date.
 * Returns a locator pinned to that date so later re-renders cannot shift it.
 */
export async function firstBookableDate(booking: Locator, months = 3): Promise<Locator> {
  const date = booking.locator('button[data-date]:not([aria-disabled="true"])').first();
  for (let month = 1; month < months; month++) {
    if (await date.waitFor({ state: "visible", timeout: 10_000 }).then(() => true, () => false)) break;
    await booking.getByRole("button", { name: NEXT_MONTH }).click();
  }
  await expect(date).toBeVisible();
  return booking.locator(`button[data-date="${await date.getAttribute("data-date")}"]`);
}
