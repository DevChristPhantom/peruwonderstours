import { createHmac } from "node:crypto";
import { test, expect } from "@playwright/test";

const origin = process.env.E2E_ADMIN_BASE_URL ?? "http://localhost:3102";
const web = process.env.E2E_WEB_BASE_URL ?? "http://localhost:3100";
if (!process.env.CI || ![origin, web].every((u) => ["localhost", "127.0.0.1"].includes(new URL(u).hostname))) {
  throw new Error("Promotion browser tests require isolated CI localhost servers.");
}
test.use({ viewport: { width: 1280, height: 900 } });

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

test("admin promotions: event created in the panel reaches «Lo más relevante» and the 3-second home announcement", async ({ page, browser }, info) => {
  test.setTimeout(240000);
  const title = `Festividad CI ${Date.now()}`;
  const metrics: { action: string; milliseconds: number }[] = [];
  async function measured(action: string, work: () => Promise<void>) {
    const start = performance.now(); await test.step(action, work);
    metrics.push({ action, milliseconds: Math.round(performance.now() - start) });
  }
  let eventPath = "";
  try {
    await measured("Authenticate fresh fixture administrator", async () => {
      await page.goto(`${origin}/login`);
      await page.getByLabel(/^Correo\s*\*?$/).fill(process.env.E2E_ADMIN_EMAIL!);
      await page.getByLabel(/^Contraseña\s*\*?$/).fill(process.env.E2E_ADMIN_PASSWORD!);
      await page.getByRole("button", { name: "Continuar", exact: true }).click();
      await expect(page.getByRole("heading", { name: "Verificación en dos pasos" })).toBeVisible();
      // RFC 6238 replay protection: another serial suite may have used this step.
      const previousStep = Math.floor(Date.now() / 30000);
      await expect.poll(() => Math.floor(Date.now() / 30000), { timeout: 35000, intervals: [250] }).toBeGreaterThan(previousStep);
      await page.getByLabel("Código de 6 dígitos").fill(totp(process.env.E2E_ADMIN_TOTP_SECRET!));
      await page.getByRole("button", { name: "Ingresar", exact: true }).click();
      await expect(page).toHaveURL(`${origin}/`);
    });

    await measured("Create and publish an event that links to a site page", async () => {
      await page.getByRole("navigation", { name: "Secciones del panel" }).getByRole("link", { name: "Eventos y promociones" }).click();
      await page.getByRole("link", { name: "Nuevo evento" }).click();
      await page.getByLabel(/^Título/).fill(title);
      await page.getByLabel("Línea superior", { exact: true }).fill("Puno · febrero");
      await page.getByLabel(/^Descripción corta/).fill("Danzas y música en honor a la Virgen de la Candelaria. Planea tu viaje con tiempo.");
      await page.getByRole("radio", { name: /Una página del sitio/ }).check();
      // Pasted with domain and language: the panel keeps only the internal path.
      await page.getByLabel(/^Página del sitio/).fill("https://peruwonderstours.com/es/destinos/tours-en-puno");
      await page.getByLabel("Primer día", { exact: true }).fill("2027-02-01");
      await page.getByLabel("Último día", { exact: true }).fill("2027-02-14");
      await page.getByRole("checkbox", { name: /Mostrar como anuncio/ }).check();
      await page.getByRole("button", { name: "Crear borrador", exact: true }).click();
      await expect(page).toHaveURL(/\/eventos\/[0-9a-f-]{36}$/);
      eventPath = new URL(page.url()).pathname;
      await page.getByRole("button", { name: "Publicar", exact: true }).click();
      await expect(page.getByRole("status")).toContainText("Evento publicado");
    });

    await measured("Home shows the event and opens the announcement after three seconds", async () => {
      const home = await browser.newPage({ viewport: { width: 1280, height: 900 } });
      try {
        await expect.poll(async () => {
          await home.goto(`${web}/es`);
          return home.getByRole("region", { name: "Lo más relevante" }).getByText(title).count();
        }, { timeout: 45000, intervals: [1500] }).toBeGreaterThan(0);
        const section = home.getByRole("region", { name: "Lo más relevante" });
        await expect(section.getByRole("link", { name: "Ver más" })).toHaveAttribute("href", "/es/destinos/tours-en-puno");
        await expect(home.locator("dialog[open]")).toHaveCount(0);
        const announcement = home.getByRole("dialog", { name: title });
        await expect(announcement).toBeVisible({ timeout: 8000 });
        await expect(announcement).toContainText("1–14 de febrero de 2027");
        await home.screenshot({ path: info.outputPath("promotion-announcement.png") });
        await home.keyboard.press("Escape");
        await expect(announcement).toBeHidden();
        await home.reload();
        await home.waitForTimeout(4500);
        await expect(home.locator("dialog[open]"), "Dismissed announcement stays closed").toHaveCount(0);
      } finally {
        await home.close();
      }
    });
  } finally {
    if (eventPath) {
      await page.goto(`${origin}${eventPath}`);
      page.once("dialog", (d) => d.accept());
      await page.getByRole("button", { name: "Eliminar", exact: true }).click();
      await expect(page).toHaveURL(`${origin}/eventos`);
      await expect(page.getByText(title)).toHaveCount(0);
    }
    await info.attach("promotion-step-timings.json", { body: JSON.stringify({ environment: "isolated-ci-localhost-chromium", metrics }, null, 2), contentType: "application/json" });
  }
});
