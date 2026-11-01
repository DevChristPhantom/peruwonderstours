import { test, expect, type Page } from "@playwright/test";
import { firstBookableDate } from "./departure";

const origin = process.env.E2E_WEB_BASE_URL ?? "http://localhost:3100";
if (!process.env.CI || !["localhost", "127.0.0.1"].includes(new URL(origin).hostname)) throw new Error("Payment resilience checks require disposable CI servers.");
const tourPath = "/es/tours/tour-islas-de-los-uros-y-taquile-full-day";

/** Server Actions (POST con cabecera Next-Action) que salen hacia `path` mientras dure la prueba. */
function trackActions(page: Page, path: RegExp) {
  const sent: string[] = [];
  page.on("request", (request) => {
    if (request.method() === "POST" && request.headers()["next-action"] && path.test(new URL(request.url()).pathname)) sent.push(request.url());
  });
  return sent;
}

/** Retrasa las Server Actions (servidor lento): el viajero tiene tiempo de insistir con el botón. */
async function slowActions(page: Page, path: RegExp, milliseconds: number) {
  await page.route(
    (url) => path.test(url.pathname),
    async (route) => {
      if (route.request().method() === "POST" && route.request().headers()["next-action"]) await new Promise((r) => setTimeout(r, milliseconds));
      await route.fallback();
    },
  );
}

/** Varios clics en el mismo instante (antes de que React vuelva a pintar el botón deshabilitado). */
const burstClick = (page: Page, selector: string, times: number) =>
  page.locator(selector).evaluate((button: HTMLButtonElement, n) => {
    for (let i = 0; i < n; i++) button.click();
  }, times);

/** Muestra si en algún momento apareció el aviso de pago fallido (aunque luego se navegue). */
async function watchPaymentErrors(page: Page) {
  await page.addInitScript(() => {
    const flag = "__paymentErrorSeen";
    (window as unknown as Record<string, boolean>)[flag] = false;
    new MutationObserver(() => {
      if (document.body?.innerText.includes("No pudimos completar el pago")) (window as unknown as Record<string, boolean>)[flag] = true;
    }).observe(document, { subtree: true, childList: true, characterData: true });
  });
  return () => page.evaluate(() => (window as unknown as Record<string, boolean>)["__paymentErrorSeen"]);
}

async function checkoutToPayment(page: Page) {
  await page.goto(tourPath);
  const booking = page.locator("#reservar-panel");
  await (await firstBookableDate(booking)).click();
  await booking.getByRole("button", { name: "Agregar al carrito", exact: true }).click();
  await expect(booking.getByRole("button", { name: "Agregado", exact: true })).toBeVisible();
  await page.goto("/es/carrito");
  await page.getByRole("link", { name: "Continuar con la reserva", exact: true }).first().click();
  await page.getByLabel("Nombres", { exact: true }).fill("Viajero");
  await page.getByLabel("Apellidos", { exact: true }).fill("Resiliencia CI");
  await page.getByLabel("Correo electrónico", { exact: true }).fill("resilience@peruwonderstours.test");
  await page.getByLabel("Celular (WhatsApp)", { exact: true }).fill("900000004");
  await page.getByLabel("País de residencia", { exact: true }).selectOption("Perú");
  await page.getByRole("button", { name: "Continuar al pago", exact: true }).click();
  await expect(page.getByText("Modo sandbox: pago simulado, no se realizará ningún cobro", { exact: true })).toBeVisible();
  const ack = page.locator("#f-ackPrice");
  if (await ack.count()) await ack.check();
  await page.locator('input[name="terms"]').check();
}

test("slow network and repeated Pay clicks create one booking and one charge", async ({ page, context }, info) => {
  test.setTimeout(180_000);
  const errorSeen = await watchPaymentErrors(page);
  // Conexión lenta para todo el flujo (latencia alta y poco ancho de banda).
  const cdp = await context.newCDPSession(page);
  await cdp.send("Network.enable");
  await cdp.send("Network.emulateNetworkConditions", { offline: false, latency: 400, downloadThroughput: 200_000, uploadThroughput: 100_000 });

  await checkoutToPayment(page);
  await page.getByRole("radio", { name: "Aprobado", exact: true }).check();
  const checkoutPath = /^\/es\/checkout$/;
  await slowActions(page, checkoutPath, 2_500);
  const sent = trackActions(page, checkoutPath);

  await burstClick(page, "#f-submit", 3);
  await expect(page.locator("#f-submit")).toBeDisabled();
  // Más insistencia mientras la primera sigue en curso.
  await page.locator("#f-submit").dispatchEvent("click");
  await page.locator("#f-submit").dispatchEvent("click");

  await expect(page).toHaveURL(/\/es\/reserva\/PWT-\d{4}-\d{6}/, { timeout: 60_000 });
  await expect(page.locator("#booking-title")).toContainText(/reserva está (pagada|confirmada)/);
  expect(sent, "Una sola llamada de reserva y pago por más clics que haya").toHaveLength(1);
  expect(await errorSeen(), "No se muestra un error de pago por los clics repetidos").toBe(false);
  await page.screenshot({ path: info.outputPath("resilient-checkout.png"), fullPage: true });
});

test("repeated Pay clicks on the booking page charge the balance once", async ({ page }) => {
  test.setTimeout(180_000);
  // Reserva retenida sin pagar (pago pendiente) para pagarla luego desde su página.
  await checkoutToPayment(page);
  await page.getByRole("radio", { name: "Pendiente (CIP)", exact: true }).check();
  await page.locator("#f-submit").click();
  await expect(page).toHaveURL(/\/es\/reserva\/PWT-\d{4}-\d{6}/, { timeout: 60_000 });
  const errorSeen = await watchPaymentErrors(page);
  await page.reload();

  const bookingPath = /^\/es\/reserva\/PWT-\d{4}-\d{6}$/;
  await slowActions(page, bookingPath, 2_500);
  const sent = trackActions(page, bookingPath);
  await page.getByRole("radio", { name: "Aprobado", exact: true }).check();
  await burstClick(page, "#f-pay-booking", 3);
  await expect(page.locator("#f-pay-booking")).toBeDisabled();
  await page.locator("#f-pay-booking").dispatchEvent("click");

  await expect(page.locator("#booking-title")).toContainText(/reserva está (pagada|confirmada)/, { timeout: 60_000 });
  expect(sent, "Un solo cobro por más clics que haya").toHaveLength(1);
  expect(await errorSeen()).toBe(false);
});
