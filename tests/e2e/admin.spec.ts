import { createHmac } from "node:crypto";
import { test, expect } from "@playwright/test";

const origin = process.env.E2E_ADMIN_BASE_URL ?? "http://127.0.0.1:3102";
const local = new URL(origin);
if (!process.env.CI || !["127.0.0.1", "localhost"].includes(local.hostname)) throw new Error("Admin browser tests require isolated CI localhost servers.");
test.use({ viewport: { width: 1280, height: 900 } });

/** RFC 6238 SHA-1 code for the fresh CI-only staff fixture. */
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

test("admin: MFA, navigation, catalog drafts, native banners and logout", async ({ page }, info) => {
  test.setTimeout(240000);
  const metrics: { action: string; milliseconds: number }[] = [];
  async function measured(action: string, work: () => Promise<void>) {
    const start = performance.now(); await test.step(action, work);
    metrics.push({ action, milliseconds: Math.round(performance.now() - start) });
  }
  const email = process.env.E2E_ADMIN_EMAIL;
  const password = process.env.E2E_ADMIN_PASSWORD;
  const secret = process.env.E2E_ADMIN_TOTP_SECRET;
  expect(email, "Fresh fixture email is required").toBeTruthy();
  expect(password, "Fresh fixture password is required").toBeTruthy();
  expect(secret, "Fresh fixture TOTP secret is required").toBeTruthy();
  const suffix = `${Date.now()}`;
  try {
    await measured("Password and MFA login", async () => {
      await page.goto(`${origin}/login`);
      await page.getByLabel("Correo", { exact: true }).fill(email!);
      await page.getByLabel("Contraseña", { exact: true }).fill("Incorrect-fixture-password!");
      await page.getByRole("button", { name: "Continuar", exact: true }).click();
      await expect(page.getByRole("alert")).toContainText("Correo o contraseña incorrectos");
      await page.getByLabel("Contraseña", { exact: true }).fill(password!);
      await page.getByRole("button", { name: "Continuar", exact: true }).click();
      await expect(page.getByRole("heading", { name: "Verificación en dos pasos" })).toBeVisible();
      await page.getByRole("button", { name: "No tengo mi teléfono: usar código de recuperación" }).click();
      await expect(page.getByLabel("Código de recuperación")).toBeVisible();
      await page.getByRole("button", { name: "Usar el código de la app" }).click();
      await page.getByLabel("Código de 6 dígitos").fill(totp(secret!));
      await page.getByRole("button", { name: "Ingresar", exact: true }).click();
      await expect(page).toHaveURL(`${origin}/`);
      await expect(page.getByRole("main").getByRole("heading", { level: 1 })).toBeVisible();
    });
    const links = await page.locator("aside nav a").evaluateAll((nodes) => nodes.map((node) => ({ path: node.getAttribute("href")!, label: node.textContent!.trim() })));
    expect(links.length).toBeGreaterThanOrEqual(16);
    for (const item of links) await measured(`Navigation: ${item.label}`, async () => {
      await page.locator(`aside nav a[href="${item.path}"]`).click();
      await expect(page).toHaveURL(new URL(item.path, origin).href);
      await expect(page.getByRole("main").getByRole("heading", { level: 1 })).toBeVisible();
      await expect(page.getByRole("main").getByText("No se pudo cargar", { exact: true })).toHaveCount(0);
    });
    for (const route of ["categorias", "destinos"]) await measured(`Create, edit and delete isolated ${route}`, async () => {
      await page.goto(`${origin}/${route}/nuevo`);
      const title = `E2E ${route} ${suffix}`;
      await page.getByLabel("Nombre", { exact: true }).fill(title);
      await page.getByLabel("Slug (URL en español)", { exact: true }).fill(`e2e-${route}-${suffix}`);
      await page.getByRole("button", { name: "Crear", exact: true }).click();
      await expect(page).toHaveURL(new RegExp(`/${route}/[0-9a-f-]{36}$`));
      await expect(page.getByRole("heading", { level: 1, name: title })).toBeVisible();
      await page.getByLabel("Orden", { exact: true }).fill("17");
      await page.getByRole("button", { name: "Guardar cambios", exact: true }).click();
      await expect(page.getByRole("status")).toContainText("Cambios guardados.");
      await page.reload();
      await expect(page.getByLabel("Orden", { exact: true })).toHaveValue("17");
      page.once("dialog", (dialog) => dialog.accept());
      await page.getByRole("button", { name: "Eliminar", exact: true }).click();
      await expect(page).toHaveURL(new RegExp(`/${route}\\?eliminado=1$`));
      await expect(page.getByRole("status")).toContainText("Eliminado correctamente.");
    });
    await measured("Create and edit a tour draft", async () => {
      await page.goto(`${origin}/tours/nuevo`);
      await page.getByLabel("Código", { exact: true }).fill(`E2E-${suffix}`);
      await page.getByLabel("Slug (URL en español)", { exact: true }).fill(`e2e-tour-${suffix}`);
      await page.getByLabel("Duración (horas)", { exact: true }).fill("4");
      await page.getByRole("button", { name: "Crear borrador" }).click();
      await expect(page).toHaveURL(/\/tours\/[0-9a-f-]{36}$/);
      await page.getByLabel("Duración (horas)", { exact: true }).fill("5");
      await page.getByRole("button", { name: "Guardar datos generales" }).click();
      await expect(page.getByRole("status")).toContainText("Datos generales guardados.");
      await page.reload();
      await expect(page.getByLabel("Duración (horas)", { exact: true })).toHaveValue("5");
    });
    await measured("Upload, activate, order and deactivate a native banner", async () => {
      await page.goto(`${origin}/banners`);
      const upload = page.locator("form").filter({ has: page.getByRole("button", { name: "Subir como inactivo" }) });
      const title = `E2E banner ${suffix}`;
      await upload.getByLabel("Título", { exact: true }).fill(title);
      await upload.getByLabel("Imagen del banner").setInputFiles({ name: "fixture.png", mimeType: "image/png", buffer: Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aBaoAAAAASUVORK5CYII=", "base64") });
      await upload.getByLabel("Efecto", { exact: true }).selectOption("water");
      await upload.getByRole("button", { name: "Subir como inactivo" }).click();
      await expect(page.getByRole("status")).toContainText("Archivo guardado como inactivo");
      const row = page.locator("form").filter({ has: page.getByText(title, { exact: true }) });
      await expect(row.getByText("Inactivo", { exact: true })).toBeVisible();
      await row.getByLabel("Mostrar en portada").check();
      await row.getByLabel("La imagen ya contiene el título").check();
      await row.getByLabel("Orden", { exact: true }).fill("7");
      await row.getByRole("button", { name: "Guardar cambios" }).click();
      await expect(row.getByText("Activo", { exact: true })).toBeVisible();
      await page.getByRole("button", { name: "Recargar", exact: true }).click();
      await expect(row.getByLabel("Orden", { exact: true })).toHaveValue("7");
      await expect(row.getByLabel("La imagen ya contiene el título")).toBeChecked();
      await row.getByLabel("Mostrar en portada").uncheck();
      await row.getByRole("button", { name: "Guardar cambios" }).click();
      await expect(row.getByText("Inactivo", { exact: true })).toBeVisible();
    });
    await measured("Logout revokes browser access", async () => {
      await page.getByRole("button", { name: "Salir", exact: true }).click();
      await expect(page).toHaveURL(/\/login/);
      await page.goto(`${origin}/banners`);
      await expect(page).toHaveURL(/\/login/);
    });
  } finally {
    await info.attach("admin-action-timings.json", { body: JSON.stringify(metrics, null, 2), contentType: "application/json" });
  }
});
