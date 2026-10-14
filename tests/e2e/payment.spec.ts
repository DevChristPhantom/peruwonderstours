import { test, expect } from "@playwright/test";

const origin = process.env.E2E_WEB_BASE_URL ?? "http://localhost:3100";
if (!process.env.CI || !["localhost", "127.0.0.1"].includes(new URL(origin).hostname)) throw new Error("Payments browser checks require disposable CI servers.");

for (const outcome of ["approved", "pending", "rejected"] as const) test(`checkout handles ${outcome} sandbox payment without a real provider`, async ({ page }, info) => {
  test.setTimeout(150000);
  const timings: { action: string; milliseconds: number }[] = [];
  async function measured(action: string, work: () => Promise<void>) {
    const start = performance.now(); await test.step(action, work);
    timings.push({ action, milliseconds: Math.round(performance.now() - start) });
  }
  try {
    await page.goto(`${origin}/es/tours/tour-islas-de-los-uros-y-taquile-full-day`);
    const booking = page.locator("#reservar-panel");
    await expect(booking).toBeVisible();
    await booking.locator('button[data-date]:not([aria-disabled="true"])').first().click();
    await booking.getByRole("button", { name: "Agregar al carrito", exact: true }).click();
    await expect(booking.getByRole("button", { name: "Agregado", exact: true })).toBeVisible();
    await page.goto(`${origin}/es/carrito`);
    await page.getByRole("link", { name: "Continuar con la reserva", exact: true }).first().click();
    await measured("Checkout contact", async () => {
      await page.getByLabel("Nombres", { exact: true }).fill("Viajero");
      await page.getByLabel("Apellidos", { exact: true }).fill("Sandbox CI");
      await page.getByLabel("Correo electrónico", { exact: true }).fill("sandbox-payment@peruwonderstours.test");
      await page.getByLabel("Celular (WhatsApp)", { exact: true }).fill("900000002");
      await page.getByLabel("País de residencia", { exact: true }).selectOption("Perú");
      await page.getByRole("button", { name: "Continuar a viajeros", exact: true }).click();
      await expect(page.getByRole("button", { name: "Continuar al pago", exact: true })).toBeVisible();
    });
    await measured("Validate traveler records and prepare payment", async () => {
      const names = page.getByLabel("Nombres y apellidos", { exact: true });
      const count = await names.count(); expect(count).toBeGreaterThan(0);
      for (let index = 0; index < count; index++) {
        await names.nth(index).fill(`Viajero Fixture ${index + 1}`);
        await page.getByLabel("Número de documento", { exact: true }).nth(index).fill(String(12345670 + index));
        await page.getByLabel("Nacionalidad", { exact: true }).nth(index).fill("Peruana");
      }
      await page.getByRole("button", { name: "Continuar al pago", exact: true }).click();
      // Critical guard: no payment click until the actual sandbox widget is present.
      await expect(page.getByText("Modo sandbox: pago simulado, no se realizará ningún cobro", { exact: true })).toBeVisible();
      await expect(page.getByRole("radio", { name: "Aprobado", exact: true })).toBeChecked();
    });
    await measured(`${outcome} simulated payment result`, async () => {
      await page.getByRole("radio", { name: outcome === "approved" ? "Aprobado" : outcome === "pending" ? "Pendiente (CIP)" : "Rechazado", exact: true }).check();
      await page.locator('input[name="terms"]').check();
      await expect(page.locator("#f-submit")).toBeEnabled();
      await page.locator("#f-submit").click();
      if (outcome === "rejected") {
        await expect(page.getByRole("alert").filter({ hasText: "Tu banco rechazó el pago" })).toBeVisible();
        await expect(page).toHaveURL(/\/es\/checkout/);
        await expect(page.getByRole("link", { name: "Ver mi reserva", exact: true })).toBeVisible();
        await page.getByRole("link", { name: "Ver mi reserva", exact: true }).click();
        await expect(page.locator("#booking-title")).toContainText(/reserva está pendiente de pago/);
        const unpaid = page.locator('section[aria-labelledby="pay-status"]').getByText("Monto pagado", { exact: true }).locator("..").locator("dd");
        expect(Number((await unpaid.innerText()).replace(/[^0-9]/g, "")), "Rejected payment leaves paid amount zero").toBe(0);
        return;
      }
      await expect(page).toHaveURL(/\/es\/reserva\/PWT-\d{4}-\d{6}/);
      await expect(page.locator("#booking-title")).toContainText(outcome === "approved" ? /reserva está (pagada|confirmada)/ : /reserva está pendiente de pago/);
      const paid = page.locator('section[aria-labelledby="pay-status"]').getByText("Monto pagado", { exact: true }).locator("..").locator("dd");
      const recordedPaid = Number((await paid.innerText()).replace(/[^0-9]/g, ""));
      if (outcome === "approved") expect(recordedPaid, "Approved payment records a positive amount").toBeGreaterThan(0);
      else expect(recordedPaid, "Pending payment does not record paid money").toBe(0);
      if (outcome === "approved") {
        const downloadReady = page.waitForEvent('download');
        await page.getByRole('button', { name: 'Añadir al calendario', exact: true }).click();
        const download = await downloadReady;
        expect(download.suggestedFilename()).toMatch(/^reserva-PWT-\d{4}-\d{6}\.ics$/);
        expect(await download.failure()).toBeNull();
        await download.saveAs(info.outputPath('reservation.ics'));
      }
      await expect(page.getByText("No pudimos completar el pago:", { exact: true })).toHaveCount(0);
      await page.screenshot({ path: info.outputPath("sandbox-reservation.png"), fullPage: true });
    });
  } finally {
    await info.attach("sandbox-payment-action-timings.json", { body: JSON.stringify(timings, null, 2), contentType: "application/json" });
  }
});
