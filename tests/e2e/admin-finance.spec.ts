import { createHmac } from "node:crypto";
import { test, expect } from "@playwright/test";
const web = process.env.E2E_WEB_BASE_URL ?? "http://localhost:3100";
const admin = process.env.E2E_ADMIN_BASE_URL ?? "http://localhost:3102";
if (process.env.CI !== "true" || process.env.MAIL_TRANSPORT !== "memory" || process.env.NEXT_PUBLIC_PAYMENTS_MODE !== "sandbox"
  || new URL(process.env.DATABASE_URL ?? "").pathname !== "/pwt_browser_test"
  || [web, admin].some((url) => !["localhost", "127.0.0.1"].includes(new URL(url).hostname))) {
  throw new Error("Financial UI tests require fresh isolated CI database, localhost, memory mail and sandbox payments.");
}

function totp(secret: string) {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  const bits = [...secret.toUpperCase().replace(/=+$/, "")].map((char) => {
    const index = alphabet.indexOf(char); if (index < 0) throw new Error("Invalid fixture TOTP secret");
    return index.toString(2).padStart(5, "0");
  }).join("");
  const key = Buffer.from((bits.match(/.{8}/g) ?? []).map((byte) => parseInt(byte, 2)));
  const counter = Buffer.alloc(8); counter.writeBigUInt64BE(BigInt(Math.floor(Date.now() / 30000)));
  const digest = createHmac("sha1", key).update(counter).digest();
  const offset = digest[digest.length - 1] & 15;
  return ((digest.readUInt32BE(offset) & 0x7fffffff) % 1000000).toString().padStart(6, "0");
}

test("admin finance: record and void own simulated payment, then cancel own booking", async ({ page }, info) => {
  test.setTimeout(210000);
  const metrics: { action: string; milliseconds: number }[] = [];
  async function measured(action: string, work: () => Promise<void>) {
    const start = performance.now(); await test.step(action, work);
    metrics.push({ action, milliseconds: Math.round(performance.now() - start) });
  }
  const suffix = Date.now().toString();
  let code = "";
  const reference = `CI-ONLY-${suffix}`;
  try {
    await measured("Create own unpaid reservation with a terminal rejected sandbox attempt", async () => {
      await page.goto(`${web}/es/tours/tour-islas-de-los-uros-y-taquile-full-day`);
      const booking = page.locator("#reservar-panel");
      await booking.locator('button[data-date]:not([aria-disabled="true"])').first().click();
      await booking.getByRole("button", { name: "Agregar al carrito", exact: true }).click();
      await expect(booking.getByRole("button", { name: "Agregado", exact: true })).toBeVisible();
      await page.goto(`${web}/es/carrito`);
      await page.getByRole("link", { name: "Continuar con la reserva", exact: true }).first().click();
      await page.getByLabel("Nombres", { exact: true }).fill("Finanzas");
      await page.getByLabel("Apellidos", { exact: true }).fill(`Fixture ${suffix}`);
      await page.getByLabel("Correo electrónico", { exact: true }).fill(`finance-${suffix}@peruwonderstours.test`);
      await page.getByLabel("Celular (WhatsApp)", { exact: true }).fill("900000003");
      await page.getByLabel("País de residencia", { exact: true }).selectOption("Perú");
      await page.getByRole("button", { name: "Continuar a viajeros", exact: true }).click();
      const names = page.getByLabel("Nombres y apellidos", { exact: true });
      await expect(names.first()).toBeVisible();
      for (let index = 0; index < await names.count(); index++) {
        await names.nth(index).fill(`Finanzas Fixture ${index + 1}`);
        await page.getByLabel("Número de documento", { exact: true }).nth(index).fill(String(12345680 + index));
        await page.getByLabel("Nacionalidad", { exact: true }).nth(index).fill("Peruana");
      }
      await page.getByRole("button", { name: "Continuar al pago", exact: true }).click();
      await expect(page.getByText("Modo sandbox: pago simulado, no se realizará ningún cobro", { exact: true })).toBeVisible();
      // A pending online collection correctly prevents simultaneous manual payments.
      // Use a terminal rejected attempt; never disable that financial safety guard.
      await page.getByRole("radio", { name: "Rechazado", exact: true }).check();
      await page.locator('input[name="terms"]').check();
      await page.locator("#f-submit").click();
      await expect(page.getByRole("alert").filter({ hasText: "Tu banco rechazó el pago" })).toBeVisible();
      await page.getByRole("link", { name: "Ver mi reserva", exact: true }).click();
      await expect(page).toHaveURL(/\/es\/reserva\/PWT-\d{4}-\d{6}/);
      code = new URL(page.url()).pathname.split("/").pop()!;
      expect(code).toMatch(/^PWT-\d{4}-\d{6}$/);
      await expect(page.locator("#booking-title")).toContainText("pendiente de pago");
    });
    await measured("Authenticate CI-only staff with MFA", async () => {
      const email = process.env.E2E_ADMIN_EMAIL!;
      expect(email).toBe("browser-admin@peruwonderstours.test");
      await page.goto(`${admin}/login`);
      await page.getByLabel(/^Correo\s*\*?$/).fill(email);
      await page.getByLabel(/^Contraseña\s*\*?$/).fill(process.env.E2E_ADMIN_PASSWORD!);
      await page.getByRole("button", { name: "Continuar", exact: true }).click();
      await expect(page.getByRole("heading", { name: "Verificación en dos pasos" })).toBeVisible();
      const previousStep = Math.floor(Date.now() / 30000);
      await expect.poll(() => Math.floor(Date.now() / 30000), { timeout: 35000, intervals: [250] }).toBeGreaterThan(previousStep);
      await page.getByLabel("Código de 6 dígitos").fill(totp(process.env.E2E_ADMIN_TOTP_SECRET!));
      await page.getByRole("button", { name: "Ingresar", exact: true }).click();
      await expect(page).toHaveURL(`${admin}/`);
    });
    const paid = () => page.locator("#resumen dt").filter({ hasText: /^Pagado$/ }).locator("..").locator("dd");
    const cents = async () => Number((await paid().innerText()).replace(/[^0-9]/g, ""));
    await measured("Record required simulated balance and verify persisted payment", async () => {
      await page.goto(`${admin}/reservas/${code}`);
      await expect(page.locator("main header")).toContainText(`finance-${suffix}@peruwonderstours.test`);
      expect(await cents()).toBe(0);
      const form = page.locator("#registrar-pago form");
      const payableAmount = await form.getByLabel(/^Monto \((PEN|USD)\)\s*\*?$/).inputValue();
      expect(payableAmount).toMatch(/^\d+\.\d{2}$/);
      const expectedCents = Number(payableAmount.replace(".", ""));
      expect(expectedCents).toBeGreaterThan(0);
      await form.getByLabel(/^Medio\s*\*?$/).selectOption("cash");
      await form.getByLabel(/^N.º de operación o recibo\s*\*?$/).fill(reference);
      await form.getByRole("button", { name: "Registrar pago", exact: true }).click();
      await expect(page.getByRole("region", { name: "Pagos", exact: true }).getByText(`cash:${reference}`, { exact: true })).toBeVisible();
      await page.reload();
      expect(await cents()).toBe(expectedCents);
    });
    await measured("Void only own manual record and verify counter-entry and zero paid", async () => {
      await page.goto(`${admin}/pagos-manuales`);
      const table = page.getByRole("region", { name: "Detalle de pagos manuales" });
      const row = table.locator("tbody tr").filter({ has: page.getByText(`cash:${reference}`, { exact: true }) }).filter({ hasNotText: "Contra-asiento" });
      await expect(row).toHaveCount(1);
      await row.locator("summary").click();
      await row.getByLabel(/^Motivo de la anulación/).fill("Corrección ficticia de CI, no existe dinero real.");
      page.once("dialog", (dialog) => dialog.accept());
      await row.getByRole("button", { name: "Confirmar anulación", exact: true }).click();
      await expect(row.getByText("Anulado", { exact: true })).toBeVisible();
      await expect(table.locator("tbody tr").filter({ hasText: code }).filter({ hasText: "Contra-asiento" })).toHaveCount(1);
      await page.goto(`${admin}/reservas/${code}`);
      expect(await cents()).toBe(0);
    });
    await measured("Inspect cancellation policy and cancel own unpaid fixture", async () => {
      const cancel = page.locator("#cancelar");
      await expect(cancel.getByText("Cotización según la política", { exact: true })).toBeVisible();
      await cancel.getByText("Ver tramos de la política", { exact: true }).click();
      await expect(cancel.locator("details")).toHaveAttribute("open", "");
      await cancel.getByLabel(/^Motivo de la cancelación\s*\*?$/).fill("Cancelación de reserva ficticia creada exclusivamente para CI.");
      page.once("dialog", (dialog) => dialog.accept());
      await cancel.getByRole("button", { name: "Cancelar reserva", exact: true }).click();
      await expect(page.locator("main header").getByText("Cancelada", { exact: true })).toBeVisible();
      await page.reload();
      await expect(page.locator("main header").getByText("Cancelada", { exact: true })).toBeVisible();
      expect(await cents()).toBe(0);
      await expect(page.locator("#resumen")).toContainText("Cancelación de reserva ficticia creada exclusivamente para CI.");
      await page.screenshot({ path: info.outputPath("admin-cancelled-own-fixture.png"), fullPage: true });
    });
  } finally {
    await info.attach("admin-finance-action-timings.json", { body: JSON.stringify(metrics, null, 2), contentType: "application/json" });
  }
});




