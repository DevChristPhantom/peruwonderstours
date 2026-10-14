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
  test.setTimeout(360000);
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
  let draftId = "";
  try {
    await measured("Password and MFA login", async () => {
      await page.goto(`${origin}/login`);
      await expect(page.getByRole("heading", { name: "Iniciar sesión", exact: true })).toBeVisible();
      await page.getByLabel(/^Correo\s*\*?$/).fill(email!);
      await page.getByLabel(/^Contraseña\s*\*?$/).fill("Incorrect-fixture-password!");
      await page.getByRole("button", { name: "Continuar", exact: true }).click();
      await expect(page.getByRole("alert").filter({ hasText: "Correo o contraseña incorrectos" })).toBeVisible();
      await expect(page.getByRole("button", { name: "Continuar", exact: true })).toBeEnabled();
      // React resets uncontrolled action inputs after the resolved failure result.
      // Enter the complete credentials again, as a user would after that reset.
      await page.getByLabel(/^Correo\s*\*?$/).fill(email!);
      await page.getByLabel(/^Contraseña\s*\*?$/).fill(password!);
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
      await page.getByLabel(/^Nombre\s*\*?$/).fill(title);
      await page.getByLabel(/^Slug \(URL en español\)\s*\*?$/).fill(`e2e-${route}-${suffix}`);
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
      await page.getByLabel(/^Código\s*\*?$/).fill(`E2E-${suffix}`);
      await page.getByLabel(/^Slug \(URL en español\)\s*\*?$/).fill(`e2e-tour-${suffix}`);
      await page.getByLabel("Duración (horas)", { exact: true }).fill("4");
      await page.getByRole("button", { name: "Crear borrador" }).click();
      await expect(page).toHaveURL(/\/tours\/[0-9a-f-]{36}$/);
      await page.getByLabel("Duración (horas)", { exact: true }).fill("5");
      await page.getByRole("button", { name: "Guardar datos generales" }).click();
      await expect(page.getByRole("status")).toContainText("Datos generales guardados.");
      await page.reload();
      await expect(page.getByLabel("Duración (horas)", { exact: true })).toHaveValue("5");
      const detailPath = new URL(page.url()).pathname;
      draftId = detailPath.split("/").pop()!;
      await page.goto(`${origin}/tours`);
      const filters = page.getByRole("form", { name: "Filtros de tours" });
      await filters.getByLabel("Buscar (código, slug o título)").fill(`E2E-${suffix}`);
      await filters.getByLabel("Estado", { exact: true }).selectOption("draft");
      await filters.getByRole("button", { name: "Filtrar", exact: true }).click();
      await expect(page).toHaveURL(new RegExp(`q=E2E-${suffix}`));
      const resultLink = page.getByRole("main").locator(`a[href="${detailPath}"]`);
      await expect(resultLink).toBeVisible();
      await resultLink.click();
      await expect(page).toHaveURL(`${origin}${detailPath}`);
      await expect(page.getByLabel("Duración (horas)", { exact: true })).toHaveValue("5");
    });
    await measured("Create, deactivate, reactivate and delete a draft tour rate", async () => {
      await page.goto(`${origin}/precios?tourId=${draftId}&inactivas=1`);
      const create = page.locator("form").filter({ has: page.getByRole("button", { name: "Crear tarifa", exact: true }) });
      const start = new Date(Date.now() + 14 * 86400000).toISOString().slice(0, 10);
      const end = new Date(Date.now() + 45 * 86400000).toISOString().slice(0, 10);
      await create.getByLabel(/^Precio por persona\s*\*?$/).fill("45.67");
      await create.getByLabel(/^Vigente desde\s*\*?$/).fill(start);
      await create.getByLabel(/^Vigente hasta\s*\*?$/).fill(end);
      await create.getByRole("button", { name: "Crear tarifa", exact: true }).click();
      const row = page.getByRole("region", { name: "Tarifas del tour" }).locator("tbody tr");
      await expect(row).toHaveCount(1);
      await expect(row).toContainText(/45[.,]67/);
      await row.getByRole("button", { name: "Desactivar", exact: true }).click();
      await expect(row.getByRole("button", { name: "Activar", exact: true })).toBeVisible();
      await row.getByRole("button", { name: "Activar", exact: true }).click();
      await expect(row.getByRole("button", { name: "Desactivar", exact: true })).toBeVisible();
      page.once("dialog", (dialog) => dialog.accept());
      await row.getByRole("button", { name: "Eliminar", exact: true }).click();
      await expect(page.getByRole("main").getByText("El tour no tiene tarifas: no se puede reservar en línea.", { exact: true })).toBeVisible();
    });
    await measured("Generate a draft departure, adjust capacity, close/reopen and delete", async () => {
      await page.goto(`${origin}/salidas?tourId=${draftId}`);
      const create = page.locator("#lote form");
      const date = new Date(Date.now() + 14 * 86400000).toISOString().slice(0, 10);
      await create.getByLabel(/^Desde\s*\*?$/).fill(date);
      await create.getByLabel(/^Hasta\s*\*?$/).fill(date);
      await create.getByRole("button", { name: "Generar salidas", exact: true }).click();
      const row = page.getByRole("region", { name: "Salidas del tour" }).locator("tbody tr");
      await expect(row).toHaveCount(1);
      await row.getByRole("textbox", { name: /^Capacidad del / }).fill("17");
      const capacitySaved = page.waitForResponse((response) => response.request().method() === "POST" && new URL(response.url()).pathname === "/salidas" && response.ok());
      await row.getByRole("button", { name: "Guardar", exact: true }).click();
      await capacitySaved;
      await expect(row.getByRole("button", { name: "Guardar", exact: true })).toBeEnabled();
      await page.reload();
      await expect(row.getByRole("textbox", { name: /^Capacidad del / })).toHaveValue("17");
      await row.getByRole("button", { name: "Cerrar ventas", exact: true }).click();
      await expect(row.getByRole("button", { name: "Reabrir", exact: true })).toBeVisible();
      await row.getByRole("button", { name: "Reabrir", exact: true }).click();
      await expect(row.getByRole("button", { name: "Cerrar ventas", exact: true })).toBeVisible();
      page.once("dialog", (dialog) => dialog.accept());
      await row.getByRole("button", { name: "Eliminar", exact: true }).click();
      await expect(page.getByText("Sin salidas en el rango.", { exact: true })).toBeVisible();
    });
    await measured("Audit filters retain and clear query state", async () => {
      await page.goto(`${origin}/auditoria`);
      const filters = page.getByRole("form", { name: "Filtros de auditoría" });
      await filters.getByLabel("Entidad", { exact: true }).fill("tours");
      await filters.getByRole("button", { name: "Filtrar", exact: true }).click();
      await expect(page).toHaveURL(/entityType=tours/);
      await expect(page.getByRole("form", { name: "Filtros de auditoría" }).getByLabel("Entidad", { exact: true })).toHaveValue("tours");
      await expect(page.getByRole("main").getByText("No se pudo cargar", { exact: true })).toHaveCount(0);
      await page.getByRole("link", { name: "Limpiar", exact: true }).click();
      await expect(page).toHaveURL(`${origin}/auditoria`);
      await expect(page.getByRole("form", { name: "Filtros de auditoría" }).getByLabel("Entidad", { exact: true })).toHaveValue("");
    });
    await measured("Create a private contact fixture and record administrative follow-up", async () => {
      const webOrigin = process.env.E2E_WEB_BASE_URL ?? "http://localhost:3100";
      if (!["localhost", "127.0.0.1"].includes(new URL(webOrigin).hostname)) throw new Error("Contact fixture requires isolated localhost web server.");
      const subject = `Admin follow-up fixture ${suffix}`;
      const publicPage = await page.context().newPage();
      try {
        await publicPage.goto(`${webOrigin}/es/contactenos`);
        await publicPage.getByLabel("Nombre", { exact: true }).fill("Consumidor Fixture Admin");
        await publicPage.getByLabel("Correo electrónico", { exact: true }).fill(`admin-contact-${suffix}@peruwonderstours.test`);
        await publicPage.getByLabel("Asunto", { exact: true }).fill(subject);
        await publicPage.getByLabel("Mensaje", { exact: true }).fill("Consulta ficticia creada solo para probar el seguimiento administrativo en CI.");
        await publicPage.getByRole("checkbox", { name: /Acepto el tratamiento/ }).check();
        await publicPage.getByRole("button", { name: "Enviar mensaje", exact: true }).click();
        await expect(publicPage.getByRole("status").filter({ hasText: "Recibimos tu mensaje" })).toBeVisible();
      } finally { await publicPage.close(); }
      await page.goto(`${origin}/contacto`);
      await page.getByRole("link", { name: subject, exact: true }).click();
      await expect(page.getByRole("heading", { level: 1, name: subject })).toBeVisible();
      await page.getByLabel(/^Nuevo estado\s*\*?$/).selectOption("answered");
      await page.getByLabel("Nota interna", { exact: true }).fill("Seguimiento ficticio de CI; no se envió ningún correo ni WhatsApp.");
      await page.getByRole("button", { name: "Guardar", exact: true }).click();
      await expect(page.locator("main header").getByText("Respondido", { exact: true })).toBeVisible();
      await page.reload();
      await expect(page.locator("main header").getByText("Respondido", { exact: true })).toBeVisible();
      await expect(page.getByLabel("Nota interna", { exact: true })).toHaveValue("Seguimiento ficticio de CI; no se envió ningún correo ni WhatsApp.");
      await page.getByLabel(/^Nuevo estado\s*\*?$/).selectOption("archived");
      await page.getByRole("button", { name: "Guardar", exact: true }).click();
      await expect(page.locator("main header").getByText("Archivado", { exact: true })).toBeVisible();
      await page.reload();
      await expect(page.locator("main header").getByText("Archivado", { exact: true })).toBeVisible();
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
